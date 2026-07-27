import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOwnedConversation, getAllMessages, renameConversation, setFavorite, deleteConversation } from "@/lib/chatbot-conversation";

/** GET — Mensagens completas de uma conversa (só se pertencer ao próprio utilizador/tenant). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  const { id } = await params;
  const tenantId = req.headers.get("x-tenant-id") || "root";
  const conv = await getOwnedConversation(id, tenantId, userId);
  if (!conv) {
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }

  const messages = await getAllMessages(id);
  return NextResponse.json({ success: true, conversation: { id, title: conv.title, favorite: conv.favorite }, messages });
}

/** PATCH — Renomeia e/ou marca como favorita. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  const { id } = await params;
  const tenantId = req.headers.get("x-tenant-id") || "root";
  const conv = await getOwnedConversation(id, tenantId, userId);
  if (!conv) {
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  let changed = false;
  if (typeof body.title === "string" && body.title.trim()) {
    changed = (await renameConversation(id, tenantId, userId, body.title.trim())) || changed;
  }
  if (typeof body.favorite === "boolean") {
    changed = (await setFavorite(id, tenantId, userId, body.favorite)) || changed;
  }

  return NextResponse.json({ success: true, changed });
}

/** DELETE — Apaga a conversa e todas as suas mensagens. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  const { id } = await params;
  const tenantId = req.headers.get("x-tenant-id") || "root";
  const deleted = await deleteConversation(id, tenantId, userId);
  if (!deleted) {
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
