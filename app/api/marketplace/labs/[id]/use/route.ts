import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

// POST — Regista a abertura real de um Laboratório no editor (contador de uso).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDb();

    const lab = await db.collection("marketplace_labs").findOne({ _id: new ObjectId(id) });
    if (!lab) {
      return NextResponse.json({ error: "Laboratório não encontrado." }, { status: 404 });
    }
    if (!lab.isPublic && lab.ownerId !== userId) {
      return NextResponse.json({ error: "Este Laboratório é privado." }, { status: 403 });
    }

    await db.collection("marketplace_labs").updateOne({ _id: new ObjectId(id) }, { $inc: { usesCount: 1 } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao registar uso do Laboratório:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
