import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getResponsibilityCounts } from "@/lib/academics";

const ALLOWED_ROLES = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA", "GESTOR_ACADEMICO"];

/**
 * GET — Quantos cursos e alunos estão à responsabilidade de cada docente, para o relatório de
 * docentes da consola. `?tenantId=` indica a empresa; `?staffIds=a,b,c` os docentes a contar.
 *
 * As contagens são sempre de UMA empresa. Em modo "todas as empresas" o relatório não as pede,
 * porque somar responsabilidades de empresas diferentes daria um número que não significa nada:
 * o mesmo docente pode dar o mesmo curso em duas empresas a alunos distintos.
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !ALLOWED_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
    }

    const tenantId = req.nextUrl.searchParams.get("tenantId") || req.headers.get("x-tenant-id") || "root";
    if (tenantId === "all") {
      return NextResponse.json({ error: "Indique uma empresa." }, { status: 400 });
    }

    const staffIds = (req.nextUrl.searchParams.get("staffIds") || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (staffIds.length === 0) {
      return NextResponse.json({ success: true, counts: {} });
    }

    const counts = await getResponsibilityCounts(tenantId, staffIds);
    return NextResponse.json({ success: true, counts });
  } catch (error: any) {
    console.error("Erro ao contar responsabilidades do corpo docente:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
