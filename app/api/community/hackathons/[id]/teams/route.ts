import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { ObjectId } from "mongodb";

// GET — Lista as equipas do hackathon com a respetiva submissão (se existir), ordenadas por
// pontuação real (equipas ainda não avaliadas aparecem no fim).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDb();
    const teams = await db.collection("hackathon_teams").find({ hackathonId: id }).toArray();
    const submissions = await db.collection("hackathon_submissions").find({ hackathonId: id }).toArray();
    const submissionByTeam = new Map<string, any>(submissions.map((s: any) => [s.teamId, s]));

    const formatted = teams
      .map((t: any) => {
        const sub = submissionByTeam.get(t._id.toString());
        return {
          id: t._id.toString(),
          name: t.name,
          memberNames: t.memberNames || [],
          isMine: (t.memberIds || []).includes(userId),
          submission: sub ? { title: sub.title, repoUrl: sub.repoUrl, demoUrl: sub.demoUrl, score: sub.score, feedback: sub.feedback } : null,
        };
      })
      .sort((a: any, b: any) => (b.submission?.score ?? -1) - (a.submission?.score ?? -1));

    return NextResponse.json({ success: true, teams: formatted });
  } catch (error: any) {
    console.error("Erro ao listar equipas do hackathon:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Cria uma equipa neste hackathon (o próprio criador entra automaticamente como membro).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const { name } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Dê um nome à equipa." }, { status: 400 });
    }

    const db = await getDb();
    const hackathon = await db.collection("hackathons").findOne({ _id: new ObjectId(id) });
    if (!hackathon) {
      return NextResponse.json({ error: "Hackathon não encontrado." }, { status: 404 });
    }

    const existingTeam = await db.collection("hackathon_teams").findOne({ hackathonId: id, memberIds: userId });
    if (existingTeam) {
      return NextResponse.json({ error: "Já faz parte de uma equipa neste hackathon." }, { status: 409 });
    }

    const userRecord = await db.collection("users").findOne({ _id: userId });
    const memberName = userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || userRecord.email : "Utilizador";

    const result = await db.collection("hackathon_teams").insertOne({
      hackathonId: id,
      tenant_id: hackathon.tenant_id,
      name: name.trim(),
      leaderId: userId,
      memberIds: [userId],
      memberNames: [memberName],
      createdAt: new Date(),
    });

    await logAuditEvent(userId, "HACKATHON_TEAM_CREATED", { hackathonId: id, teamId: result.insertedId?.toString() });

    return NextResponse.json({ success: true, teamId: result.insertedId?.toString() });
  } catch (error: any) {
    console.error("Erro ao criar equipa:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
