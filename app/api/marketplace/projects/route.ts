import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

// GET — Bolsa de Projetos: projetos em aberto de qualquer organização (cross-tenant, tal como
// Mentores/Datasets), mais os próprios (de qualquer estado), para o autor poder geri-los.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const q = req.nextUrl.searchParams.get("q")?.trim();
    const db = await getDb();

    const filter: any = {
      $or: [{ status: "open" }, { posterId: userId }],
    };
    if (q) {
      filter.$and = [
        { $or: filter.$or },
        { $or: [{ title: { $regex: q, $options: "i" } }, { skills: { $regex: q, $options: "i" } }] },
      ];
      delete filter.$or;
    }

    const projects = await db
      .collection("marketplace_projects")
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    const proposalCounts = await db
      .collection("marketplace_project_proposals")
      .aggregate([{ $group: { _id: "$projectId", count: { $sum: 1 } } }])
      .toArray();
    const countMap = new Map(proposalCounts.map((c: any) => [c._id, c.count]));

    const formatted = projects.map((p: any) => ({
      id: p._id.toString(),
      title: p.title,
      description: p.description,
      skills: p.skills || [],
      budget: p.budget,
      budgetType: p.budgetType,
      deadline: p.deadline,
      status: p.status,
      posterName: p.posterName,
      isMine: p.posterId === userId,
      proposalsCount: countMap.get(p._id.toString()) || 0,
      createdAt: p.createdAt,
    }));

    return NextResponse.json({ success: true, projects: formatted });
  } catch (error: any) {
    console.error("Erro ao listar Projetos do Marketplace:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Publica um novo Projeto na bolsa (qualquer utilizador autenticado pode publicar,
// tal como pedir mentoria — não é exclusivo de empresas).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { title, description, skills, budget, budgetType, deadline } = await req.json();
    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json({ error: "Título e descrição do projeto são obrigatórios." }, { status: 400 });
    }
    if (budgetType && !["fixo", "portefolio"].includes(budgetType)) {
      return NextResponse.json({ error: "Tipo de orçamento inválido." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const userRecord = await db.collection("users").findOne({ _id: userId });
    const posterName = userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || userRecord.email : "Utilizador";

    const skillsArray = Array.isArray(skills)
      ? skills
      : typeof skills === "string"
        ? skills.split(",").map((s: string) => s.trim()).filter(Boolean)
        : [];

    const result = await db.collection("marketplace_projects").insertOne({
      tenant_id: tenantId,
      posterId: userId,
      posterName,
      title: title.trim(),
      description: description.trim(),
      skills: skillsArray,
      budget: budget?.trim() || "",
      budgetType: budgetType || "fixo",
      deadline: deadline ? new Date(deadline) : null,
      status: "open", // open | in_progress | completed
      selectedProposalId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await logAuditEvent(userId, "MARKETPLACE_PROJECT_PUBLISHED", { tenantId, projectId: result.insertedId?.toString(), title: title.trim() });

    return NextResponse.json({ success: true, projectId: result.insertedId?.toString() });
  } catch (error: any) {
    console.error("Erro ao publicar Projeto no Marketplace:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
