import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { ObjectId } from "mongodb";

// GET — Lista as propostas de um projeto. Só o autor do projeto pode ver todas; um candidato
// só vê a sua própria proposta.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDb();

    const project = await db.collection("marketplace_projects").findOne({ _id: new ObjectId(id) });
    if (!project) {
      return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
    }

    const isOwner = project.posterId === userId;
    const filter = isOwner ? { projectId: id } : { projectId: id, applicantId: userId };

    const proposals = await db.collection("marketplace_project_proposals").find(filter).sort({ submittedAt: -1 }).toArray();

    return NextResponse.json({
      success: true,
      proposals: proposals.map((p: any) => ({ ...p, _id: p._id.toString() })),
      isOwner,
    });
  } catch (error: any) {
    console.error("Erro ao listar propostas:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Submete uma proposta a um projeto em aberto.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const { message, proposedBudget, portfolioLink } = await req.json();
    if (!message?.trim()) {
      return NextResponse.json({ error: "Escreva uma proposta." }, { status: 400 });
    }

    const db = await getDb();
    const project = await db.collection("marketplace_projects").findOne({ _id: new ObjectId(id) });
    if (!project) {
      return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
    }
    if (project.status !== "open") {
      return NextResponse.json({ error: "Este projeto já não está a aceitar propostas." }, { status: 409 });
    }
    if (project.posterId === userId) {
      return NextResponse.json({ error: "Não pode propor-se ao seu próprio projeto." }, { status: 400 });
    }

    const existing = await db.collection("marketplace_project_proposals").findOne({ projectId: id, applicantId: userId });
    if (existing) {
      return NextResponse.json({ error: "Já submeteu uma proposta a este projeto." }, { status: 409 });
    }

    const userRecord = await db.collection("users").findOne({ _id: userId });
    const applicantName = userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || userRecord.email : "Utilizador";

    const result = await db.collection("marketplace_project_proposals").insertOne({
      tenant_id: project.tenant_id,
      projectId: id,
      applicantId: userId,
      applicantName,
      message: message.trim(),
      proposedBudget: proposedBudget?.trim() || "",
      portfolioLink: portfolioLink?.trim() || "",
      status: "pending", // pending | accepted | rejected
      submittedAt: new Date(),
    });

    await logAuditEvent(userId, "MARKETPLACE_PROPOSAL_SUBMITTED", { projectId: id, proposalId: result.insertedId?.toString() });

    return NextResponse.json({ success: true, message: "Proposta enviada com sucesso." });
  } catch (error: any) {
    console.error("Erro ao submeter proposta:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
