import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { chunkText } from "@/lib/vector-store";
import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";

const EMBEDDING_MODEL = "text-embedding-3-small";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ExtractedPage {
  text: string;
  images: string[]; // data: URIs
}

/**
 * Extrai texto e imagens embutidas de um PDF usando pdf-parse (getText + getImage).
 */
async function extractPdfContent(buffer: Buffer): Promise<ExtractedPage[]> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText();
    const imageResult = await parser.getImage({ imageThreshold: 80 });

    const imagesByPage = new Map<number, string[]>();
    for (const page of imageResult.pages) {
      imagesByPage.set(
        page.pageNumber,
        page.images.map((img) => img.dataUrl).filter(Boolean)
      );
    }

    return textResult.pages.map((p) => ({
      text: p.text || "",
      images: imagesByPage.get(p.num) || [],
    }));
  } finally {
    await parser.destroy();
  }
}

/**
 * Extrai texto e imagens de um PPTX (ficheiro .zip com XML + media/) usando JSZip.
 * Cada slide vira uma "página": texto dos nós <a:t> + imagens referenciadas no .rels do slide.
 */
async function extractPptxContent(buffer: Buffer): Promise<ExtractedPage[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);

  // 1. Carregar todas as imagens em ppt/media/ como data URIs
  const mediaDataUrls: Record<string, string> = {};
  for (const path of Object.keys(zip.files)) {
    if (path.startsWith("ppt/media/") && !zip.files[path].dir) {
      const ext = (path.split(".").pop() || "png").toLowerCase();
      const mime = ext === "jpg" ? "jpeg" : ext === "svg" ? "svg+xml" : ext;
      const base64 = await zip.files[path].async("base64");
      mediaDataUrls[path.replace("ppt/", "")] = `data:image/${mime};base64,${base64}`;
    }
  }

  // 2. Localizar e ordenar os slides
  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || "0", 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || "0", 10);
      return na - nb;
    });

  const pages: ExtractedPage[] = [];
  for (const slidePath of slidePaths) {
    const slideNum = slidePath.match(/slide(\d+)\.xml/)?.[1] || "";
    const xml = await zip.files[slidePath].async("text");

    // Texto: todos os nós <a:t>...</a:t>
    const text = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(" ").trim();

    // Imagens: resolver via .rels do slide (relaciona r:embed -> ficheiro em media/)
    const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
    const images: string[] = [];
    if (zip.files[relsPath]) {
      const relsXml = await zip.files[relsPath].async("text");
      const targets = [...relsXml.matchAll(/Target="\.\.\/media\/([^"]+)"/g)].map((m) => m[1]);
      for (const target of targets) {
        const dataUrl = mediaDataUrls[`media/${target}`];
        if (dataUrl) images.push(dataUrl);
      }
    }

    pages.push({ text, images });
  }

  return pages;
}

async function extractFileContent(file: File): Promise<ExtractedPage[]> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    return extractPdfContent(buffer);
  }

  if (name.endsWith(".pptx")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    return extractPptxContent(buffer);
  }

  // .txt, .md e outros ficheiros de texto simples
  const text = await file.text();
  return text.trim() ? [{ text, images: [] }] : [];
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const briefingId = formData.get("briefingId")?.toString() || Math.random().toString(36).substring(7);

    const db = await getDb();
    const col = db.collection("uploaded_chunks");

    let totalChunks = 0;
    let totalImages = 0;

    for (const file of files) {
      let pages: ExtractedPage[] = [];
      try {
        pages = await extractFileContent(file);
      } catch (err) {
        console.warn(`Falha ao extrair conteúdo de "${file.name}", a ignorar ficheiro:`, err);
        continue;
      }

      // Fragmentar cada página/slide separadamente, associando as suas imagens a todos os chunks dessa página
      const pageChunkGroups = pages
        .filter((p) => p.text && p.text.trim())
        .map((p) => ({
          textChunks: chunkText(p.text, 600, 100),
          images: p.images,
        }))
        .filter((g) => g.textChunks.length > 0);

      if (pageChunkGroups.length === 0) continue;

      const allChunks = pageChunkGroups.flatMap((g) => g.textChunks);

      let embeddings: number[][] = [];
      try {
        const r = await embedMany({
          model: openai.embedding(EMBEDDING_MODEL),
          values: allChunks,
        });
        embeddings = r.embeddings;
      } catch (err) {
        console.warn("Upload RAG: falha ao gerar embeddings, a ignorar vetores:", err);
      }

      const docs: any[] = [];
      let flatIdx = 0;
      for (const group of pageChunkGroups) {
        for (const chunk of group.textChunks) {
          docs.push({
            briefingId,
            tenant_id: tenantId,
            fileName: file.name,
            content: chunk,
            images: group.images,
            embedding: embeddings[flatIdx] || [],
            createdAt: new Date(),
          });
          flatIdx++;
        }
        totalImages += group.images.length;
      }

      await col.insertMany(docs);
      totalChunks += docs.length;
    }

    return NextResponse.json({
      success: true,
      briefingId,
      chunksCount: totalChunks,
      imagesCount: totalImages,
    });
  } catch (error: any) {
    console.error("Erro no upload de materiais:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
