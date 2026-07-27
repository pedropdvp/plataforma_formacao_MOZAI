import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { listConversations, createConversation } from "@/lib/chatbot-conversation";

/** GET — Lista as conversas do utilizador com o ChatBot (mais recentes/favoritas primeiro). */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  const tenantId = req.headers.get("x-tenant-id") || "root";
  const conversations = await listConversations(tenantId, userId);
  return NextResponse.json({ success: true, conversations });
}

/** POST — Cria uma conversa nova (vazia) e devolve o seu id ("Nova conversa"). */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  const tenantId = req.headers.get("x-tenant-id") || "root";
  const conversationId = await createConversation(tenantId, userId);
  return NextResponse.json({ success: true, conversationId });
}
