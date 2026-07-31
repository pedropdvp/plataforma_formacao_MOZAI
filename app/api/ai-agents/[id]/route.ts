import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { ObjectId } from "mongodb";

// GET — Detalhe completo de um Agente IA (nome, descrição, categoria e passos), para a ficha
// de "Visualizar"/"Editar". Só o autor pode ver o detalhe de gestão.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDb();
    const agent = await db.collection("ai_agents").findOne({ _id: new ObjectId(id) });
    if (!agent) {
      return NextResponse.json({ error: "Agente IA não encontrado." }, { status: 404 });
    }
    if (agent.ownerId !== userId) {
      return NextResponse.json({ error: "Apenas o autor pode gerir este Agente IA." }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      agent: {
        id: agent._id.toString(),
        name: agent.name,
        description: agent.description,
        category: agent.category,
        steps: agent.steps || [],
        isPublic: agent.isPublic,
        usesCount: agent.usesCount || 0,
        ownerName: agent.ownerName,
        createdAt: agent.createdAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH — Edita um Agente IA: pode alternar a visibilidade (público/privado) e/ou atualizar
// nome, descrição, categoria e passos encadeados. Só o autor pode gerir.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const db = await getDb();

    const agent = await db.collection("ai_agents").findOne({ _id: new ObjectId(id) });
    if (!agent) {
      return NextResponse.json({ error: "Agente IA não encontrado." }, { status: 404 });
    }
    if (agent.ownerId !== userId) {
      return NextResponse.json({ error: "Apenas o autor pode gerir este Agente IA." }, { status: 403 });
    }

    const update: Record<string, any> = { updatedAt: new Date() };

    if (typeof body.isPublic === "boolean") {
      update.isPublic = body.isPublic;
    }

    if (body.name !== undefined || body.description !== undefined || body.category !== undefined || body.steps !== undefined) {
      const name = body.name?.trim();
      const description = body.description?.trim();
      if (!name || !description) {
        return NextResponse.json({ error: "Nome e descrição do Agente são obrigatórios." }, { status: 400 });
      }
      const steps = Array.isArray(body.steps)
        ? body.steps.map((s: any) => ({ title: s.title?.trim() || "", instruction: s.instruction?.trim() || "" })).filter((s: any) => s.title && s.instruction)
        : agent.steps;
      if (!Array.isArray(steps) || steps.length < 2) {
        return NextResponse.json({ error: "Um Agente precisa de pelo menos 2 passos encadeados, cada um com título e instrução." }, { status: 400 });
      }
      update.name = name;
      update.description = description;
      update.category = body.category?.trim() || agent.category;
      update.steps = steps;
    }

    await db.collection("ai_agents").updateOne({ _id: new ObjectId(id) }, { $set: update });

    await logAuditEvent(userId, "AI_AGENT_UPDATED", { agentId: id });

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
