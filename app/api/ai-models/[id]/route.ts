import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { ObjectId } from "mongodb";

// PATCH — Alterna a visibilidade (público/privado) de um Modelo IA. Só o autor pode gerir.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const { isPublic } = await req.json();
    const db = await getDb();

    const model = await db.collection("ai_models").findOne({ _id: new ObjectId(id) });
    if (!model) {
      return NextResponse.json({ error: "Modelo IA não encontrado." }, { status: 404 });
    }
    if (model.ownerId !== userId) {
      return NextResponse.json({ error: "Apenas o autor pode gerir este Modelo IA." }, { status: 403 });
    }

    await db.collection("ai_models").updateOne(
      { _id: new ObjectId(id) },
      { $set: { isPublic: !!isPublic, updatedAt: new Date() } }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao atualizar Modelo IA:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — Remove o Modelo IA (autor ou ADMIN/SUPORTE) e o respetivo conhecimento indexado.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const activeRole = req.cookies.get("active-role")?.value;
    const db = await getDb();

    const model = await db.collection("ai_models").findOne({ _id: new ObjectId(id) });
    if (!model) {
      return NextResponse.json({ error: "Modelo IA não encontrado." }, { status: 404 });
    }
    const isModerator = activeRole === "ADMIN" || activeRole === "SUPORTE";
    if (model.ownerId !== userId && !isModerator) {
      return NextResponse.json({ error: "Sem permissão para remover este Modelo IA." }, { status: 403 });
    }

    await db.collection("ai_models").deleteOne({ _id: new ObjectId(id) });
    await db.collection("lesson_chunks").deleteMany({ lessonId: `aimodel-${id}` });

    await logAuditEvent(userId, "AI_MODEL_DELETED", { modelId: id, name: model.name });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao remover Modelo IA:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
