import { randomUUID } from "crypto";
import { getDb } from "@/lib/mongodb";
import { chunkText } from "@/lib/vector-store";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { embedMany } from "ai";
import { resolveOpenAIKeyForTenant } from "@/lib/ai/tenant-api-key";

const EMBEDDING_MODEL = "text-embedding-3-small";

/** Uma "página" de conteúdo extraído (de um PDF, slide de PPTX, artigo web, segmento de transcrição, etc.). */
export interface ExtractedPage {
  text: string;
  images: string[]; // data: URIs
}

export interface IngestResult {
  chunksCount: number;
  imagesCount: number;
  sourceId: string;
}

/**
 * Cauda comum da importação inteligente: fragmenta cada página, gera embeddings
 * em lote e grava os chunks em `uploaded_chunks` (RAG usado na geração de cursos).
 * Reutilizada pelo upload de ficheiros (PDF/PPTX/DOCX/TXT) e pelas importações de
 * URL e de transcrição do YouTube — todas produzem o mesmo formato ExtractedPage[].
 *
 * Cada chamada gera um `sourceId` próprio (ou reaproveita um existente, quando se
 * está a substituir um anexo já editado) — permite apagar/substituir precisamente
 * os chunks de um único anexo sem afetar os restantes materiais do briefing.
 */
export async function ingestExtractedPages(
  pages: ExtractedPage[],
  opts: { briefingId: string; tenantId: string; sourceName: string; sourceId?: string }
): Promise<IngestResult> {
  const sourceId = opts.sourceId || randomUUID();
  const pageChunkGroups = pages
    .filter((p) => p.text && p.text.trim())
    .map((p) => ({
      textChunks: chunkText(p.text, 600, 100),
      images: p.images,
    }))
    .filter((g) => g.textChunks.length > 0);

  if (pageChunkGroups.length === 0) {
    return { chunksCount: 0, imagesCount: 0, sourceId };
  }

  const allChunks = pageChunkGroups.flatMap((g) => g.textChunks);

  let embeddings: number[][] = [];
  try {
    // Usa a chave OpenAI da própria empresa quando configurada (o custo de indexar os
    // materiais é da empresa, tal como o resto da geração de cursos) — melhor esforço: sem
    // chave disponível, os chunks continuam a ser gravados, só sem vetor de pesquisa semântica.
    const tenantKey = await resolveOpenAIKeyForTenant(opts.tenantId);
    const provider = tenantKey ? createOpenAI({ apiKey: tenantKey }) : openai;
    const r = await embedMany({
      model: provider.embedding(EMBEDDING_MODEL),
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
        sourceId,
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
  return { chunksCount: docs.length, imagesCount, sourceId };
}

/** Remove todos os chunks de um anexo específico (usado ao apagar ou substituir um anexo editado). */
export async function deleteIngestedSource(briefingId: string, sourceId: string): Promise<number> {
  const db = await getDb();
  const result = await db.collection("uploaded_chunks").deleteMany({ briefingId, sourceId });
  return result.deletedCount || 0;
}
