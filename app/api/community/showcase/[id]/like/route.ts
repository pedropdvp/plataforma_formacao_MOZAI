import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

// POST — Alterna o gosto (like) num projeto do showcase.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDb();
    const project = await db.collection("community_showcase_projects").findOne({ _id: new ObjectId(id) });
    if (!project) {
      return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
    }

    const liked = (project.likes || []).includes(userId);
    await db.collection("community_showcase_projects").updateOne(
      { _id: new ObjectId(id) },
      liked ? { $pull: { likes: userId } } : { $addToSet: { likes: userId } }
    );

    const updated = await db.collection("community_showcase_projects").findOne({ _id: new ObjectId(id) });
    return NextResponse.json({ success: true, liked: !liked, likesCount: (updated?.likes || []).length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
