import { NextRequest, NextResponse, after } from "next/server";
import { ObjectId } from "mongodb";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { triggerPluginEvent } from "@/lib/plugins";

// Regra de negócio: só Admin e Professor podem avaliar projetos (não pares, não Suporte).
const REVIEWER_ROLES = ["ADMIN", "PROFESSOR"];

// PATCH — Avalia uma submissão de projeto: aprova ou rejeita, com nota (0-100) e feedback
// escrito. Ao aprovar, marca também a lição/curso associado como concluído em
// user_progress, para que o projeto conte para o certificado tal como uma lição normal.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !REVIEWER_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Sem permissão para avaliar projetos." }, { status: 403 });
    }

    const { id } = await params;
    const { status, grade, feedback } = await req.json();

    if (!["approved", "rejected", "reviewing"].includes(status)) {
      return NextResponse.json({ error: "Estado de avaliação inválido." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const submissionObjectId = new ObjectId(id);

    const submission = await db.collection("project_submissions").findOne({ _id: submissionObjectId, tenant_id: tenantId });
    if (!submission) {
      return NextResponse.json({ error: "Submissão de projeto não encontrada." }, { status: 404 });
    }

    const reviewer = await currentUser();
    const reviewerName = `${reviewer?.firstName || ""} ${reviewer?.lastName || ""}`.trim() || "Avaliador";

    await db.collection("project_submissions").updateOne(
      { _id: submissionObjectId },
      {
        $set: {
          status,
          grade: typeof grade === "number" ? grade : null,
          feedback: feedback || null,
          reviewedAt: new Date(),
          reviewedBy: reviewerName,
        },
      }
    );

    // Aprovação conta como lição concluída para efeitos de progresso/certificado
    if (status === "approved") {
      await db.collection("user_progress").updateOne(
        { tenant_id: tenantId, userId: submission.userId, courseId: submission.courseId, lessonId: `project-${submission._id.toString()}` },
        { $set: { status: "completed", completedAt: new Date(), updatedAt: new Date() } },
        { upsert: true }
      );
    }

    await logAuditEvent(userId, "PROJECT_REVIEWED", {
      tenantId,
      submissionId: id,
      studentId: submission.userId,
      status,
      grade,
    });

    if (status === "approved") {
      after(() => triggerPluginEvent(tenantId, "project.approved", { studentName: submission.studentName, title: submission.title, grade }));
    }

    return NextResponse.json({ success: true, message: "Avaliação do projeto registada com sucesso." });
  } catch (error: any) {
    console.error("Erro ao avaliar projeto:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
