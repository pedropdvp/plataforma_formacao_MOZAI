import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

const REVIEWER_ROLES = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA"];

// PATCH — Fecha/reabre uma vaga (isActive) da própria empresa.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !REVIEWER_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Sem permissão para gerir vagas." }, { status: 403 });
    }

    const { id } = await params;
    const { isActive } = await req.json();
    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    await db.collection("job_postings").updateOne(
      { _id: new ObjectId(id), tenant_id: tenantId },
      { $set: { isActive: !!isActive, updatedAt: new Date() } }
    );

    await logAuditEvent(userId, "JOB_POSTING_UPDATED", { tenantId, jobId: id, isActive: !!isActive });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao atualizar vaga:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET — Lista as candidaturas reais recebidas para esta vaga.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !REVIEWER_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Sem permissão para ver candidaturas." }, { status: 403 });
    }

    const { id } = await params;
    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const applications = await db.collection("job_applications").find({ tenant_id: tenantId, jobId: id }).sort({ appliedAt: -1 }).toArray();

    return NextResponse.json({
      success: true,
      applications: applications.map((a: any) => ({ ...a, _id: a._id.toString() })),
    });
  } catch (error: any) {
    console.error("Erro ao listar candidaturas:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
