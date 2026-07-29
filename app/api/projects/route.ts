import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

// GET — Lista as submissões de projetos do próprio aluno autenticado (todas as suas, em
// todos os cursos), mais recentes primeiro.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const submissions = await db
      .collection("project_submissions")
      .find({ tenant_id: tenantId, userId })
      .sort({ submittedAt: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      submissions: submissions.map((s: any) => ({ ...s, _id: s._id.toString() })),
    });
  } catch (error: any) {
    console.error("Erro ao ler submissões de projetos:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Regista uma nova submissão de projeto prático de um aluno para um curso.
// Aceita um link (repositório/portefólio) e/ou um ficheiro já carregado para o Vercel
// Blob (ver /api/projects/upload-token), consoante o que o formando tiver disponível.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const { courseId, courseTitle, title, description, repoUrl, fileUrl, fileName } = await req.json();

    if (!courseId || !title || !description) {
      return NextResponse.json(
        { error: "Campos 'courseId', 'title' e 'description' são obrigatórios." },
        { status: 400 }
      );
    }

    if (!repoUrl && !fileUrl) {
      return NextResponse.json(
        { error: "Deve fornecer pelo menos um link de repositório/portefólio ou um ficheiro." },
        { status: 400 }
      );
    }

    const db = await getDb();
    const userRecord = await db.collection("users").findOne({ _id: userId });
    const studentName = userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || userRecord.email : "Aluno";

    const submission = {
      tenant_id: tenantId,
      userId,
      studentName,
      courseId,
      courseTitle: courseTitle || "Curso",
      title,
      description,
      repoUrl: repoUrl || null,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      status: "submitted", // submitted | reviewing | approved | rejected
      grade: null,
      feedback: null,
      submittedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
    };

    const result = await db.collection("project_submissions").insertOne(submission);

    await logAuditEvent(userId, "PROJECT_SUBMITTED", {
      tenantId,
      courseId,
      title,
      submissionId: result.insertedId?.toString(),
    });

    return NextResponse.json({
      success: true,
      message: "Projeto submetido com sucesso. Aguarde a avaliação.",
      submissionId: result.insertedId?.toString(),
    });
  } catch (error: any) {
    console.error("Erro ao submeter projeto:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
