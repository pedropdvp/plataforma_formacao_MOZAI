import { getDb } from "../mongodb";
import { openai } from "@ai-sdk/openai";
import { generateObject, embed } from "ai";
import { z } from "zod";
import { LessonBlock, blocksToPlainText, newBlockId } from "../lesson-blocks";

const EMBEDDING_MODEL = "text-embedding-3-small";
const IMAGE_MODEL = "gpt-image-1";

// Esquema Zod do Outline
export const outlineSchema = z.object({
  title: z.string().describe("Título geral do curso"),
  description: z.string().describe("Descrição explicativa do curso"),
  modules: z.array(
    z.object({
      title: z.string().describe("Título do módulo"),
      order: z.number().describe("Ordem numérica do módulo (1-indexed)"),
      lessons: z.array(
        z.object({
          title: z.string().describe("Título da lição"),
          objectives: z.array(z.string()).describe("Lista de 2 a 3 objetivos específicos da lição"),
        })
      ),
    })
  ),
});

// Blocos de conteúdo que o modelo pode gerar diretamente (estruturados, não uma
// única string de Markdown). Blocos que dependem de artefactos reais — "image"
// (extraídas do RAG ou geradas por generateLessonImage) e "quiz" (a partir de
// 'exercises') — são anexados programaticamente depois da geração, não pelo LLM,
// para evitar URLs inventadas e manter o schema simples (1 nível de array-de-objeto,
// evitando o bug conhecido de nested arrays-of-objects a 3+ níveis no ai-sdk).
const aiBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), text: z.string().describe("Texto do título"), level: z.union([z.literal(2), z.literal(3)]).describe("Nível do título (2 = secção principal, 3 = subsecção)") }),
  z.object({ type: z.literal("text"), markdown: z.string().describe("Parágrafo de texto didático, pode conter Markdown simples (negrito, listas, código inline)") }),
  z.object({ type: z.literal("callout"), style: z.enum(["info", "warning", "tip"]).describe("Estilo do destaque"), text: z.string().describe("Texto do destaque (ex: nota importante, aviso, dica prática)") }),
  z.object({ type: z.literal("code"), language: z.string().describe("Linguagem do código (ex: javascript, python)"), code: z.string().describe("Bloco de código de exemplo") }),
]);

// Esquema Zod da Lição Completa
export const lessonContentSchema = z.object({
  blocks: z.array(aiBlockSchema).describe(
    "Conteúdo didático completo da lição, estruturado em blocos: comece com um bloco 'heading' (nível 2) de introdução, " +
    "desenvolva com blocos 'text' (parágrafos), use 'code' quando o curso envolver programação, e 'callout' para notas ou dicas importantes."
  ),
  videoProvider: z.string().describe("O fornecedor de vídeo. Deve ser sempre 'youtube'."),
  videoId: z.string().describe("ID do vídeo do YouTube relevante para a lição. Se não houver vídeo, devolver string vazia."),
  exercises: z.array(
    z.object({
      question: z.string().describe("Pergunta do quiz rápido"),
      options: z.array(z.string()).describe("Lista de 3 a 4 opções de resposta"),
      correctIndex: z.number().describe("Índice base 0 da opção correta"),
    })
  ).describe("Lista de 2 a 3 perguntas de escolha múltipla para fixação"),
  lab: z.string().describe("Uma atividade prática de programação ou laboratório de código guiado correspondente à matéria da lição"),
});

export interface GeneratedLesson {
  content: string; // derivado de 'blocks', mantido para indexação RAG e compatibilidade
  blocks: LessonBlock[];
  videoProvider: string;
  videoId: string;
  exercises: Array<{ question: string; options: string[]; correctIndex: number }>;
  lab: string;
}

/**
 * 1. Gera a estrutura Outline inicial com base no Briefing e contexto opcional
 */
export async function generateOutline(briefing: {
  topic: string;
  level: string;
  duration: string;
  objectives: string;
  targetAudience: string;
}, contextTexts: string[] = []): Promise<z.infer<typeof outlineSchema>> {
  const contextBlock = contextTexts.length > 0
    ? `\nCONTEXTO EXTRAÍDO DOS MATERIAIS ANEXADOS:\n${contextTexts.join("\n---\n")}\n`
    : "";

  const prompt = `
    Crie o esboço (Outline) estruturado de um curso sobre o tema: "${briefing.topic}".
    Nível de Dificuldade: ${briefing.level}
    Duração Planeada: ${briefing.duration}
    Objetivos Principais: ${briefing.objectives}
    Público-alvo: ${briefing.targetAudience}
    ${contextBlock}
    
    A estrutura deve ser pedagógica, dividida logicamente em módulos e lições numeradas. 
    Se houver contexto dos materiais anexados acima, por favor baseie-se principalmente neles para desenhar a ementa do curso.
  `;

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: outlineSchema,
    prompt,
  });

  return object;
}

export interface ContextChunk {
  content: string;
  images?: string[]; // data: URIs extraídos do material original (PDF/PPTX) associados a este trecho
}

/**
 * 2. Gera o conteúdo detalhado de uma lição específica, enriquecida por RAG
 */
export async function generateLesson(
  briefing: { topic: string; level: string; objectives: string },
  lessonTitle: string,
  lessonObjectives: string[],
  contextChunks: ContextChunk[] = []
): Promise<GeneratedLesson> {
  const contextBlock = contextChunks.length > 0
    ? `\nCONTEXTO OFICIAL PARA USO OBRIGATÓRIO (RAG):\n${contextChunks.map((c) => c.content).join("\n---\n")}\n`
    : "";

  const prompt = `
    Crie o conteúdo didático e completo em português para a seguinte lição:
    Curso: "${briefing.topic}"
    Lição: "${lessonTitle}"
    Objetivos Específicos: ${lessonObjectives.join("; ")}
    Nível: ${briefing.level}
    ${contextBlock}

    REGRAS DE CONTEÚDO:
    1. O campo 'blocks' deve conter uma explicação teórica robusta, rica em blocos pedagógicos (título, parágrafos, código, destaques). Se houver o "CONTEXTO OFICIAL" acima, extraia os fatos, definições e conceitos diretamente dele de forma a garantir total fidelidade ao material original do professor.
    2. Use blocos 'code' para exemplos de código se o curso envolver programação.
    3. Crie 2 a 3 perguntas de quiz com as respetivas opções no campo 'exercises'.
    4. Indique uma proposta de laboratório prático de código no campo 'lab'.
  `;

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: lessonContentSchema,
    prompt,
  });

  // Atribuir ids (o LLM não os gera) aos blocos de conteúdo narrativo.
  const blocks: LessonBlock[] = object.blocks.map((b) => ({ ...b, id: newBlockId() }) as LessonBlock);

  // Anexar (programaticamente, não via LLM) as imagens do material original associadas
  // ao contexto usado nesta lição — evita enviar base64 ao modelo (custo/token) e o risco
  // de o LLM corromper a string ao tentar "reproduzir" a imagem.
  const uniqueImages = Array.from(new Set(contextChunks.flatMap((c) => c.images || [])));
  for (const dataUrl of uniqueImages) {
    blocks.push({ id: newBlockId(), type: "image", url: dataUrl, alt: "Imagem do material original" });
  }

  // Inserir os exercícios de quiz também como blocos reais dentro do conteúdo
  // (além de continuarem disponíveis em 'exercises' para a fixação no final da lição).
  for (const ex of object.exercises) {
    blocks.push({
      id: newBlockId(),
      type: "quiz",
      question: ex.question,
      options: ex.options,
      correctIndex: ex.correctIndex,
    });
  }

  return {
    content: blocksToPlainText(blocks),
    blocks,
    videoProvider: object.videoProvider,
    videoId: object.videoId,
    exercises: object.exercises,
    lab: object.lab,
  };
}

/**
 * Gera uma imagem (diagrama/ilustração) para acompanhar uma lição, via API de
 * imagens da OpenAI. Devolve um data URI (base64) pronto a ser carregado para o
 * Vercel Blob e registado na Biblioteca de Media pelo chamador — esta função é
 * propositadamente "pura" (não escreve na base de dados nem no Blob).
 */
export async function generateLessonImage(prompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("generateLessonImage: OPENAI_API_KEY não configurada.");
    return null;
  }

  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt,
        size: "1024x1024",
        n: 1,
      }),
    });

    if (!res.ok) {
      console.warn(`generateLessonImage: OpenAI devolveu ${res.status}: ${await res.text()}`);
      return null;
    }

    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return null;

    return `data:image/png;base64,${b64}`;
  } catch (error: any) {
    console.warn("generateLessonImage: falha ao gerar imagem:", error?.message);
    return null;
  }
}

/**
 * 3. Realiza pesquisa semântica (RAG) nos materiais carregados para um Briefing
 */
export async function searchUploadedMaterials(
  briefingId: string,
  query: string,
  limit = 4
): Promise<ContextChunk[]> {
  try {
    const db = await getDb();
    const col = db.collection("uploaded_chunks");

    // 1. Gerar embedding da pergunta
    let queryEmbedding: number[] | null = null;
    try {
      const r = await embed({
        model: openai.embedding(EMBEDDING_MODEL),
        value: query,
      });
      queryEmbedding = r.embedding;
    } catch (e: any) {
      console.warn("RAG Uploaded: falha ao gerar embedding do query:", e?.message);
    }

    // 2. Tentar Atlas Vector Search
    if (queryEmbedding) {
      try {
        const pipeline = [
          {
            $vectorSearch: {
              index: "vector_index", // Deve existir um índice no Atlas cobrindo uploaded_chunks
              path: "embedding",
              queryVector: queryEmbedding,
              numCandidates: limit * 10,
              limit,
              filter: { briefingId: { $eq: briefingId } },
            },
          },
          { $project: { content: 1, images: 1 } },
        ];
        const rows = await col.aggregate(pipeline).toArray();
        if (rows.length > 0) {
          return rows.map((r: any) => ({ content: r.content, images: r.images || [] }));
        }
      } catch (err: any) {
        console.warn("RAG Uploaded: Vector Search falhou ou indisponível, a usar fallback textual:", err.message);
      }
    }

    // 3. Fallback: Busca textual regular por palavras-chave filtrada pelo briefingId
    const keywords = query
      .toLowerCase()
      .replace(/[^\p{L}\d\s]/gu, "")
      .split(/\s+/)
      .filter((w) => w.length > 3);

    let rows = [];
    if (keywords.length > 0) {
      rows = await col.find({
        briefingId,
        content: { $regex: new RegExp(keywords.join("|"), "i") },
      }).limit(limit).toArray();
    }

    if (rows.length === 0) {
      // Retorna os primeiros chunks inseridos desse briefing como contexto genérico
      rows = await col.find({ briefingId }).limit(limit).toArray();
    }

    return rows.map((r: any) => ({ content: r.content, images: r.images || [] }));
  } catch (error: any) {
    console.error("Erro em searchUploadedMaterials:", error.message);
    return [];
  }
}
