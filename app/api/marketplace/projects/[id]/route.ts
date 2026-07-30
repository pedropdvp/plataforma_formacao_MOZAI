import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { ObjectId } from "mongodb";

// PATCH — Marca o projeto como concluído ou reabre-o. Só o autor pode gerir o estado.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const { status } = await req.json();
    if (!["open", "in_progress", "completed"].includes(status)) {
      return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
    }

    const db = await getDb();
    const project = await db.collection("marketplace_projects").findOne({ _id: new ObjectId(id) });
    if (!project) {
      return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
    }
    if (project.posterId !== userId) {
      return NextResponse.json({ error: "Apenas o autor pode gerir este projeto." }, { status: 403 });
    }

    await db.collection("marketplace_projects").updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao atualizar Projeto do Marketplace:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — Remove o projeto e as respetivas propostas (autor ou ADMIN/SUPORTE).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const activeRole = req.cookies.get("active-role")?.value;
    const db = await getDb();

    const project = await db.collection("marketplace_projects").findOne({ _id: new ObjectId(id) });
    if (!project) {
      return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
    }
    const isModerator = activeRole === "ADMIN" || activeRole === "SUPORTE";
    if (project.posterId !== userId && !isModerator) {
      return NextResponse.json({ error: "Sem permissão para remover este projeto." }, { status: 403 });
    }

    await db.collection("marketplace_projects").deleteOne({ _id: new ObjectId(id) });
    await db.collection("marketplace_project_proposals").deleteMany({ projectId: id });

    await logAuditEvent(userId, "MARKETPLACE_PROJECT_DELETED", { projectId: id, title: project.title });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao remover Projeto do Marketplace:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
