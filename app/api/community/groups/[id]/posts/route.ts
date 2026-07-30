import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { ObjectId } from "mongodb";

// GET — Feed de publicações deste Grupo (visível a qualquer utilizador autenticado do tenant,
// só a publicação exige ser membro).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDb();
    const posts = await db.collection("community_group_posts").find({ groupId: id }).sort({ createdAt: -1 }).toArray();

    return NextResponse.json({
      success: true,
      posts: posts.map((p: any) => ({
        id: p._id.toString(),
        authorName: p.authorName,
        content: p.content,
        likesCount: (p.likes || []).length,
        likedByMe: (p.likes || []).includes(userId),
        createdAt: p.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Erro ao listar publicações do grupo:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Publica no Grupo (só membros podem publicar).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const { content } = await req.json();
    if (!content?.trim()) {
      return NextResponse.json({ error: "Escreva algo para publicar." }, { status: 400 });
    }

    const db = await getDb();
    const group = await db.collection("community_groups").findOne({ _id: new ObjectId(id) });
    if (!group) {
      return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });
    }
    if (!(group.memberIds || []).includes(userId)) {
      return NextResponse.json({ error: "Só membros do grupo podem publicar." }, { status: 403 });
    }

    const userRecord = await db.collection("users").findOne({ _id: userId });
    const authorName = userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || userRecord.email : "Membro";

    const result = await db.collection("community_group_posts").insertOne({
      groupId: id,
      tenant_id: group.tenant_id,
      authorId: userId,
      authorName,
      content: content.trim(),
      likes: [] as string[],
      createdAt: new Date(),
    });

    await logAuditEvent(userId, "COMMUNITY_GROUP_POST_CREATED", { groupId: id, postId: result.insertedId?.toString() });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao publicar no grupo:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
