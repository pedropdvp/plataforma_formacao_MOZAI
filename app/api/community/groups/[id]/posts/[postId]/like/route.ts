import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

// POST — Alterna o gosto (like) numa publicação do grupo.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; postId: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { postId } = await params;
    const db = await getDb();
    const post = await db.collection("community_group_posts").findOne({ _id: new ObjectId(postId) });
    if (!post) {
      return NextResponse.json({ error: "Publicação não encontrada." }, { status: 404 });
    }

    const liked = (post.likes || []).includes(userId);
    await db.collection("community_group_posts").updateOne(
      { _id: new ObjectId(postId) },
      liked ? { $pull: { likes: userId } } : { $addToSet: { likes: userId } }
    );

    const updated = await db.collection("community_group_posts").findOne({ _id: new ObjectId(postId) });
    return NextResponse.json({ success: true, liked: !liked, likesCount: (updated?.likes || []).length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
