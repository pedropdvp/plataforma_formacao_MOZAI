import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { resolveOpenAIKeyForTenant } from "@/lib/ai/tenant-api-key";
import {
  streamChatbotAnswer,
  summarizeConversation,
  CHATBOT_PERSONAS,
  isChatbotLang,
  type ChatbotPersonaId,
  type ChatbotLang,
} from "@/lib/ai/chatbot-engine";
import { extractPdfContent } from "@/lib/pdf-extract";
import {
  createConversation,
  getOwnedConversation,
  getRecentMessages,
  addMessage,
  setTitleIfEmpty,
  getConversationState,
  getMessagesAfter,
  setSummary,
  deleteLastAssistantMessage,
} from "@/lib/chatbot-conversation";
import { getCachedAnswer, putCachedAnswer, isCacheable } from "@/lib/chatbot-cache";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MESSAGE_LEN = 2000;
/** Acima de quantas mensagens por resumir se condensa a parte antiga da conversa. */
const SUMMARY_TRIGGER = Number(process.env.CHATBOT_SUMMARY_TRIGGER || 16);
/** Quantas mensagens recentes ficam sempre fora do resumo, para o contexto imediato não
 *  se perder numa paráfrase. */
const SUMMARY_KEEP = Number(process.env.CHATBOT_SUMMARY_KEEP || 8);
const ALLOWED_FILE_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const MAX_FILE_B64 = 3_800_000; // ~2.8 MB de ficheiro original

interface ChatFile {
  name: string;
  mimeType: string;
  data: string; // base64, sem o prefixo "data:...;base64,"
}

/**
 * Deteta especificamente o erro de quota/crédito esgotado da OpenAI (HTTP 429 insufficient_quota).
 * Quando as tentativas automáticas do AI SDK se esgotam, o erro original vem envolvido num
 * RetryError (propriedade "errors": array de APICallError) — por isso a verificação percorre
 * também os erros aninhados, não só o objeto de topo.
 */
function isOpenAIQuotaError(error: unknown): boolean {
  const seen: any[] = [];
  const collect = (e: any, depth = 0) => {
    if (!e || depth > 4 || seen.includes(e)) return;
    seen.push(e);
    if (Array.isArray(e.errors)) e.errors.forEach((sub: any) => collect(sub, depth + 1));
    if (e.lastError) collect(e.lastError, depth + 1);
    if (e.cause) collect(e.cause, depth + 1);
  };
  collect(error);

  return seen.some((e) => {
    if (e?.statusCode === 429) return true;
    const text = JSON.stringify(e?.data ?? e?.responseBody ?? e?.message ?? e?.reason ?? "").toLowerCase();
    return text.includes("insufficient_quota") || text.includes("exceeded your current quota");
  });
}

/** A forma dos erros do AI SDK que aqui interessa inspeccionar. */
interface ErroDoModelo {
  statusCode?: number;
  data?: unknown;
  responseBody?: unknown;
  message?: unknown;
}

/** Um problema de chave/configuração — distinto de falta de crédito, e com outra solução. */
function isOpenAIAuthError(error: unknown): boolean {
  const e = (error || {}) as ErroDoModelo;
  const texto = JSON.stringify(e.data ?? e.responseBody ?? e.message ?? "").toLowerCase();
  return e.statusCode === 401 || e.statusCode === 403 || texto.includes("invalid_api_key") || texto.includes("api key");
}

/**
 * Mensagens de erro que o utilizador possa ler.
 *
 * Um 429 cru da OpenAI não diz nada a um aluno, e expor a mensagem interna do fornecedor
 * é dar detalhes de infraestrutura a quem não os deve ver. Três categorias chegam: falta
 * de crédito, problema de configuração, e o resto.
 */
function buildErrorNotice(error: unknown, lang: ChatbotLang = "pt"): string {
  const msgs = {
    pt: {
      quota: "Ocorreu um erro ao gerar a resposta. Necessário adicionar crédito à conta da API na OpenAI.",
      auth: "Há um problema de configuração do serviço. Por favor contacte o administrador da plataforma.",
      generic: "Ocorreu um erro ao gerar a resposta. Tente novamente dentro de instantes.",
    },
    en: {
      quota: "I could not generate the reply: the OpenAI API account needs credit.",
      auth: "There is a service configuration problem. Please contact the platform administrator.",
      generic: "An error occurred while generating the reply. Please try again shortly.",
    },
    fr: {
      quota: "Impossible de générer la réponse : le compte de l'API OpenAI a besoin de crédit.",
      auth: "Il y a un problème de configuration du service. Veuillez contacter l'administrateur.",
      generic: "Une erreur est survenue lors de la génération de la réponse. Veuillez réessayer.",
    },
  } as const;

  const t = msgs[lang] || msgs.pt;
  if (isOpenAIQuotaError(error)) return t.quota;
  if (isOpenAIAuthError(error)) return t.auth;
  return t.generic;
}

function validateFile(file: any): ChatFile | null {
  if (!file || typeof file !== "object") return null;
  const mimeType = String(file.mimeType || "");
  const data = typeof file.data === "string" ? file.data : "";
  if (!ALLOWED_FILE_TYPES.includes(mimeType)) return null;
  if (!data || data.length > MAX_FILE_B64) return null;
  return { name: String(file.name || "ficheiro"), mimeType, data };
}

/**
 * POST — Pergunta do utilizador ao ChatBot; resposta em streaming de texto simples.
 * Disponível a QUALQUER utilizador autenticado (o botão flutuante aparece em todo o
 * dashboard) — não é preciso ter permissão de gestão, só sessão válida. Suporta anexar
 * uma imagem (visão) ou um PDF (texto extraído e usado como contexto), e opcionalmente
 * pesquisa na Web em tempo real.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  const tenantId = req.headers.get("x-tenant-id") || "root";
  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const webSearch = body.webSearch === true;
  const file = validateFile(body.file);
  const persona: ChatbotPersonaId = body.persona in CHATBOT_PERSONAS ? body.persona : "assistente";
  const lang: ChatbotLang = isChatbotLang(body.lang) ? body.lang : "pt";
  const regenerate = body.regenerate === true;
  // Criatividade opcional. Fora de 0..1 é fixada no intervalo em vez de recusada: um
  // valor absurdo vindo do cliente não deve impedir a resposta.
  const temperature =
    typeof body.temperature === "number" && Number.isFinite(body.temperature)
      ? Math.min(1, Math.max(0, body.temperature))
      : undefined;

  if (!message && !file) {
    return NextResponse.json({ error: "Mensagem em falta." }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LEN) {
    return NextResponse.json({ error: "Mensagem demasiado longa." }, { status: 400 });
  }

  let conversationId: string;
  if (typeof body.conversationId === "string" && body.conversationId) {
    const owned = await getOwnedConversation(body.conversationId, tenantId, userId);
    if (!owned) {
      return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
    }
    conversationId = body.conversationId;
  } else {
    conversationId = await createConversation(tenantId, userId);
  }

  const storedMessage = file ? (message ? `${message} [anexo: ${file.name}]` : `[anexo: ${file.name}]`) : message;

  if (regenerate) {
    // A pergunta já está guardada de quando foi feita — só se apaga a resposta anterior,
    // para a nova ocupar o lugar dela em vez de a conversa ficar com duas seguidas.
    await deleteLastAssistantMessage(conversationId);
  } else {
    await addMessage(conversationId, "user", storedMessage);
    await setTitleIfEmpty(conversationId, storedMessage);
  }

  const apiKey = await resolveOpenAIKeyForTenant(tenantId);
  if (!apiKey) {
    const notice =
      "O ChatBot ainda não está configurado. Peça ao administrador para carregar a base de conhecimento em Configurações > ChatBot.";
    await addMessage(conversationId, "assistant", notice);
    return new Response(notice, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Conversation-Id": conversationId },
    });
  }

  // Anexo: imagem vai como conteúdo multimodal (visão); PDF tem o texto extraído e usado
  // como contexto adicional — nenhum dos dois é guardado na base de dados, só usado neste turno.
  let attachmentImage: string | undefined;
  let attachmentText: string | undefined;
  if (file) {
    if (file.mimeType === "application/pdf") {
      try {
        const buffer = Buffer.from(file.data, "base64");
        const pages = await extractPdfContent(buffer);
        attachmentText = pages.map((p) => p.text).join("\n\n").trim() || undefined;
      } catch (err: any) {
        console.warn("[chatbot] falha ao extrair texto do PDF anexado:", err?.message || err);
      }
    } else {
      attachmentImage = `data:${file.mimeType};base64,${file.data}`;
    }
  }

  try {
    // Memória da conversa: o que já foi resumido entra como `summary`; o resto vai como
    // histórico, limitado a MAX_HISTORY. Ao regenerar, a última pergunta continua na lista
    // (não foi apagada) e tem de sair, senão ia duas vezes ao modelo.
    const { summary } = await getConversationState(conversationId);
    const recentes = await getRecentMessages(conversationId);
    const history = recentes.filter((m, i) => !(i === recentes.length - 1 && m.role === "user"));

    const podeUsarCache = isCacheable({
      historyLength: history.length,
      hasSummary: !!summary,
      hasAttachment: !!file,
      webSearch,
      regenerate,
      message,
    });

    if (podeUsarCache) {
      const cached = await getCachedAnswer(tenantId, lang, message);
      if (cached) {
        await addMessage(conversationId, "assistant", cached, 0);
        return new Response(cached, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Conversation-Id": conversationId,
            "X-Chatbot-Cached": "1",
          },
        });
      }
    }

    let errorHandled = false;
    const result = await streamChatbotAnswer({
      tenantId,
      history: history.map((m) => ({ role: m.role, content: m.content })),
      message,
      apiKey,
      attachmentImage,
      attachmentText,
      attachmentName: file?.name,
      webSearch,
      persona,
      lang,
      summary,
      temperature,
      onFinish: async (full, totalTokens) => {
        await addMessage(conversationId, "assistant", full, totalTokens);
        if (podeUsarCache) await putCachedAnswer(tenantId, lang, message, full);
        // O resumo corre depois de a resposta já ter sido servida — nunca a atrasa.
        await maybeSummarize(conversationId, lang, apiKey);
      },
      onError: (error) => {
        if (errorHandled) return;
        errorHandled = true;
        return addMessage(conversationId, "assistant", buildErrorNotice(error, lang));
      },
    });

    return result.toTextStreamResponse({ headers: { "X-Conversation-Id": conversationId } });
  } catch (err: any) {
    console.error("[chatbot] erro ao gerar resposta:", err?.message || err);
    const notice = buildErrorNotice(err, lang);
    await addMessage(conversationId, "assistant", notice);
    return new Response(notice, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Conversation-Id": conversationId },
    });
  }
}

/**
 * Se a conversa acumulou mensagens a mais por resumir, condensa as mais antigas e guarda
 * o resumo — as perguntas seguintes passam a enviar esse parágrafo em vez de dezenas de
 * mensagens.
 *
 * Falhar aqui é aceitável e por isso o erro é engolido: a conversa continua a funcionar
 * com o histórico recente, e rebentar depois de a resposta já ter sido enviada ao
 * utilizador não corrigiria nada.
 */
async function maybeSummarize(conversationId: string, lang: ChatbotLang, apiKey: string): Promise<void> {
  try {
    const { summary, summarizedUntil } = await getConversationState(conversationId);
    const pendentes = await getMessagesAfter(conversationId, summarizedUntil);
    if (pendentes.length <= SUMMARY_TRIGGER) return;

    const aResumir = pendentes.slice(0, pendentes.length - SUMMARY_KEEP);
    if (!aResumir.length) return;

    const novo = await summarizeConversation({
      messages: aResumir.map((m) => ({ role: m.role, content: m.content })),
      previousSummary: summary,
      lang,
      apiKey,
    });
    if (novo) await setSummary(conversationId, novo, aResumir[aResumir.length - 1].createdAt);
  } catch (error) {
    console.error("[chatbot] falha na sumarização:", error);
  }
}
