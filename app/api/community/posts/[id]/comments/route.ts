import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

// POST — Adiciona um comentário real a uma publicação da Comunidade.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { text } = await req.json();
    if (!text || !text.trim()) {
      return NextResponse.json({ error: "O comentário não pode estar vazio." }, { status: 400 });
    }

    const { id } = await params;
    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const postObjectId = new ObjectId(id);

    const post = await db.collection("community_posts").findOne({ _id: postObjectId, tenant_id: tenantId });
    if (!post) {
      return NextResponse.json({ error: "Publicação não encontrada." }, { status: 404 });
    }

    const userRecord = await db.collection("users").findOne({ _id: userId });
    const authorName = userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || userRecord.email : "Aluno MOZAI";

    const comment = {
      id: Math.random().toString(36).substring(7),
      authorId: userId,
      authorName,
      text: text.trim(),
      createdAt: new Date(),
    };

    const newComments = [...(post.comments || []), comment];
    await db.collection("community_posts").updateOne({ _id: postObjectId }, { $set: { comments: newComments } });

    return NextResponse.json({ success: true, comments: newComments });
  } catch (error: any) {
    console.error("Erro ao adicionar comentário na publicação:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
