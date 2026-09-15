import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { getTenantId } from "@/lib/session";

// GET — Lista os requisitos de projeto (obrigatoriedade + prazo de entrega) definidos por
// curso, para o tenant atual. Usado tanto pela página de submissão do aluno (para mostrar
// se o projeto é obrigatório e qual o prazo) como pela emissão de certificados (para saber
// se falta um projeto aprovado antes de certificar o curso).
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = await getTenantId();
    const db = await getDb();

    const requirements = await db
      .collection("project_requirements")
      .find({ tenant_id: tenantId })
      .toArray();

    return NextResponse.json({
      success: true,
      requirements: requirements.map((r: any) => ({ ...r, _id: r._id.toString() })),
    });
  } catch (error: any) {
    console.error("Erro ao ler requisitos de projetos:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
