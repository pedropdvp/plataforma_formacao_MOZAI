import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

// POST — Regista o uso real de um Template (cópia ou download) e devolve o conteúdo completo.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDb();

    const template = await db.collection("content_templates").findOne({ _id: new ObjectId(id) });
    if (!template) {
      return NextResponse.json({ error: "Template não encontrado." }, { status: 404 });
    }
    if (!template.isPublic && template.ownerId !== userId) {
      return NextResponse.json({ error: "Este Template é privado." }, { status: 403 });
    }

    await db.collection("content_templates").updateOne({ _id: new ObjectId(id) }, { $inc: { usesCount: 1 } });

    return NextResponse.json({ success: true, content: template.content, title: template.title });
  } catch (error: any) {
    console.error("Erro ao usar Template:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
