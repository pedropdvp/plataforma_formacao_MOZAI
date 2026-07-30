import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { getPublicChallenges } from "@/lib/cyber-lab/ctf-challenges";

// GET — Lista os desafios CTF (sem nunca expor a flag) e quais já foram resolvidos pelo
// utilizador autenticado.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const solves = await db.collection("ctf_solves").find({ tenant_id: tenantId, userId }).toArray();
    const solvedIds = new Set(solves.map((s: any) => s.challengeId));

    const challenges = getPublicChallenges().map((c) => ({ ...c, solved: solvedIds.has(c.id) }));
    const totalPoints = solves.reduce((sum: number, s: any) => sum + (s.points || 0), 0);

    return NextResponse.json({ success: true, challenges, totalPoints });
  } catch (error: any) {
    console.error("Erro ao listar desafios CTF:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
