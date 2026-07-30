import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

const REVIEWER_ROLES = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA"];

// GET — Lista as vagas da própria empresa (todas, ativas e fechadas), com a contagem de
// candidaturas recebidas em cada uma.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !REVIEWER_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Sem permissão para gerir vagas." }, { status: 403 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const [jobs, applications] = await Promise.all([
      db.collection("job_postings").find({ tenant_id: tenantId }).sort({ createdAt: -1 }).toArray(),
      db.collection("job_applications").find({ tenant_id: tenantId }).toArray(),
    ]);

    const jobsWithCounts = jobs.map((j: any) => ({
      ...j,
      _id: j._id.toString(),
      applicationsCount: applications.filter((a: any) => a.jobId === j._id.toString()).length,
    }));

    return NextResponse.json({ success: true, jobs: jobsWithCounts });
  } catch (error: any) {
    console.error("Erro ao listar vagas:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Cria uma nova vaga real para a empresa.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !REVIEWER_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Sem permissão para criar vagas." }, { status: 403 });
    }

    const { title, description, location, workMode } = await req.json();
    if (!title || !title.trim() || !description || !description.trim()) {
      return NextResponse.json({ error: "Título e descrição da vaga são obrigatórios." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const result = await db.collection("job_postings").insertOne({
      tenant_id: tenantId,
      title: title.trim(),
      description: description.trim(),
      location: (location || "").trim(),
      workMode: workMode || "Presencial",
      isActive: true,
      createdBy: userId,
      createdAt: new Date(),
    });

    await logAuditEvent(userId, "JOB_POSTING_CREATED", { tenantId, jobId: result.insertedId?.toString(), title: title.trim() });

    return NextResponse.json({ success: true, message: "Vaga publicada com sucesso." });
  } catch (error: any) {
    console.error("Erro ao criar vaga:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
