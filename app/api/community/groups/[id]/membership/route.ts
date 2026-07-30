import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

// POST — Alterna a participação (entrar/sair) do utilizador autenticado neste Grupo.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDb();
    const group = await db.collection("community_groups").findOne({ _id: new ObjectId(id) });
    if (!group) {
      return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });
    }

    const isMember = (group.memberIds || []).includes(userId);
    if (isMember && group.creatorId === userId) {
      return NextResponse.json({ error: "O criador não pode sair do próprio grupo." }, { status: 400 });
    }

    await db.collection("community_groups").updateOne(
      { _id: new ObjectId(id) },
      isMember ? { $pull: { memberIds: userId } } : { $addToSet: { memberIds: userId } }
    );

    const updated = await db.collection("community_groups").findOne({ _id: new ObjectId(id) });
    return NextResponse.json({ success: true, isMember: !isMember, membersCount: (updated?.memberIds || []).length });
  } catch (error: any) {
    console.error("Erro ao alternar participação no grupo:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
