import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

// POST — Entra numa equipa já existente do hackathon (não pode estar noutra equipa do mesmo hackathon).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; teamId: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id, teamId } = await params;
    const db = await getDb();

    const existingTeam = await db.collection("hackathon_teams").findOne({ hackathonId: id, memberIds: userId });
    if (existingTeam) {
      return NextResponse.json({ error: "Já faz parte de uma equipa neste hackathon." }, { status: 409 });
    }

    const userRecord = await db.collection("users").findOne({ _id: userId });
    const memberName = userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || userRecord.email : "Utilizador";

    const result = await db.collection("hackathon_teams").updateOne(
      { _id: new ObjectId(teamId), hackathonId: id },
      { $addToSet: { memberIds: userId, memberNames: memberName } }
    );
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Equipa não encontrada." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao entrar na equipa:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
