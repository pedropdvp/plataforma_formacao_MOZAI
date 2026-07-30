import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { getChallenge, hashFlag } from "@/lib/cyber-lab/ctf-challenges";
import { logAuditEvent } from "@/lib/audit";

// POST — Submete uma flag para um desafio CTF. A comparação é feita por hash (SHA-256) — a
// flag correta nunca viaja para o cliente em nenhum momento. Pontos só são atribuídos uma vez
// por desafio (evita "grinding" resubmetendo o mesmo desafio já resolvido).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const { flag } = await req.json();
    if (!flag?.trim()) {
      return NextResponse.json({ error: "Submeta uma flag." }, { status: 400 });
    }

    const challenge = getChallenge(id);
    if (!challenge) {
      return NextResponse.json({ error: "Desafio não encontrado." }, { status: 404 });
    }

    const correct = hashFlag(flag) === challenge.flagHash;
    if (!correct) {
      return NextResponse.json({ success: true, correct: false });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const existing = await db.collection("ctf_solves").findOne({ tenant_id: tenantId, userId, challengeId: id });
    if (existing) {
      return NextResponse.json({ success: true, correct: true, alreadySolved: true });
    }

    await db.collection("ctf_solves").insertOne({
      tenant_id: tenantId,
      userId,
      challengeId: id,
      points: challenge.points,
      solvedAt: new Date(),
    });

    // Gamificação: pontos CTF somam-se ao XP geral, como qualquer outra conquista da plataforma.
    const profile = await db.collection("gamification_profiles").findOne({ _id: userId });
    const newXp = (profile?.xp || 0) + challenge.points;
    await db.collection("gamification_profiles").updateOne(
      { _id: userId },
      { $set: { tenant_id: tenantId, xp: newXp, level: Math.floor(newXp / 100) + 1, updatedAt: new Date() }, $setOnInsert: { badges: [], streak: 0, createdAt: new Date() } },
      { upsert: true }
    );

    await logAuditEvent(userId, "CTF_CHALLENGE_SOLVED", { tenantId, challengeId: id, points: challenge.points });

    return NextResponse.json({ success: true, correct: true, pointsAwarded: challenge.points });
  } catch (error: any) {
    console.error("Erro ao submeter flag CTF:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
