import { openai, createOpenAI } from "@ai-sdk/openai";
import { streamText, generateText, type ModelMessage, type UserContent } from "ai";
import { searchUploadedMaterials } from "@/lib/ai/generator-engine";
import { getChatbotBriefingId } from "@/lib/chatbot-documents";

function resolveOpenAiProvider(apiKey?: string) {
  return apiKey ? createOpenAI({ apiKey }) : openai;
}

const BASE_SYSTEM_PROMPT = `És o assistente virtual da MOZAI, uma plataforma de formação com Inteligência Artificial.
Respondes de forma clara, simpática e concisa.`;

/** Idiomas em que o assistente responde. O português é o de omissão da plataforma. */
export const CHATBOT_LANGS = {
  pt: { label: "Português", instruction: "Responde sempre em Português de Portugal.", voice: "pt-PT" },
  en: { label: "English", instruction: "Always reply in English.", voice: "en-GB" },
  fr: { label: "Français", instruction: "Réponds toujours en français.", voice: "fr-FR" },
} as const;

export type ChatbotLang = keyof typeof CHATBOT_LANGS;

export function isChatbotLang(value: unknown): value is ChatbotLang {
  return typeof value === "string" && value in CHATBOT_LANGS;
}

/**
 * Personas especializadas do assistente — cada uma ajusta o tom e o foco da resposta,
 * mantendo a mesma infraestrutura de RAG, anexos e pesquisa Web já existente.
 */
export const CHATBOT_PERSONAS = {
  assistente: {
    label: "Assistente Geral",
    prompt: BASE_SYSTEM_PROMPT,
  },
  mentor: {
    label: "Mentor",
    prompt: `${BASE_SYSTEM_PROMPT}\nAgora atuas especificamente como Mentor: acompanhas o percurso de aprendizagem do aluno a médio/longo prazo, encorajas o progresso, sugeres a ordem certa de próximos passos e ajudas a manter a motivação.`,
  },
  coach_carreira: {
    label: "Coach de Carreira",
    prompt: `${BASE_SYSTEM_PROMPT}\nAgora atuas especificamente como Coach de Carreira: ajudas o aluno a relacionar o que está a aprender com oportunidades de mercado, entrevistas de emprego e evolução profissional. Sê prático e orientado a resultados.`,
  },
  code_reviewer: {
    label: "Code Reviewer",
    prompt: `${BASE_SYSTEM_PROMPT}\nAgora atuas especificamente como Code Reviewer: quando o utilizador partilhar código, aponta bugs, problemas de legibilidade, más práticas e sugere melhorias concretas, com exemplos de código quando fizer sentido.`,
  },
  examinador: {
    label: "Examinador",
    prompt: `${BASE_SYSTEM_PROMPT}\nAgora atuas especificamente como Examinador: em vez de dar logo a resposta completa, testa o conhecimento do aluno com perguntas de verificação sobre o tema, e só depois confirmas ou corriges o raciocínio dele.`,
  },
} as const;

export type ChatbotPersonaId = keyof typeof CHATBOT_PERSONAS;

const GROUNDED_INSTRUCTIONS = `Usa a informação fornecida no contexto abaixo (conhecimento da plataforma e, quando existir, da
empresa do utilizador, e o conteúdo de qualquer ficheiro anexado) como fonte principal para responder.
Se a resposta não estiver nesse contexto e não tiveres pesquisa na Web disponível, diz claramente que não tens
essa informação disponível e sugere contactar o suporte — nunca inventes factos.`;

const WEB_SEARCH_INSTRUCTIONS = `Tens disponível uma ferramenta de pesquisa na Web — usa-a sempre que a pergunta precisar de
informação atual ou que não esteja no contexto fornecido, e cita as fontes quando o fizeres.`;

/**
 * Gera (em streaming) a resposta do ChatBot a uma pergunta, combinando o conhecimento da
 * plataforma (PDF carregado pelo Admin, âmbito "root") com o da própria empresa do
 * utilizador, quando exista (PDF carregado pelo Gestor de Empresa) — nunca o de outras
 * empresas — mais o conteúdo de um eventual ficheiro anexado e, opcionalmente, pesquisa
 * na Web em tempo real.
 */
export async function streamChatbotAnswer(opts: {
  tenantId: string;
  history: { role: "user" | "assistant"; content: string }[];
  message: string;
  apiKey: string;
  attachmentImage?: string; // data URL (image/png, image/jpeg, image/webp)
  attachmentText?: string; // texto já extraído de um PDF anexado
  attachmentName?: string;
  webSearch?: boolean;
  persona?: ChatbotPersonaId;
  lang?: ChatbotLang;
  /** Resumo da parte antiga da conversa, quando já foi resumida. */
  summary?: string | null;
  /** 0 = determinista, 1 = criativo. Omitido usa o valor por omissão do modelo. */
  temperature?: number;
  onFinish?: (fullText: string, totalTokens: number) => void | Promise<void>;
  onError?: (error: unknown) => void | Promise<void>;
}) {
  const provider = resolveOpenAiProvider(opts.apiKey);
  const contextParts: string[] = [];

  const platformChunks = await searchUploadedMaterials(getChatbotBriefingId("root"), opts.message, 4, opts.apiKey);
  if (platformChunks.length > 0) {
    contextParts.push("--- Conhecimento da Plataforma MOZAI ---\n" + platformChunks.map((c) => c.content).join("\n\n"));
  }

  if (opts.tenantId !== "root") {
    const companyChunks = await searchUploadedMaterials(getChatbotBriefingId(opts.tenantId), opts.message, 4, opts.apiKey);
    if (companyChunks.length > 0) {
      contextParts.push("--- Conhecimento da Empresa do Utilizador ---\n" + companyChunks.map((c) => c.content).join("\n\n"));
    }
  }

  if (opts.attachmentText) {
    contextParts.push(`--- Ficheiro Anexado pelo Utilizador (${opts.attachmentName || "anexo"}) ---\n${opts.attachmentText}`);
  }

  const personaPrompt = CHATBOT_PERSONAS[opts.persona || "assistente"].prompt;
  const instructions = opts.webSearch ? `${GROUNDED_INSTRUCTIONS}\n\n${WEB_SEARCH_INSTRUCTIONS}` : GROUNDED_INSTRUCTIONS;
  const system =
    contextParts.length > 0
      ? `${personaPrompt}\n\n${instructions}\n\nContexto disponível:\n\n${contextParts.join("\n\n")}`
      : `${personaPrompt}\n\n${instructions}${
          opts.webSearch ? "" : "\n\nNão há nenhum contexto carregado ainda — informa o utilizador que a base de conhecimento ainda não foi configurada."
        }`;

  const userContent: UserContent = opts.attachmentImage
    ? [
        { type: "text", text: opts.message || "Descreve o que vês nesta imagem." },
        { type: "image", image: opts.attachmentImage },
      ]
    : opts.message;

  const messages: ModelMessage[] = [
    ...opts.history.map((m) => ({ role: m.role, content: m.content }) as ModelMessage),
    { role: "user", content: userContent },
  ];

  return streamText({
    model: provider("gpt-4o-mini"),
    system,
    messages,
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    tools: opts.webSearch ? { web_search: provider.tools.webSearch() } : undefined,
    onFinish: async ({ text, usage }) => {
      if (text && text.trim()) await opts.onFinish?.(text, usage?.totalTokens || 0);
    },
    onError: async ({ error }) => {
      console.error("[chatbot-engine] erro durante o streaming:", error);
      await opts.onError?.(error);
    },
  });
}

/**
 * Condensa a parte antiga de uma conversa num resumo curto.
 *
 * Serve o custo, não a experiência: em vez de reenviar dezenas de mensagens a cada
 * pergunta, envia-se este parágrafo. Usa o modelo mais barato e um tecto de tokens
 * baixo — um resumo que custasse como a conversa que substitui não resolvia nada.
 *
 * Devolve `null` em caso de falha: ficar sem resumo é aceitável (a conversa continua a
 * funcionar com o histórico recente), rebentar a resposta ao utilizador não é.
 */
export async function summarizeConversation(opts: {
  messages: { role: "user" | "assistant"; content: string }[];
  previousSummary?: string | null;
  lang?: ChatbotLang;
  apiKey: string;
}): Promise<string | null> {
  if (!opts.messages.length) return null;
  const provider = resolveOpenAiProvider(opts.apiKey);
  const transcricao = opts.messages
    .map((m) => `${m.role === "user" ? "Utilizador" : "Assistente"}: ${m.content}`)
    .join("\n");

  try {
    const { text } = await generateText({
      model: provider("gpt-4o-mini"),
      temperature: 0.2,
      maxOutputTokens: 350,
      system: `Resumes conversas para servirem de memória a um assistente.
${CHATBOT_LANGS[opts.lang || "pt"].instruction}
Escreve um parágrafo único e factual com o essencial: o que o utilizador quer, o que já
lhe foi respondido e as decisões ou preferências que ficaram assentes. Não faças
comentários sobre o resumo nem uses listas.`,
      prompt: opts.previousSummary
        ? `Resumo até agora:
${opts.previousSummary}

Novas mensagens a integrar:
${transcricao}`
        : transcricao,
    });
    return text.trim() || null;
  } catch (error) {
    console.error("[chatbot-engine] falha ao resumir a conversa:", error);
    return null;
  }
}
