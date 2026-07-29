import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

// POST — Alterna o "gosto" do utilizador atual numa publicação (like/unlike).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const postObjectId = new ObjectId(id);

    const post = await db.collection("community_posts").findOne({ _id: postObjectId, tenant_id: tenantId });
    if (!post) {
      return NextResponse.json({ error: "Publicação não encontrada." }, { status: 404 });
    }

    const currentLikes: string[] = post.likes || [];
    const alreadyLiked = currentLikes.includes(userId);
    const newLikes = alreadyLiked ? currentLikes.filter((id: string) => id !== userId) : [...currentLikes, userId];

    await db.collection("community_posts").updateOne({ _id: postObjectId }, { $set: { likes: newLikes } });

    return NextResponse.json({ success: true, likedByMe: !alreadyLiked, likesCount: newLikes.length });
  } catch (error: any) {
    console.error("Erro ao registar gosto na publicação:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
