import { openai, createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";
import { searchUploadedMaterials } from "@/lib/ai/generator-engine";
import { getChatbotBriefingId } from "@/lib/chatbot-documents";

function resolveOpenAiProvider(apiKey?: string) {
  return apiKey ? createOpenAI({ apiKey }) : openai;
}

const SYSTEM_PROMPT = `És o assistente virtual da MOZAI, uma plataforma de formação com Inteligência Artificial.
Respondes sempre em Português de Portugal, de forma clara, simpática e concisa.
Usa APENAS a informação fornecida no contexto abaixo (conhecimento da plataforma e, quando existir, da empresa do utilizador) para responder.
Se a resposta não estiver no contexto fornecido, diz claramente que não tens essa informação disponível e sugere contactar o suporte — nunca inventes factos.`;

/**
 * Gera (em streaming) a resposta do ChatBot a uma pergunta, combinando o conhecimento da
 * plataforma (PDF carregado pelo Admin, âmbito "root") com o da própria empresa do
 * utilizador, quando exista (PDF carregado pelo Gestor de Empresa) — nunca o de outras
 * empresas. Sem chave de API disponível, devolve null (o chamador decide a mensagem).
 */
export async function streamChatbotAnswer(opts: {
  tenantId: string;
  history: { role: "user" | "assistant"; content: string }[];
  message: string;
  apiKey: string;
  onFinish?: (fullText: string) => void | Promise<void>;
  onError?: (error: unknown) => void | Promise<void>;
}) {
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

  const system =
    contextParts.length > 0
      ? `${SYSTEM_PROMPT}\n\nContexto disponível:\n\n${contextParts.join("\n\n")}`
      : `${SYSTEM_PROMPT}\n\nNão há nenhum contexto carregado ainda — informa o utilizador que a base de conhecimento ainda não foi configurada.`;

  const messages: ModelMessage[] = [
    ...opts.history.map((m) => ({ role: m.role, content: m.content }) as ModelMessage),
    { role: "user", content: opts.message },
  ];

  return streamText({
    model: resolveOpenAiProvider(opts.apiKey)("gpt-4o-mini"),
    system,
    messages,
    onFinish: async ({ text }) => {
      if (text && text.trim()) await opts.onFinish?.(text);
    },
    onError: async ({ error }) => {
      console.error("[chatbot-engine] erro durante o streaming:", error);
      await opts.onError?.(error);
    },
  });
}
