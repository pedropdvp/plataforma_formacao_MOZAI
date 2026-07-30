import { openai, createOpenAI } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";

/**
 * Catálogo real de fornecedores de IA disponíveis no AI Lab. Cada entrada só fica
 * "disponível" (`configured: true`) se a respetiva variável de ambiente existir — nunca
 * fingimos uma resposta de um fornecedor sem chave configurada.
 *
 * DeepSeek e Llama (via Groq) usam a MESMA SDK da OpenAI (`createOpenAI` com `baseURL`
 * próprio), porque ambas expõem APIs compatíveis com o formato OpenAI — não é necessário
 * (nem existe) um pacote dedicado para cada uma.
 */
export interface AiLabProviderDef {
  id: string;
  label: string;
  vendor: string;
  envVar: string;
  isConfigured: () => boolean;
  getModel: () => any;
}

export const AI_LAB_PROVIDERS: AiLabProviderDef[] = [
  {
    id: "openai",
    label: "GPT-4o mini",
    vendor: "OpenAI",
    envVar: "OPENAI_API_KEY",
    isConfigured: () => !!process.env.OPENAI_API_KEY,
    getModel: () => openai("gpt-4o-mini"),
  },
  {
    id: "claude",
    label: "Claude 3.5 Haiku",
    vendor: "Anthropic",
    envVar: "ANTHROPIC_API_KEY",
    isConfigured: () => !!process.env.ANTHROPIC_API_KEY,
    getModel: () => anthropic("claude-3-5-haiku-20241022"),
  },
  {
    id: "gemini",
    label: "Gemini 1.5 Flash",
    vendor: "Google",
    envVar: "GOOGLE_GENERATIVE_AI_API_KEY",
    isConfigured: () => !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    getModel: () => google("gemini-1.5-flash"),
  },
  {
    id: "deepseek",
    label: "DeepSeek Chat",
    vendor: "DeepSeek",
    envVar: "DEEPSEEK_API_KEY",
    isConfigured: () => !!process.env.DEEPSEEK_API_KEY,
    getModel: () =>
      createOpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com/v1" })("deepseek-chat"),
  },
  {
    id: "llama",
    label: "Llama 3.3 70B (via Groq)",
    vendor: "Meta / Groq",
    envVar: "GROQ_API_KEY",
    isConfigured: () => !!process.env.GROQ_API_KEY,
    getModel: () =>
      createOpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" })("llama-3.3-70b-versatile"),
  },
];

export function getAiLabProvider(id: string): AiLabProviderDef | undefined {
  return AI_LAB_PROVIDERS.find((p) => p.id === id);
}
