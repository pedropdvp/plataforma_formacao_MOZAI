import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

// GET — Lista as Equipas deste tenant: grupos de trabalho persistentes (distintos das equipas
// de um Hackathon, que só existem enquanto esse evento durar).
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const teams = await db.collection("community_teams").find({ tenant_id: tenantId }).sort({ createdAt: -1 }).toArray();
    const pendingRequests = await db.collection("team_join_requests").find({ tenant_id: tenantId, status: "pending" }).toArray();
    const pendingByTeam = new Map<string, number>();
    pendingRequests.forEach((r: any) => pendingByTeam.set(r.teamId, (pendingByTeam.get(r.teamId) || 0) + 1));
    const myPendingTeamIds = new Set(pendingRequests.filter((r: any) => r.userId === userId).map((r: any) => r.teamId));

    return NextResponse.json({
      success: true,
      teams: teams.map((t: any) => ({
        id: t._id.toString(),
        name: t.name,
        description: t.description,
        goal: t.goal,
        leaderId: t.leaderId,
        leaderName: t.leaderName,
        openMembership: !!t.openMembership,
        membersCount: (t.memberIds || []).length,
        isMember: (t.memberIds || []).includes(userId),
        isLeader: t.leaderId === userId,
        pendingRequestsCount: pendingByTeam.get(t._id.toString()) || 0,
        myRequestPending: myPendingTeamIds.has(t._id.toString()),
      })),
    });
  } catch (error: any) {
    console.error("Erro ao listar Equipas:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Cria uma nova Equipa (o criador é automaticamente o líder).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { name, description, goal, openMembership } = await req.json();
    if (!name?.trim() || !description?.trim()) {
      return NextResponse.json({ error: "Nome e descrição da equipa são obrigatórios." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const userRecord = await db.collection("users").findOne({ _id: userId });
    const leaderName = userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || userRecord.email : "Utilizador";

    const result = await db.collection("community_teams").insertOne({
      tenant_id: tenantId,
      leaderId: userId,
      leaderName,
      name: name.trim(),
      description: description.trim(),
      goal: goal?.trim() || "",
      openMembership: !!openMembership,
      memberIds: [userId],
      createdAt: new Date(),
    });

    await logAuditEvent(userId, "COMMUNITY_TEAM_CREATED", { tenantId, teamId: result.insertedId?.toString(), name: name.trim() });

    return NextResponse.json({ success: true, teamId: result.insertedId?.toString() });
  } catch (error: any) {
    console.error("Erro ao criar Equipa:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
