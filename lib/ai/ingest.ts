import { getDb } from "@/lib/mongodb";
import { chunkText } from "@/lib/vector-store";
import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";

const EMBEDDING_MODEL = "text-embedding-3-small";

/** Uma "página" de conteúdo extraído (de um PDF, slide de PPTX, artigo web, segmento de transcrição, etc.). */
export interface ExtractedPage {
  text: string;
  images: string[]; // data: URIs
}

export interface IngestResult {
  chunksCount: number;
  imagesCount: number;
}

/**
 * Cauda comum da importação inteligente: fragmenta cada página, gera embeddings
 * em lote e grava os chunks em `uploaded_chunks` (RAG usado na geração de cursos).
 * Reutilizada pelo upload de ficheiros (PDF/PPTX/DOCX/TXT) e pelas importações de
 * URL e de transcrição do YouTube — todas produzem o mesmo formato ExtractedPage[].
 */
export async function ingestExtractedPages(
  pages: ExtractedPage[],
  opts: { briefingId: string; tenantId: string; sourceName: string }
): Promise<IngestResult> {
  const pageChunkGroups = pages
    .filter((p) => p.text && p.text.trim())
    .map((p) => ({
      textChunks: chunkText(p.text, 600, 100),
      images: p.images,
    }))
    .filter((g) => g.textChunks.length > 0);

  if (pageChunkGroups.length === 0) {
    return { chunksCount: 0, imagesCount: 0 };
  }

  const allChunks = pageChunkGroups.flatMap((g) => g.textChunks);

  let embeddings: number[][] = [];
  try {
    const r = await embedMany({
      model: openai.embedding(EMBEDDING_MODEL),
      values: allChunks,
    });
    embeddings = r.embeddings;
  } catch (err) {
    console.warn(`Ingest RAG (${opts.sourceName}): falha ao gerar embeddings, a ignorar vetores:`, err);
  }

  const db = await getDb();
  const col = db.collection("uploaded_chunks");

  const docs: any[] = [];
  let flatIdx = 0;
  let imagesCount = 0;
  for (const group of pageChunkGroups) {
    for (const chunk of group.textChunks) {
      docs.push({
        briefingId: opts.briefingId,
        tenant_id: opts.tenantId,
        fileName: opts.sourceName,
        content: chunk,
        images: group.images,
        embedding: embeddings[flatIdx] || [],
        createdAt: new Date(),
      });
      flatIdx++;
    }
    imagesCount += group.images.length;
  }

  await col.insertMany(docs);
  return { chunksCount: docs.length, imagesCount };
}
