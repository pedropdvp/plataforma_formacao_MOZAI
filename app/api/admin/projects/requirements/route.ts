import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

// Regra de negócio: só Admin e Professor definem se um projeto é obrigatório e o prazo
// de entrega — os mesmos que avaliam as submissões.
const REVIEWER_ROLES = ["ADMIN", "PROFESSOR"];

// POST — Define (cria ou atualiza) o requisito de projeto de um curso: se é obrigatório
// para a emissão do certificado, e o prazo de entrega definido pelo Professor/Admin.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !REVIEWER_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Só Admin ou Professor podem definir requisitos de projeto." }, { status: 403 });
    }

    const { courseId, courseTitle, isRequired, dueDate } = await req.json();
    if (!courseId) {
      return NextResponse.json({ error: "Campo 'courseId' é obrigatório." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    await db.collection("project_requirements").updateOne(
      { tenant_id: tenantId, courseId },
      {
        $set: {
          tenant_id: tenantId,
          courseId,
          courseTitle: courseTitle || "Curso",
          isRequired: !!isRequired,
          dueDate: dueDate ? new Date(dueDate) : null,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    await logAuditEvent(userId, "PROJECT_REQUIREMENT_SET", {
      tenantId,
      courseId,
      isRequired: !!isRequired,
      dueDate,
    });

    return NextResponse.json({ success: true, message: "Requisito de projeto do curso guardado com sucesso." });
  } catch (error: any) {
    console.error("Erro ao definir requisito de projeto:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
