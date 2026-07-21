import { getDb } from "./mongodb";
import { openai } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";

// Modelo padrão de embeddings recomendados
const EMBEDDING_MODEL = "text-embedding-3-small";

interface ChunkDoc {
  tenant_id: string;
  courseId: string;
  lessonId: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
  createdAt: Date;
}

/**
 * Fragmenta um texto longo em chunks respeitando os limites de sentenças (Semantic Chunking).
 * Evita partir frases importantes a meio e preserva o contexto.
 */
export function chunkText(text: string, maxChunkSize = 800, overlap = 150): string[] {
  if (!text) return [];

  // Dividir o texto em sentenças mantendo a pontuação final (. ? !)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  
  let currentChunk: string[] = [];
  let currentLength = 0;
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;

    const sentenceLength = trimmedSentence.split(/\s+/).length;

    // Se adicionar esta sentença ultrapassar o tamanho máximo do chunk
    if (currentLength + sentenceLength > maxChunkSize) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(" ").trim());
      }
      
      // Iniciar novo chunk mantendo sobreposição (sliding window) das últimas palavras
      const wordsInLastChunk = currentChunk.join(" ").split(/\s+/);
      const overlapWords = wordsInLastChunk.slice(-Math.min(overlap, wordsInLastChunk.length));
      currentChunk = [...overlapWords, trimmedSentence];
      currentLength = overlapWords.length + sentenceLength;
    } else {
      currentChunk.push(trimmedSentence);
      currentLength += sentenceLength;
    }
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(" ").trim());
  }
  
  return chunks;
}

/**
 * Gera embeddings e guarda os chunks de uma lição no MongoDB, garantindo isolamento de tenant.
 */
export async function indexLessonContent(
  tenantId: string,
  courseId: string,
  lessonId: string,
  plainText: string
) {
  const db = await getDb();
  
  // 1. Fragmentar usando o novo algoritmo de Semantic Chunking
  const textChunks = chunkText(plainText);
  if (textChunks.length === 0) return;

  // 2. Limpar chunks antigos desta lição para evitar duplicações
  await db.collection("lesson_chunks").deleteMany({
    tenant_id: tenantId,
    lessonId: lessonId,
  });

  try {
    // 3. Gerar embeddings em lote usando a Vercel AI SDK
    const { embeddings } = await embedMany({
      model: openai.embedding(EMBEDDING_MODEL),
      values: textChunks,
    });

    // 4. Preparar documentos tipados para inserção
    const documents: ChunkDoc[] = textChunks.map((chunkText, idx) => ({
      tenant_id: tenantId,
      courseId,
      lessonId,
      chunkIndex: idx,
      content: chunkText,
      embedding: embeddings[idx],
      createdAt: new Date(),
    }));

    // 5. Salvar na coleção
    await db.collection("lesson_chunks").insertMany(documents);
  } catch (error) {
    console.error("Erro ao indexar conteúdo da lição no Vector Store:", error);
    throw error;
  }
}

/**
 * Realiza pesquisa semântica (Vector Search) baseada no input do aluno.
 * OTIMIZAÇÃO: Usa pré-filtro (filter parameter) dentro do estágio $vectorSearch para
 * garantir máxima eficiência e isolamento rigoroso de inquilino (Tenant Isolation).
 */
export async function searchRelevantContext(
  tenantId: string,
  courseId: string,
  query: string,
  limit = 3
): Promise<string[]> {
  const db = await getDb();
  const col = db.collection("lesson_chunks");

  // 1. Gerar embedding da pergunta (se a OpenAI falhar, seguimos para fallback textual)
  let embedding: number[] | null = null;
  try {
    const r = await embed({ model: openai.embedding(EMBEDDING_MODEL), value: query });
    embedding = r.embedding;
  } catch (e: any) {
    console.warn("RAG: falha ao gerar embedding da pergunta:", e?.message);
  }

  // Executa o Atlas Vector Search com um filtro específico
  const runVector = async (filter: any): Promise<string[]> => {
    if (!embedding) return [];
    try {
      const pipeline = [
        {
          $vectorSearch: {
            index: "vector_index",
            path: "embedding",
            queryVector: embedding,
            numCandidates: limit * 10,
            limit,
            filter,
          },
        },
        { $project: { content: 1, score: { $meta: "vectorSearchScore" } } },
      ];
      const rows = await col.aggregate(pipeline).toArray();
      return rows.map((r: any) => r.content);
    } catch (e: any) {
      console.warn("RAG: Vector Search indisponível:", e?.message);
      return [];
    }
  };

  const normalizedCourseIds = (courseId === "course-criptomoedas-n1" || courseId === "course-4")
    ? ["course-criptomoedas-n1", "course-4"]
    : [courseId];

  // 2. Pesquisa com âmbito do curso (tenant + courseId)
  let results = await runVector({
    $and: [{ tenant_id: { $eq: tenantId } }, { courseId: { $in: normalizedCourseIds } }],
  });

  // 3. Fallback tenant-wide: se o curso não tiver chunks (ex.: courseId errado),
  //    responde a partir de qualquer conteúdo do MESMO tenant (mantém isolamento).
  if (results.length === 0) {
    results = await runVector({ tenant_id: { $eq: tenantId } });
    if (results.length > 0) {
      console.warn(`RAG: sem chunks para courseId="${courseId}"; usado fallback tenant-wide (tenant="${tenantId}").`);
    }
  }

  // 4. Fallback final sem vetores: pesquisa textual baseada em keywords para o mesmo curso e tenant
  if (results.length === 0) {
    try {
      const keywords = query
        .toLowerCase()
        .replace(/[^\p{L}\d\s]/gu, "")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !["sobre", "como", "fazer", "porque", "minha", "quais", "posso", "ajuda", "explica", "explica-me"].includes(w));

      let rows = [];
      if (keywords.length > 0) {
        // Tenta buscar chunks do mesmo curso e inquilino contendo qualquer uma das palavras-chave
        rows = await col.find({
          tenant_id: tenantId,
          courseId: { $in: normalizedCourseIds },
          content: { $regex: new RegExp(keywords.join("|"), "i") }
        }).limit(limit).toArray();
      }

      // Se não encontrou nenhuma palavra-chave, faz fallback para quaisquer chunks do mesmo curso
      if (rows.length === 0) {
        rows = await col.find({
          tenant_id: tenantId,
          courseId: { $in: normalizedCourseIds }
        }).limit(limit).toArray();
      }

      // Caso ainda esteja vazio (curso sem chunks), faz o fallback geral por tenant
      if (rows.length === 0) {
        rows = await col.find({ tenant_id: tenantId }).limit(limit).toArray();
      }

      results = rows.map((r: any) => r.content);
    } catch (e: any) {
      console.warn("RAG: fallback direto falhou:", e?.message);
    }
  }

  console.log(`RAG search → tenant="${tenantId}" course="${courseId}" hits=${results.length}`);
  return results;
}
