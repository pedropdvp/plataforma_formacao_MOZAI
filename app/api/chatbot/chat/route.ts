import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { resolveOpenAIKeyForTenant } from "@/lib/ai/tenant-api-key";
import { streamChatbotAnswer } from "@/lib/ai/chatbot-engine";
import { getOrCreateConversation, getRecentMessages, addMessage } from "@/lib/chatbot-conversation";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MESSAGE_LEN = 2000;

/**
 * POST — Pergunta do utilizador ao ChatBot; resposta em streaming de texto simples.
 * Disponível a QUALQUER utilizador autenticado (o botão flutuante aparece em todo o
 * dashboard) — não é preciso ter permissão de gestão, só sessão válida.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  const tenantId = req.headers.get("x-tenant-id") || "root";
  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!message) {
    return NextResponse.json({ error: "Mensagem em falta." }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LEN) {
    return NextResponse.json({ error: "Mensagem demasiado longa." }, { status: 400 });
  }

  const conversationId = await getOrCreateConversation(tenantId, userId);
  await addMessage(conversationId, "user", message);

  const apiKey = await resolveOpenAIKeyForTenant(tenantId);
  if (!apiKey) {
    const notice =
      "O ChatBot ainda não está configurado. Peça ao administrador para carregar a base de conhecimento em Configurações > ChatBot.";
    await addMessage(conversationId, "assistant", notice);
    return new Response(notice, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  try {
    const history = (await getRecentMessages(conversationId)).slice(0, -1); // exclui a pergunta atual (já vai como `message`)

    let errorHandled = false;
    const result = await streamChatbotAnswer({
      tenantId,
      history: history.map((m) => ({ role: m.role, content: m.content })),
      message,
      apiKey,
      onFinish: (full) => addMessage(conversationId, "assistant", full),
      onError: () => {
        if (errorHandled) return;
        errorHandled = true;
        return addMessage(
          conversationId,
          "assistant",
          "Ocorreu um erro ao gerar a resposta. Tente novamente dentro de instantes."
        );
      },
    });

    return result.toTextStreamResponse();
  } catch (err: any) {
    console.error("[chatbot] erro ao gerar resposta:", err?.message || err);
    const notice = "Ocorreu um erro ao gerar a resposta. Tente novamente dentro de instantes.";
    await addMessage(conversationId, "assistant", notice);
    return new Response(notice, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
