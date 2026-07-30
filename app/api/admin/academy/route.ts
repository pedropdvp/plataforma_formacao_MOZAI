import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

const REVIEWER_ROLES = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA"];

// GET — Currículo da Academia Corporativa do tenant: nome próprio e lista de cursos
// que fazem parte dela — distinto do catálogo global da MOZAI. Sem isto configurado,
// devolve um currículo vazio (a empresa ainda não definiu a sua Academia).
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const curriculum = await db.collection("academy_curricula").findOne({ tenant_id: tenantId });

    return NextResponse.json({
      success: true,
      academyName: curriculum?.academyName || "",
      courseIds: curriculum?.courseIds || [],
    });
  } catch (error: any) {
    console.error("Erro ao ler currículo da Academia Corporativa:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Define (cria ou atualiza) o nome e o currículo (lista de cursos) da Academia
// Corporativa do tenant. Só afeta a atribuição real de cursos aos colaboradores quando
// "Aplicar a Todos os Colaboradores" for acionado em /api/admin/academy/apply-all —
// guardar aqui só define QUAL é o currículo oficial da empresa.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !REVIEWER_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Só Admin, Suporte ou Gestor de Empresa podem gerir a Academia Corporativa." }, { status: 403 });
    }

    const { academyName, courseIds } = await req.json();
    if (!Array.isArray(courseIds)) {
      return NextResponse.json({ error: "'courseIds' deve ser uma lista de IDs de curso." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    await db.collection("academy_curricula").updateOne(
      { tenant_id: tenantId },
      {
        $set: {
          tenant_id: tenantId,
          academyName: (academyName || "").trim(),
          courseIds,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    await logAuditEvent(userId, "ACADEMY_CURRICULUM_UPDATED", { tenantId, academyName, courseCount: courseIds.length });

    return NextResponse.json({ success: true, message: "Currículo da Academia Corporativa guardado com sucesso." });
  } catch (error: any) {
    console.error("Erro ao guardar currículo da Academia Corporativa:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
