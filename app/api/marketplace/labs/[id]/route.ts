import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { ObjectId } from "mongodb";

// PATCH — Alterna a visibilidade (público/privado) de um Laboratório. Só o autor pode gerir.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const { isPublic } = await req.json();
    const db = await getDb();

    const lab = await db.collection("marketplace_labs").findOne({ _id: new ObjectId(id) });
    if (!lab) {
      return NextResponse.json({ error: "Laboratório não encontrado." }, { status: 404 });
    }
    if (lab.ownerId !== userId) {
      return NextResponse.json({ error: "Apenas o autor pode gerir este Laboratório." }, { status: 403 });
    }

    await db.collection("marketplace_labs").updateOne(
      { _id: new ObjectId(id) },
      { $set: { isPublic: !!isPublic, updatedAt: new Date() } }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao atualizar Laboratório:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — Remove o Laboratório (autor ou ADMIN/SUPORTE).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const activeRole = req.cookies.get("active-role")?.value;
    const db = await getDb();

    const lab = await db.collection("marketplace_labs").findOne({ _id: new ObjectId(id) });
    if (!lab) {
      return NextResponse.json({ error: "Laboratório não encontrado." }, { status: 404 });
    }
    const isModerator = activeRole === "ADMIN" || activeRole === "SUPORTE";
    if (lab.ownerId !== userId && !isModerator) {
      return NextResponse.json({ error: "Sem permissão para remover este Laboratório." }, { status: 403 });
    }

    await db.collection("marketplace_labs").deleteOne({ _id: new ObjectId(id) });

    await logAuditEvent(userId, "MARKETPLACE_LAB_DELETED", { labId: id, title: lab.title });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao remover Laboratório:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
