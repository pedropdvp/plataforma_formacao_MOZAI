import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { ObjectId } from "mongodb";

// PATCH — O líder aprova ou rejeita um pedido de entrada real.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; reqId: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id, reqId } = await params;
    const { action } = await req.json();
    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    }

    const db = await getDb();
    const team = await db.collection("community_teams").findOne({ _id: new ObjectId(id) });
    if (!team) {
      return NextResponse.json({ error: "Equipa não encontrada." }, { status: 404 });
    }
    if (team.leaderId !== userId) {
      return NextResponse.json({ error: "Só o líder pode responder a pedidos de entrada." }, { status: 403 });
    }

    const request = await db.collection("team_join_requests").findOne({ _id: new ObjectId(reqId), teamId: id });
    if (!request || request.status !== "pending") {
      return NextResponse.json({ error: "Pedido não encontrado ou já respondido." }, { status: 404 });
    }

    if (action === "approve") {
      await db.collection("community_teams").updateOne({ _id: new ObjectId(id) }, { $addToSet: { memberIds: request.userId } });
    }
    await db.collection("team_join_requests").updateOne({ _id: new ObjectId(reqId) }, { $set: { status: action === "approve" ? "approved" : "rejected", respondedAt: new Date() } });

    await logAuditEvent(userId, "TEAM_JOIN_REQUEST_RESPONDED", { teamId: id, reqId, action });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao responder ao pedido de entrada:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
