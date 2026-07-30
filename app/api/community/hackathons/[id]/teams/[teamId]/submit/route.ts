import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { ObjectId } from "mongodb";

// POST — Submete (ou atualiza) o projeto da equipa para este hackathon. Só um membro da
// equipa pode submeter, e só antes do prazo real definido pelo organizador.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; teamId: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id, teamId } = await params;
    const { title, description, repoUrl, demoUrl } = await req.json();
    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json({ error: "Título e descrição do projeto são obrigatórios." }, { status: 400 });
    }

    const db = await getDb();
    const hackathon = await db.collection("hackathons").findOne({ _id: new ObjectId(id) });
    if (!hackathon) {
      return NextResponse.json({ error: "Hackathon não encontrado." }, { status: 404 });
    }
    if (new Date() > new Date(hackathon.submissionDeadline)) {
      return NextResponse.json({ error: "O prazo de submissão já terminou." }, { status: 409 });
    }

    const team = await db.collection("hackathon_teams").findOne({ _id: new ObjectId(teamId), hackathonId: id });
    if (!team) {
      return NextResponse.json({ error: "Equipa não encontrada." }, { status: 404 });
    }
    if (!(team.memberIds || []).includes(userId)) {
      return NextResponse.json({ error: "Só um membro da equipa pode submeter o projeto." }, { status: 403 });
    }

    await db.collection("hackathon_submissions").updateOne(
      { hackathonId: id, teamId },
      {
        $set: {
          hackathonId: id,
          teamId,
          tenant_id: hackathon.tenant_id,
          title: title.trim(),
          description: description.trim(),
          repoUrl: repoUrl?.trim() || "",
          demoUrl: demoUrl?.trim() || "",
          submittedAt: new Date(),
        },
        $setOnInsert: { score: null, feedback: null },
      },
      { upsert: true }
    );

    await logAuditEvent(userId, "HACKATHON_SUBMISSION", { hackathonId: id, teamId });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao submeter projeto do hackathon:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
