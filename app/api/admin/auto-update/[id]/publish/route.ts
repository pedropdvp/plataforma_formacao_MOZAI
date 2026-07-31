import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { ObjectId } from "mongodb";

// POST — Marca um rascunho como publicado, depois de revisão humana real (ADMIN/SUPORTE).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }
    const activeRole = req.cookies.get("active-role")?.value;
    if (activeRole !== "ADMIN" && activeRole !== "SUPORTE") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { id } = await params;
    const db = await getDb();
    const item = await db.collection("auto_update_feed").findOne({ _id: new ObjectId(id) });
    if (!item || item.status !== "draft_pending_review") {
      return NextResponse.json({ error: "Este item não tem um rascunho pronto para publicar." }, { status: 400 });
    }

    await db.collection("auto_update_feed").updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "published", publishedAt: new Date(), publishedBy: userId } }
    );

    await logAuditEvent(userId, "AUTO_UPDATE_PUBLISHED", { itemId: id });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
