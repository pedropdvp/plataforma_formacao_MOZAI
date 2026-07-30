import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { ObjectId } from "mongodb";

// PATCH — Alterna a visibilidade (público/privado) de um Agente IA. Só o autor pode gerir.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const { isPublic } = await req.json();
    const db = await getDb();

    const agent = await db.collection("ai_agents").findOne({ _id: new ObjectId(id) });
    if (!agent) {
      return NextResponse.json({ error: "Agente IA não encontrado." }, { status: 404 });
    }
    if (agent.ownerId !== userId) {
      return NextResponse.json({ error: "Apenas o autor pode gerir este Agente IA." }, { status: 403 });
    }

    await db.collection("ai_agents").updateOne({ _id: new ObjectId(id) }, { $set: { isPublic: !!isPublic, updatedAt: new Date() } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao atualizar Agente IA:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — Remove o Agente IA (autor ou ADMIN/SUPORTE).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const activeRole = req.cookies.get("active-role")?.value;
    const db = await getDb();

    const agent = await db.collection("ai_agents").findOne({ _id: new ObjectId(id) });
    if (!agent) {
      return NextResponse.json({ error: "Agente IA não encontrado." }, { status: 404 });
    }
    const isModerator = activeRole === "ADMIN" || activeRole === "SUPORTE";
    if (agent.ownerId !== userId && !isModerator) {
      return NextResponse.json({ error: "Sem permissão para remover este Agente IA." }, { status: 403 });
    }

    await db.collection("ai_agents").deleteOne({ _id: new ObjectId(id) });

    await logAuditEvent(userId, "AI_AGENT_DELETED", { agentId: id, name: agent.name });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao remover Agente IA:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
