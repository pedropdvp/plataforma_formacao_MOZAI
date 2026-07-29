import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

const REVIEWER_ROLES = ["ADMIN", "SUPORTE", "PROFESSOR", "GESTOR_ACADEMICO"];

// GET — Lista todas as submissões de projetos do tenant, para a fila de avaliação de
// formadores/administração. Requer um papel ativo com permissão de avaliação.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !REVIEWER_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Sem permissão para avaliar projetos." }, { status: 403 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const submissions = await db
      .collection("project_submissions")
      .find({ tenant_id: tenantId })
      .sort({ submittedAt: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      submissions: submissions.map((s: any) => ({ ...s, _id: s._id.toString() })),
    });
  } catch (error: any) {
    console.error("Erro ao ler fila de avaliação de projetos:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
