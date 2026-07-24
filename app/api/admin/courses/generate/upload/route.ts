import { NextRequest, NextResponse } from "next/server";
import { createRequire } from "module";
import { pathToFileURL } from "url";
import { auth } from "@clerk/nextjs/server";
import { ingestExtractedPages, ExtractedPage } from "@/lib/ai/ingest";

export const runtime = "nodejs";
export const maxDuration = 60;

let pdfWorkerConfigured = false;

/**
 * Aponta explicitamente o pdf-parse/pdfjs-dist para o ficheiro real do worker em
 * node_modules, em vez de deixar a resolução automática (que depende de import()
 * relativo ao próprio pacote e falha quando o Turbopack transforma esse caminho —
 * erro "Setting up fake worker failed: Cannot find module ...pdf.worker.mjs").
 */
function ensurePdfWorkerConfigured(PDFParse: any) {
  if (pdfWorkerConfigured) return;
  try {
    const require = createRequire(import.meta.url);
    const workerPath = require.resolve("pdf-parse/dist/worker/pdf.worker.mjs");
    PDFParse.setWorker(pathToFileURL(workerPath).href);
  } catch (err) {
    console.warn("Não foi possível configurar explicitamente o worker do pdf-parse:", err);
  }
  pdfWorkerConfigured = true;
}

/**
 * Extrai texto e imagens embutidas de um PDF usando pdf-parse (getText + getImage).
 */
async function extractPdfContent(buffer: Buffer): Promise<ExtractedPage[]> {
  const { PDFParse } = await import("pdf-parse");
  ensurePdfWorkerConfigured(PDFParse);
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

async function extractFileContent(buffer: Buffer, filename: string): Promise<ExtractedPage[]> {
  const name = filename.toLowerCase();

  if (name.endsWith(".pdf")) {
    return extractPdfContent(buffer);
  }

  if (name.endsWith(".pptx")) {
    return extractPptxContent(buffer);
  }

  if (name.endsWith(".docx")) {
    return extractDocxContent(buffer);
  }

  // .txt, .md e outros ficheiros de texto simples
  const text = buffer.toString("utf8");
  return text.trim() ? [{ text, images: [] }] : [];
}

interface BlobRef {
  url: string;
  filename: string;
  size: number;
}

// POST — Processa ficheiros já carregados diretamente para o Vercel Blob pelo browser
// (ver /api/admin/courses/generate/upload-token). O ficheiro NUNCA passa pelo corpo
// deste pedido — só o URL do Blob — o que evita por completo os limites de tamanho de
// corpo e falhas de parsing de multipart/form-data em ficheiros grandes ou binários
// (ex: "Failed to parse body as FormData" observado com PPTX maiores).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const body = await req.json();
    const blobs: BlobRef[] = body.blobs || [];
    const briefingId = body.briefingId || Math.random().toString(36).substring(7);

    let totalChunks = 0;
    let totalImages = 0;
    const processedFiles: { name: string; size: number; sourceId: string; chunksCount: number }[] = [];
    const failures: { name: string; error: string }[] = [];

    for (const blobRef of blobs) {
      let buffer: Buffer;
      try {
        // O blob foi carregado como "private" (ver content-factory/page.tsx) — precisa do
        // token de leitura/escrita para autenticar o download, tal como um GET normal a um
        // blob privado exige (um fetch sem este header recebe 403).
        const blobRes = await fetch(blobRef.url, {
          headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
        });
        if (!blobRes.ok) throw new Error(`Não foi possível descarregar o ficheiro (HTTP ${blobRes.status}).`);
        buffer = Buffer.from(await blobRes.arrayBuffer());
      } catch (err: any) {
        failures.push({ name: blobRef.filename, error: err?.message || "Falha ao descarregar o ficheiro carregado." });
        continue;
      }

      let pages: ExtractedPage[] = [];
      try {
        pages = await extractFileContent(buffer, blobRef.filename);
      } catch (err: any) {
        console.warn(`Falha ao extrair conteúdo de "${blobRef.filename}":`, err);
        failures.push({ name: blobRef.filename, error: err?.message || "Formato de ficheiro inválido ou corrompido." });
        continue;
      }

      if (pages.length === 0 || pages.every((p) => !p.text.trim())) {
        failures.push({ name: blobRef.filename, error: "Não foi possível extrair texto deste ficheiro (pode estar vazio, protegido ou ser apenas imagens sem texto)." });
        continue;
      }

      const result = await ingestExtractedPages(pages, { briefingId, tenantId, sourceName: blobRef.filename });
      totalChunks += result.chunksCount;
      totalImages += result.imagesCount;
      processedFiles.push({ name: blobRef.filename, size: blobRef.size, sourceId: result.sourceId, chunksCount: result.chunksCount });
    }

    return NextResponse.json({
      success: true,
      briefingId,
      chunksCount: totalChunks,
      imagesCount: totalImages,
      files: processedFiles,
      failures,
    });
  } catch (error: any) {
    console.error("Erro no upload de materiais:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
