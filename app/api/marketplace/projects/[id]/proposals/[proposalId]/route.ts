import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { ObjectId } from "mongodb";

// PATCH — O autor do projeto aceita ou rejeita uma proposta. Ao aceitar, o projeto passa a
// "in_progress" e as restantes propostas pendentes são automaticamente rejeitadas.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; proposalId: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id, proposalId } = await params;
    const { action } = await req.json();
    if (!["accept", "reject"].includes(action)) {
      return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    }

    const db = await getDb();
    const project = await db.collection("marketplace_projects").findOne({ _id: new ObjectId(id) });
    if (!project) {
      return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
    }
    if (project.posterId !== userId) {
      return NextResponse.json({ error: "Apenas o autor do projeto pode responder a propostas." }, { status: 403 });
    }

    const proposal = await db.collection("marketplace_project_proposals").findOne({ _id: new ObjectId(proposalId), projectId: id });
    if (!proposal) {
      return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
    }

    if (action === "accept") {
      await db.collection("marketplace_project_proposals").updateOne(
        { _id: new ObjectId(proposalId) },
        { $set: { status: "accepted" } }
      );
      await db.collection("marketplace_project_proposals").updateMany(
        { projectId: id, _id: { $ne: new ObjectId(proposalId) }, status: "pending" },
        { $set: { status: "rejected" } }
      );
      await db.collection("marketplace_projects").updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "in_progress", selectedProposalId: proposalId, updatedAt: new Date() } }
      );
      await logAuditEvent(userId, "MARKETPLACE_PROPOSAL_ACCEPTED", { projectId: id, proposalId });
      return NextResponse.json({ success: true, message: "Proposta aceite. Projeto marcado como em curso." });
    }

    await db.collection("marketplace_project_proposals").updateOne(
      { _id: new ObjectId(proposalId) },
      { $set: { status: "rejected" } }
    );
    await logAuditEvent(userId, "MARKETPLACE_PROPOSAL_REJECTED", { projectId: id, proposalId });
    return NextResponse.json({ success: true, message: "Proposta recusada." });
  } catch (error: any) {
    console.error("Erro ao responder à proposta:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
