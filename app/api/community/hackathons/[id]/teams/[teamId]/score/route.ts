import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { ObjectId } from "mongodb";

// POST — Atribui pontuação e feedback reais à submissão de uma equipa. Só o organizador do
// hackathon ou ADMIN/SUPORTE podem avaliar.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; teamId: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id, teamId } = await params;
    const { score, feedback } = await req.json();
    const numericScore = Number(score);
    if (isNaN(numericScore) || numericScore < 0 || numericScore > 100) {
      return NextResponse.json({ error: "A pontuação deve ser um número entre 0 e 100." }, { status: 400 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    const db = await getDb();
    const hackathon = await db.collection("hackathons").findOne({ _id: new ObjectId(id) });
    if (!hackathon) {
      return NextResponse.json({ error: "Hackathon não encontrado." }, { status: 404 });
    }
    const isModerator = activeRole === "ADMIN" || activeRole === "SUPORTE";
    if (hackathon.organizerId !== userId && !isModerator) {
      return NextResponse.json({ error: "Apenas o organizador pode avaliar submissões." }, { status: 403 });
    }

    const result = await db.collection("hackathon_submissions").updateOne(
      { hackathonId: id, teamId },
      { $set: { score: numericScore, feedback: feedback?.trim() || "", scoredAt: new Date() } }
    );
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Esta equipa ainda não submeteu um projeto." }, { status: 404 });
    }

    await logAuditEvent(userId, "HACKATHON_TEAM_SCORED", { hackathonId: id, teamId, score: numericScore });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao pontuar submissão:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
