import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

// DELETE — Remove uma publicação: o próprio autor, ou ADMIN/SUPORTE por moderação.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const activeRole = req.cookies.get("active-role")?.value;
    const isModerator = activeRole === "ADMIN" || activeRole === "SUPORTE";
    if (post.authorId !== userId && !isModerator) {
      return NextResponse.json({ error: "Sem permissão para eliminar esta publicação." }, { status: 403 });
    }

    await db.collection("community_posts").deleteOne({ _id: postObjectId });
    await logAuditEvent(userId, "COMMUNITY_POST_DELETED", { tenantId, postId: id, moderated: post.authorId !== userId });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao eliminar publicação da Comunidade:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
