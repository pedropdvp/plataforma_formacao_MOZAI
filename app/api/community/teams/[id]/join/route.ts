import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { ObjectId } from "mongodb";

// POST — Entra na equipa diretamente (se aberta) ou cria um pedido real de entrada pendente
// de aprovação do líder (se fechada).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDb();
    const team = await db.collection("community_teams").findOne({ _id: new ObjectId(id) });
    if (!team) {
      return NextResponse.json({ error: "Equipa não encontrada." }, { status: 404 });
    }
    if ((team.memberIds || []).includes(userId)) {
      return NextResponse.json({ error: "Já é membro desta equipa." }, { status: 409 });
    }

    if (team.openMembership) {
      await db.collection("community_teams").updateOne({ _id: new ObjectId(id) }, { $addToSet: { memberIds: userId } });
      return NextResponse.json({ success: true, joined: true });
    }

    const existing = await db.collection("team_join_requests").findOne({ teamId: id, userId, status: "pending" });
    if (existing) {
      return NextResponse.json({ error: "Já tem um pedido pendente para esta equipa." }, { status: 409 });
    }

    const userRecord = await db.collection("users").findOne({ _id: userId });
    const userName = userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || userRecord.email : "Utilizador";

    await db.collection("team_join_requests").insertOne({
      tenant_id: team.tenant_id,
      teamId: id,
      userId,
      userName,
      status: "pending",
      requestedAt: new Date(),
    });

    await logAuditEvent(userId, "TEAM_JOIN_REQUESTED", { teamId: id });

    return NextResponse.json({ success: true, joined: false, requested: true });
  } catch (error: any) {
    console.error("Erro ao pedir entrada na equipa:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
