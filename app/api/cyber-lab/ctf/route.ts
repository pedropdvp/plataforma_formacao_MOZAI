import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import {
  generateChallengeSet,
  novaSemente,
  toPublicChallenge,
} from "@/lib/cyber-lab/ctf-challenges";

/** Um registo de `ctf_solves`, na medida em que esta rota o usa. */
interface CtfSolve {
  challengeId: string;
  points?: number;
}

/**
 * Conjunto de desafios de um utilizador. Guarda-se **só a semente**: como
 * `generateChallengeSet` é determinístico, os enunciados e os hashes reconstroem-se a
 * partir dela e não há cópias por onde uma flag possa escapar.
 */
async function obterSemente(db: any, tenantId: string, userId: string): Promise<number> {
  const id = `${tenantId}:${userId}`;
  const existente = await db.collection("ctf_challenge_sets").findOne({ _id: id });
  if (existente?.seed) return existente.seed;

  const seed = novaSemente();
  await db.collection("ctf_challenge_sets").insertOne({
    _id: id,
    tenant_id: tenantId,
    userId,
    seed,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return seed;
}

// GET — Devolve o conjunto actual de desafios do utilizador (sem nunca expor a flag) e
// quais os tipos que já resolveu.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const seed = await obterSemente(db, tenantId, userId);
    const solves: CtfSolve[] = await db.collection("ctf_solves").find({ tenant_id: tenantId, userId }).toArray();
    // Os pontos contam-se por TIPO de desafio, não por instância: gerar questões novas dá
    // treino ilimitado, mas não uma torneira de XP a repetir o mesmo exercício.
    const solvedTypes = new Set(solves.map((s: CtfSolve) => s.challengeId));

    const challenges = generateChallengeSet(seed).map((c) => ({
      ...toPublicChallenge(c),
      solved: solvedTypes.has(c.typeId),
    }));
    const totalPoints = solves.reduce((sum: number, s: CtfSolve) => sum + (s.points || 0), 0);

    return NextResponse.json({ success: true, challenges, totalPoints });
  } catch (error: any) {
    console.error("Erro ao listar desafios CTF:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Gera um conjunto novo. Muda a semente, o que troca tanto os valores de cada
// enunciado como quais os tipos de desafio sorteados.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const seed = novaSemente();

    await db.collection("ctf_challenge_sets").updateOne(
      { _id: `${tenantId}:${userId}` },
      {
        $set: { tenant_id: tenantId, userId, seed, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    const solves: CtfSolve[] = await db.collection("ctf_solves").find({ tenant_id: tenantId, userId }).toArray();
    const solvedTypes = new Set(solves.map((s: CtfSolve) => s.challengeId));

    const challenges = generateChallengeSet(seed).map((c) => ({
      ...toPublicChallenge(c),
      solved: solvedTypes.has(c.typeId),
    }));

    return NextResponse.json({
      success: true,
      challenges,
      totalPoints: solves.reduce((sum: number, s: CtfSolve) => sum + (s.points || 0), 0),
    });
  } catch (error: any) {
    console.error("Erro ao gerar novos desafios CTF:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
