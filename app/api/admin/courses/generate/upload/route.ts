import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ingestExtractedPages, ExtractedPage } from "@/lib/ai/ingest";

export const runtime = "nodejs";
export const maxDuration = 60;

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

/**
 * Extrai o texto de um DOCX usando mammoth. Sem paginação real num .docx (ao
 * contrário de PDF/PPTX), pelo que o documento inteiro é tratado como uma única
 * "página" — a fragmentação em chunks acontece depois, em ingestExtractedPages().
 */
async function extractDocxContent(buffer: Buffer): Promise<ExtractedPage[]> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  const text = (result.value || "").trim();
  return text ? [{ text, images: [] }] : [];
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

  if (name.endsWith(".docx")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    return extractDocxContent(buffer);
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

      const result = await ingestExtractedPages(pages, { briefingId, tenantId, sourceName: file.name });
      totalChunks += result.chunksCount;
      totalImages += result.imagesCount;
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
