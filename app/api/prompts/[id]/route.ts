import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { ObjectId } from "mongodb";

// PATCH — Alterna a visibilidade (público/privado) de um Prompt. Só o autor pode gerir.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const { isPublic } = await req.json();
    const db = await getDb();

    const prompt = await db.collection("ai_prompts").findOne({ _id: new ObjectId(id) });
    if (!prompt) {
      return NextResponse.json({ error: "Prompt não encontrado." }, { status: 404 });
    }
    if (prompt.ownerId !== userId) {
      return NextResponse.json({ error: "Apenas o autor pode gerir este Prompt." }, { status: 403 });
    }

    await db.collection("ai_prompts").updateOne(
      { _id: new ObjectId(id) },
      { $set: { isPublic: !!isPublic, updatedAt: new Date() } }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao atualizar Prompt:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — Remove o Prompt (autor ou ADMIN/SUPORTE).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const activeRole = req.cookies.get("active-role")?.value;
    const db = await getDb();

    const prompt = await db.collection("ai_prompts").findOne({ _id: new ObjectId(id) });
    if (!prompt) {
      return NextResponse.json({ error: "Prompt não encontrado." }, { status: 404 });
    }
    const isModerator = activeRole === "ADMIN" || activeRole === "SUPORTE";
    if (prompt.ownerId !== userId && !isModerator) {
      return NextResponse.json({ error: "Sem permissão para remover este Prompt." }, { status: 403 });
    }

    await db.collection("ai_prompts").deleteOne({ _id: new ObjectId(id) });

    await logAuditEvent(userId, "PROMPT_DELETED", { promptId: id, title: prompt.title });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao remover Prompt:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
