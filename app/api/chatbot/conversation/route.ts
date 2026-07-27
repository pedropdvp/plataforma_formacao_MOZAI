import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateConversation, getRecentMessages } from "@/lib/chatbot-conversation";

/** GET — Histórico recente da conversa em curso do utilizador com o ChatBot (para o widget
 * hidratar ao abrir/recarregar a página, mantendo o contexto entre sessões). */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  const tenantId = req.headers.get("x-tenant-id") || "root";
  const conversationId = await getOrCreateConversation(tenantId, userId);
  const messages = await getRecentMessages(conversationId);

  return NextResponse.json({ success: true, messages });
}
