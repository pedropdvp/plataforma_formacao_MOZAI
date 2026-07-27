import { createRequire } from "module";
import { pathToFileURL } from "url";
import type { ExtractedPage } from "@/lib/ai/ingest";

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

/** Extrai texto e imagens embutidas de um PDF usando pdf-parse (getText + getImage). */
export async function extractPdfContent(buffer: Buffer): Promise<ExtractedPage[]> {
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
        page.images.map((img: any) => img.dataUrl).filter(Boolean)
      );
    }

    return textResult.pages.map((p: any) => ({
      text: p.text || "",
      images: imagesByPage.get(p.num) || [],
    }));
  } finally {
    await parser.destroy();
  }
}
