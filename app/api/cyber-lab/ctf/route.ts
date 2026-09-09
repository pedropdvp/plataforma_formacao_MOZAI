import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import {
  generateChallengeSet,
  novaSemente,
  sortearTipos,
  toPublicChallenge,
} from "@/lib/cyber-lab/ctf-challenges";

/** Um registo de `ctf_solves`, na medida em que esta rota o usa. */
interface CtfSolve {
  challengeId: string;
  points?: number;
}

/**
 * O conjunto guardado de um utilizador: só a semente e os tipos sorteados. Os enunciados e
 * os hashes reconstroem-se a partir daí, e assim não fica na base de dados nenhuma cópia
 * por onde uma flag possa escapar.
 *
 * `solvedIds` são as instâncias resolvidas **neste** conjunto, e voltam a zero a cada
 * geração — um desafio acabado de gerar tem de nascer por responder.
 */
interface CtfSet {
  seed: number;
  typeIds: string[];
  solvedIds?: string[];
}

async function lerSolves(db: any, tenantId: string, userId: string): Promise<CtfSolve[]> {
  return db.collection("ctf_solves").find({ tenant_id: tenantId, userId }).toArray();
}

function montarResposta(conjunto: CtfSet, solves: CtfSolve[]) {
  const tiposPontuados = new Set(solves.map((s) => s.challengeId));
  const resolvidas = new Set(conjunto.solvedIds || []);

  const challenges = generateChallengeSet(conjunto.seed, conjunto.typeIds).map((c) => ({
    ...toPublicChallenge(c),
    // Resolvido = esta instância, neste conjunto. Contava-se por tipo, e era por isso que
    // um conjunto novo nascia com cartões marcados e sem sítio para responder.
    solved: resolvidas.has(c.id),
    // Este tipo já deu pontos noutra altura: resolve-se na mesma, mas sem novo XP.
    alreadyScored: tiposPontuados.has(c.typeId),
  }));

  return {
    success: true,
    challenges,
    totalPoints: solves.reduce((sum, s) => sum + (s.points || 0), 0),
  };
}

/** Semente nova, tipos sorteados de novo (com prioridade aos que ainda não pontuaram) e
 *  nenhuma instância resolvida. */
async function criarConjunto(
  db: any,
  tenantId: string,
  userId: string,
  solves: CtfSolve[]
): Promise<CtfSet> {
  const seed = novaSemente();
  const typeIds = sortearTipos(
    seed,
    solves.map((s) => s.challengeId)
  );

  await db.collection("ctf_challenge_sets").updateOne(
    { _id: `${tenantId}:${userId}` },
    {
      $set: { tenant_id: tenantId, userId, seed, typeIds, solvedIds: [], updatedAt: new Date() },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  return { seed, typeIds, solvedIds: [] };
}

// GET — Devolve o conjunto actual do utilizador (sem nunca expor a flag).
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const solves = await lerSolves(db, tenantId, userId);

    const guardado = await db
      .collection("ctf_challenge_sets")
      .findOne({ _id: `${tenantId}:${userId}` });

    // Os conjuntos criados antes desta mudança não têm `typeIds`. Nesses gera-se um novo,
    // em vez de adivinhar quais eram — adivinhar daria enunciados diferentes dos que a
    // pessoa tem no ecrã, e submissões a falhar sem explicação.
    const conjunto: CtfSet =
      guardado?.seed && Array.isArray(guardado?.typeIds) && guardado.typeIds.length
        ? { seed: guardado.seed, typeIds: guardado.typeIds, solvedIds: guardado.solvedIds }
        : await criarConjunto(db, tenantId, userId, solves);

    return NextResponse.json(montarResposta(conjunto, solves));
  } catch (error: any) {
    console.error("Erro ao listar desafios CTF:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Gera um conjunto novo.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const solves = await lerSolves(db, tenantId, userId);
    const conjunto = await criarConjunto(db, tenantId, userId, solves);

    return NextResponse.json(montarResposta(conjunto, solves));
  } catch (error: any) {
    console.error("Erro ao gerar novos desafios CTF:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
