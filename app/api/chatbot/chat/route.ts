import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { resolveOpenAIKeyForTenant } from "@/lib/ai/tenant-api-key";
import { streamChatbotAnswer, CHATBOT_PERSONAS, type ChatbotPersonaId } from "@/lib/ai/chatbot-engine";
import { extractPdfContent } from "@/lib/pdf-extract";
import {
  createConversation,
  getOwnedConversation,
  getRecentMessages,
  addMessage,
  setTitleIfEmpty,
} from "@/lib/chatbot-conversation";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MESSAGE_LEN = 2000;
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

function buildErrorNotice(error: unknown): string {
  if (isOpenAIQuotaError(error)) {
    return "Ocorreu um erro ao gerar a resposta. Necessário adicionar crédito à conta da API na OpenAI.";
  }
  return "Ocorreu um erro ao gerar a resposta. Tente novamente dentro de instantes.";
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
  await addMessage(conversationId, "user", storedMessage);
  await setTitleIfEmpty(conversationId, storedMessage);

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
    const history = (await getRecentMessages(conversationId)).slice(0, -1); // exclui a pergunta atual (já vai como `message`)

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
      onFinish: (full, totalTokens) => addMessage(conversationId, "assistant", full, totalTokens),
      onError: (error) => {
        if (errorHandled) return;
        errorHandled = true;
        return addMessage(conversationId, "assistant", buildErrorNotice(error));
      },
    });

    return result.toTextStreamResponse({ headers: { "X-Conversation-Id": conversationId } });
  } catch (err: any) {
    console.error("[chatbot] erro ao gerar resposta:", err?.message || err);
    const notice = buildErrorNotice(err);
    await addMessage(conversationId, "assistant", notice);
    return new Response(notice, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Conversation-Id": conversationId },
    });
  }
}
