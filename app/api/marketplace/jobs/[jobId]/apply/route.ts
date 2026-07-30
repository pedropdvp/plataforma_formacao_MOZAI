import { NextRequest, NextResponse, after } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { triggerPluginEvent } from "@/lib/plugins";

// POST — Candidata-se a uma vaga real publicada por uma empresa no Marketplace. A
// candidatura inclui o nome/e-mail reais do aluno (para a empresa poder contactá-lo) e
// uma mensagem opcional — não há upload de CV aqui, reaproveita-se a Análise de CV do
// Career OS para preparar o perfil antes de se candidatar.
export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { jobId } = await params;
    const { message } = await req.json().catch(() => ({ message: "" }));

    const db = await getDb();
    const job = await db.collection("job_postings").findOne({ _id: new ObjectId(jobId), isActive: true });
    if (!job) {
      return NextResponse.json({ error: "Esta vaga já não está disponível." }, { status: 404 });
    }

    const existing = await db.collection("job_applications").findOne({ jobId, applicantId: userId });
    if (existing) {
      return NextResponse.json({ error: "Já se candidatou a esta vaga." }, { status: 409 });
    }

    const userRecord = await db.collection("users").findOne({ _id: userId });
    const applicantName = userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || userRecord.email : "Aluno";

    await db.collection("job_applications").insertOne({
      tenant_id: job.tenant_id,
      jobId,
      jobTitle: job.title,
      applicantId: userId,
      applicantName,
      applicantEmail: userRecord?.email || null,
      message: (message || "").trim(),
      appliedAt: new Date(),
    });

    await logAuditEvent(userId, "JOB_APPLICATION_SUBMITTED", { jobId, jobTenantId: job.tenant_id });

    // Dispara plugins reais (ex: Slack) instalados pela empresa para este evento — corre
    // depois da resposta já ter sido enviada ao aluno (after()), para nunca atrasar nem
    // arriscar a candidatura por causa de um webhook de terceiros lento ou em baixo.
    after(() => triggerPluginEvent(job.tenant_id, "job.application_submitted", { jobTitle: job.title, applicantName }));

    return NextResponse.json({ success: true, message: "Candidatura enviada com sucesso." });
  } catch (error: any) {
    console.error("Erro ao candidatar-se à vaga:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
