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
  | { id: string; type: "heading"; text: string; level: 2 | 3; audioUrl?: string }
  | { id: string; type: "text"; markdown: string; audioUrl?: string }
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
      /** Ramificação opcional: escolher a opção `optionIndex` navega para `nextLessonSlug` em vez da lição seguinte linear. */
      branchTargets?: { optionIndex: number; nextLessonSlug: string }[];
    }
  | { id: string; type: "callout"; style: "info" | "warning" | "tip"; text: string; alternateText?: string }
  | { id: string; type: "code"; language: string; code: string }
  | { id: string; type: "accordion"; items: { id: string; title: string; content: string }[] }
  | { id: string; type: "tabs"; items: { id: string; label: string; content: string }[] }
  | { id: string; type: "flashcards"; cards: { id: string; front: string; back: string }[] }
  | {
      id: string;
      type: "hotspot";
      imageUrl: string;
      points: { id: string; x: number; y: number; label: string; description: string }[];
    }
  | {
      id: string;
      type: "codeLab";
      language: string;
      starterCode: string;
      expectedOutput?: string;
      instructions?: string;
    }
  | {
      id: string;
      type: "terminalLab";
      instructions?: string;
      /** Passos de referência mostrados como guia — apenas indicativos, não bloqueiam a
       * digitação de outros comandos; servem para o aluno saber o que se espera dele. */
      steps: { id: string; description: string; command: string }[];
      /** Validado contra o stdout REAL (via Piston, linguagem bash) de todos os comandos
       * digitados até ao momento, concatenados — tal como no Laboratório de Código. */
      expectedOutput?: string;
    }
  | {
      id: string;
      type: "simulationLab";
      title: string;
      steps: {
        id: string;
        scenario: string;
        choices: { id: string; text: string; feedback: string; isBest: boolean }[];
      }[];
    };

export type LessonBlockType = LessonBlock["type"];

export const BLOCK_TYPE_LABELS: Record<LessonBlockType, string> = {
  heading: "Título",
  text: "Texto",
  image: "Imagem",
  video: "Vídeo",
  quiz: "Quiz",
  callout: "Destaque",
  code: "Código",
  accordion: "Acordeão",
  tabs: "Separadores",
  flashcards: "Cartões de Memória",
  hotspot: "Imagem Interativa",
  codeLab: "Laboratório de Código",
  terminalLab: "Laboratório de Terminal",
  simulationLab: "Simulação Guiada",
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
    case "accordion":
      return { id, type: "accordion", items: [{ id: newBlockId(), title: "Pergunta ou tópico", content: "" }] };
    case "tabs":
      return { id, type: "tabs", items: [{ id: newBlockId(), label: "Separador 1", content: "" }] };
    case "flashcards":
      return { id, type: "flashcards", cards: [{ id: newBlockId(), front: "", back: "" }] };
    case "hotspot":
      return { id, type: "hotspot", imageUrl: "", points: [] };
    case "codeLab":
      return { id, type: "codeLab", language: "python", starterCode: "", instructions: "" };
    case "terminalLab":
      return {
        id,
        type: "terminalLab",
        instructions: "",
        steps: [{ id: newBlockId(), description: "Liste os ficheiros da pasta atual", command: "ls" }],
      };
    case "simulationLab":
      return {
        id,
        type: "simulationLab",
        title: "Nova Simulação",
        steps: [
          {
            id: newBlockId(),
            scenario: "Descreva a situação que o aluno vai enfrentar.",
            choices: [
              { id: newBlockId(), text: "Opção A", feedback: "Explique a consequência desta escolha.", isBest: true },
              { id: newBlockId(), text: "Opção B", feedback: "Explique a consequência desta escolha.", isBest: false },
            ],
          },
        ],
      };
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
/**
 * Remove marcadores de sintaxe Markdown (negrito, itálico, cabeçalhos) que a IA por vezes
 * insere em campos pensados para texto simples — o BlockRenderer não interpreta Markdown,
 * por isso "**texto**" ou "### texto" apareceriam literalmente ao aluno em vez de formatados.
 * Não mexe em hífenes de lista (mantidos, são legíveis tal como estão) nem em blocos "code".
 */
export function stripMarkdownMarkers(text: string): string {
  if (!text) return text;
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, "$1")
    .replace(/(?<!_)_([^_\n]+?)_(?!_)/g, "$1")
    .replace(/\*{2,}/g, "");
}

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
        case "accordion":
          return block.items.map((it) => `**${it.title}**\n${it.content}`).join("\n\n");
        case "tabs":
          return block.items.map((it) => `**${it.label}**\n${it.content}`).join("\n\n");
        case "flashcards":
          return block.cards.map((c) => `**${c.front}** — ${c.back}`).join("\n\n");
        case "hotspot":
          return block.points.map((p) => `**${p.label}:** ${p.description}`).join("\n\n");
        case "codeLab":
          return block.instructions || "";
        case "terminalLab":
          return block.instructions || block.steps.map((s) => s.description).join("\n");
        case "simulationLab":
          return `**${block.title}**\n` + block.steps.map((s) => s.scenario).join("\n\n");
        case "video":
          return "";
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}
