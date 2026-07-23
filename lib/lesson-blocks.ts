/**
 * Modelo de conteúdo em blocos para lições (Fábrica de Cursos).
 * Cada lição tem um array `blocks[]` — o mesmo array é usado no editor
 * (components/lesson-blocks/BlockEditor.tsx) e no visualizador do aluno
 * (components/lesson-blocks/BlockRenderer.tsx), garantindo consistência.
 *
 * Lições antigas (só com `content: string` em Markdown) continuam a funcionar:
 * `migrateMarkdownToBlocks()` converte-as num único bloco de texto na primeira
 * abertura no editor, e o visualizador do aluno já sabia processar `content`
 * como fallback quando `blocks` não existir.
 */

export type LessonBlock =
  | { id: string; type: "heading"; text: string; level: 2 | 3 }
  | { id: string; type: "text"; markdown: string }
  | { id: string; type: "image"; url: string; alt?: string; caption?: string }
  | {
      id: string;
      type: "video";
      provider: "mux" | "youtube";
      videoId?: string;
      uploadId?: string;
      status?: "processing" | "ready" | "error";
    }
  | {
      id: string;
      type: "quiz";
      question: string;
      options: string[];
      correctIndex: number;
      explanation?: string;
    }
  | { id: string; type: "callout"; style: "info" | "warning" | "tip"; text: string }
  | { id: string; type: "code"; language: string; code: string };

export type LessonBlockType = LessonBlock["type"];

export const BLOCK_TYPE_LABELS: Record<LessonBlockType, string> = {
  heading: "Título",
  text: "Texto",
  image: "Imagem",
  video: "Vídeo",
  quiz: "Quiz",
  callout: "Destaque",
  code: "Código",
};

export function newBlockId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `block-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Cria um bloco vazio/exemplo para o tipo indicado, pronto a ser inserido no editor.
 */
export function createEmptyBlock(type: LessonBlockType): LessonBlock {
  const id = newBlockId();
  switch (type) {
    case "heading":
      return { id, type: "heading", text: "Novo título", level: 2 };
    case "text":
      return { id, type: "text", markdown: "" };
    case "image":
      return { id, type: "image", url: "", alt: "" };
    case "video":
      return { id, type: "video", provider: "youtube", videoId: "" };
    case "quiz":
      return { id, type: "quiz", question: "", options: ["", ""], correctIndex: 0 };
    case "callout":
      return { id, type: "callout", style: "info", text: "" };
    case "code":
      return { id, type: "code", language: "javascript", code: "" };
  }
}

/** Deteta uma tag markdown de imagem isolada num parágrafo: ![alt](data:image/...;base64,...) */
const MARKDOWN_IMAGE_RE = /^!\[([^\]]*)\]\((data:image\/[a-zA-Z0-9+.-]+;base64,[^)]+)\)$/;

/**
 * Converte o campo `content` legado (string Markdown, com possíveis imagens
 * embutidas como tags markdown vindas do RAG de PDF/PPTX) num array de blocos.
 * Cada parágrafo vira um bloco `text`; uma linha que seja só uma imagem markdown
 * vira um bloco `image` real.
 */
export function migrateMarkdownToBlocks(content: string): LessonBlock[] {
  if (!content || !content.trim()) return [];

  const paragraphs = content.split("\n\n");
  const blocks: LessonBlock[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    const imageMatch = trimmed.match(MARKDOWN_IMAGE_RE);
    if (imageMatch) {
      blocks.push({ id: newBlockId(), type: "image", url: imageMatch[2], alt: imageMatch[1] });
      continue;
    }

    blocks.push({ id: newBlockId(), type: "text", markdown: trimmed });
  }

  return blocks;
}

/**
 * Devolve os blocos de uma lição, migrando automaticamente conteúdo legado
 * (só `content` string) da primeira vez que é aberta no editor de blocos.
 */
export function getOrMigrateBlocks(lesson: { blocks?: LessonBlock[]; content?: string }): LessonBlock[] {
  if (lesson.blocks && lesson.blocks.length > 0) return lesson.blocks;
  return migrateMarkdownToBlocks(lesson.content || "");
}

/**
 * Achata um array de blocos num texto plano em Markdown — usado para manter o
 * campo `content` legado (indexação RAG, pesquisa textual, compatibilidade com
 * consumidores que ainda esperam uma string) sincronizado com `blocks`, que passa
 * a ser a fonte de verdade do conteúdo gerado por IA.
 */
export function blocksToPlainText(blocks: LessonBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return `${"#".repeat(block.level)} ${block.text}`;
        case "text":
          return block.markdown;
        case "callout":
          return block.text;
        case "code":
          return "```" + block.language + "\n" + block.code + "\n```";
        case "image":
          return `![${block.alt || ""}](${block.url})`;
        case "quiz":
          return `**Pergunta:** ${block.question}`;
        case "video":
          return "";
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}
