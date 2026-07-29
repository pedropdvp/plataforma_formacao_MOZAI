import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

// GET — Feed da Comunidade: posts recentes de todo o tenant (não filtrados por curso —
// essa é a diferença de propósito face ao Fórum, que é discussão técnica por curso).
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const posts = await db
      .collection("community_posts")
      .find({ tenant_id: tenantId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({
      success: true,
      posts: posts.map((p: any) => ({
        id: p._id.toString(),
        authorId: p.authorId,
        authorName: p.authorName,
        content: p.content,
        mediaUrl: p.mediaUrl || null,
        likesCount: (p.likes || []).length,
        likedByMe: (p.likes || []).includes(userId),
        comments: p.comments || [],
        createdAt: p.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Erro ao ler o feed da Comunidade:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Cria uma nova publicação no feed da Comunidade (partilha de conquistas,
// código, casos de sucesso — conteúdo geral, não uma dúvida sobre um curso específico).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { content, mediaUrl } = await req.json();
    if (!content || !content.trim()) {
      return NextResponse.json({ error: "O conteúdo da publicação é obrigatório." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const userRecord = await db.collection("users").findOne({ _id: userId });
    const authorName = userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || userRecord.email : "Aluno MOZAI";

    const post = {
      tenant_id: tenantId,
      authorId: userId,
      authorName,
      content: content.trim(),
      mediaUrl: mediaUrl || null,
      likes: [] as string[],
      comments: [] as any[],
      createdAt: new Date(),
    };

    const result = await db.collection("community_posts").insertOne(post);
    await logAuditEvent(userId, "COMMUNITY_POST_CREATED", { tenantId, postId: result.insertedId?.toString() });

    return NextResponse.json({
      success: true,
      post: {
        id: result.insertedId?.toString(),
        authorId: post.authorId,
        authorName: post.authorName,
        content: post.content,
        mediaUrl: post.mediaUrl,
        likesCount: 0,
        likedByMe: false,
        comments: [],
        createdAt: post.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Erro ao criar publicação na Comunidade:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
