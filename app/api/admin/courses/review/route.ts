import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logAuditEvent } from "@/lib/audit";

export const maxDuration = 120; // Permitir tempo para indexar todas as lições em RAG

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    if (!courseId) {
      return NextResponse.json({ error: "Parâmetro courseId é obrigatório." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const course = await db.collection("courses").findOne({
      _id: new ObjectId(courseId),
      tenant_id: tenantId,
    });

    if (!course) {
      return NextResponse.json({ error: "Curso não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ success: true, course });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const body = await req.json();
    const { courseId, action } = body; // action: "approve" | "reject"

    if (!courseId || !action) {
      return NextResponse.json({ error: "Parâmetros courseId e action são obrigatórios." }, { status: 400 });
    }

    const db = await getDb();
    const course = await db.collection("courses").findOne({
      _id: new ObjectId(courseId),
      tenant_id: tenantId,
    });

    if (!course) {
      return NextResponse.json({ error: "Curso não encontrado." }, { status: 404 });
    }

    // Curadoria para todo o catálogo do inquilino: ADMIN, GESTOR_EMPRESA, GESTOR_ACADEMICO.
    // Um Aluno Individual pode aprovar/rejeitar apenas o seu PRÓPRIO rascunho privado.
    const activeRole = req.cookies.get("active-role")?.value || "ALUNO";
    const curatorRoles = ["ADMIN", "GESTOR_EMPRESA", "GESTOR_ACADEMICO"];
    const isCurator = curatorRoles.includes(activeRole);
    const isOwnPrivateDraft = course.isPrivate && course.generatedByUserId === userId;
    if (!isCurator && !isOwnPrivateDraft) {
      return NextResponse.json({ error: "Acesso negado para curadoria de cursos." }, { status: 403 });
    }

    if (action === "approve") {
      // 1. Atualizar status para PUBLISHED. Só um curador promove o curso a público do
      // catálogo do inquilino — o dono de um rascunho privado mantém-no privado ao aprová-lo.
      await db.collection("courses").updateOne(
        { _id: course._id },
        {
          $set: {
            status: "PUBLISHED",
            isPrivate: isCurator ? false : course.isPrivate,
            updatedAt: new Date(),
          },
        }
      );

      // 2. Indexar as lições no Vector Store RAG
      const { indexLessonContent } = await import("@/lib/vector-store");
      for (const mod of course.modules || []) {
        for (const les of mod.lessons || []) {
          const withTitle = `# ${les.title}\n\n${les.content}`;
          try {
            await indexLessonContent(tenantId, courseId.toString(), les.slug || les.id, withTitle);
          } catch (ragErr) {
            console.error(`Falha ao indexar lição ${les.title} no Vector Store:`, ragErr);
          }
        }
      }

      await logAuditEvent(userId, "COURSE_AI_APPROVED", {
        courseId: courseId.toString(),
        title: course.title,
      });

      return NextResponse.json({ success: true, status: "PUBLISHED" });
    } else if (action === "reject") {
      // Exclui ou marca como rejeitado
      await db.collection("courses").deleteOne({ _id: course._id });

      await logAuditEvent(userId, "COURSE_AI_REJECTED", {
        courseId: courseId.toString(),
        title: course.title,
      });

      return NextResponse.json({ success: true, status: "DELETED" });
    } else {
      return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Erro na revisão de curso:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — Apagar um curso gerado por IA
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    if (!courseId) {
      return NextResponse.json({ error: "courseId é obrigatório." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    let objectId: ObjectId;
    try {
      objectId = new ObjectId(courseId);
    } catch {
      // ID que não é do Mongo (ex: curso do Sanity) — este endpoint só apaga cursos gerados por IA.
      return NextResponse.json({ error: "Este curso não pode ser apagado por aqui." }, { status: 400 });
    }

    const course = await db.collection("courses").findOne({
      _id: objectId,
      tenant_id: tenantId,
    });

    if (!course) {
      return NextResponse.json({ error: "Curso não encontrado." }, { status: 404 });
    }

    // ADMIN/GESTOR_EMPRESA/GESTOR_ACADEMICO apagam qualquer curso do tenant; o criador do
    // curso (generatedByUserId) pode apagar o seu próprio, publicado ou ainda em rascunho.
    const activeRole = req.cookies.get("active-role")?.value || "ALUNO";
    const curatorRoles = ["ADMIN", "GESTOR_EMPRESA", "GESTOR_ACADEMICO"];
    const isCurator = curatorRoles.includes(activeRole);
    const isOwner = course.generatedByUserId === userId;
    if (!isCurator && !isOwner) {
      return NextResponse.json({ error: "Acesso negado para eliminar este curso." }, { status: 403 });
    }

    await db.collection("courses").deleteOne({ _id: objectId });

    await logAuditEvent(userId, "COURSE_AI_DELETED", {
      courseId,
      title: course.title,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao apagar curso:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT — Atualizar conteúdo/metadados de um curso gerado por IA
export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const body = await req.json();
    const { courseId, title, description, modules, videoUrl, isPublicMarketplace, marketplaceDescription } = body;

    if (!courseId) {
      return NextResponse.json({ error: "courseId é obrigatório." }, { status: 400 });
    }

    const db = await getDb();

    // Snapshot de segurança: grava o estado ANTES de sobrescrever, tal como o
    // sistema de backup faz para a BD inteira, mas aqui ao nível de um único curso —
    // permite comparar/restaurar versões anteriores em app/api/admin/courses/[courseId]/versions.
    if (modules) {
      const current = await db.collection("courses").findOne({ _id: new ObjectId(courseId), tenant_id: tenantId });
      if (current) {
        const lastVersion = await db
          .collection("course_versions")
          .find({ courseId: courseId.toString(), tenantId })
          .sort({ versionNumber: -1 })
          .limit(1)
          .toArray();
        const nextVersionNumber = (lastVersion[0]?.versionNumber || 0) + 1;
        await db.collection("course_versions").insertOne({
          courseId: courseId.toString(),
          tenantId,
          versionNumber: nextVersionNumber,
          title: current.title,
          modules: current.modules || [],
          editedBy: userId,
          createdAt: new Date(),
        });
      }
    }

    const updateFields: any = { updatedAt: new Date() };
    if (title) updateFields.title = title;
    if (description) updateFields.description = description;
    if (modules) updateFields.modules = modules;
    if (videoUrl !== undefined) updateFields.videoUrl = videoUrl;
    if (isPublicMarketplace !== undefined) updateFields.isPublicMarketplace = isPublicMarketplace;
    if (marketplaceDescription !== undefined) updateFields.marketplaceDescription = marketplaceDescription;

    await db.collection("courses").updateOne(
      { _id: new ObjectId(courseId), tenant_id: tenantId },
      { $set: updateFields }
    );

    await logAuditEvent(userId, "COURSE_AI_UPDATED", { courseId, title });

    const updated = await db.collection("courses").findOne({ _id: new ObjectId(courseId) });
    return NextResponse.json({ success: true, course: updated });
  } catch (error: any) {
    console.error("Erro ao atualizar curso:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
