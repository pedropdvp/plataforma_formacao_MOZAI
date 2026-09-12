import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

const REVIEWER_ROLES = ["ADMIN", "SUPORTE"];

// GET — Lista os pedidos de eliminação de conta (pendentes e já processados) para
// revisão por ADMIN/SUPORTE.
//
// Sem filtro por empresa, e de propósito: só perfis da plataforma revêem estes pedidos, e
// operam normalmente em "root". Enquanto a lista era filtrada pela empresa ativa, um
// pedido feito por um aluno dentro de uma empresa cliente nunca chegava a aparecer a quem
// tinha competência para o processar — ficava pendente para sempre, e o prazo de resposta
// do Art. 12.º-3 corria à mesma.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !REVIEWER_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Sem permissão para rever pedidos de eliminação de conta." }, { status: 403 });
    }

    const db = await getDb();

    const requests = await db
      .collection("data_deletion_requests")
      .find({})
      .sort({ requestedAt: -1 })
      .toArray();

    // Com a lista a abranger todas as empresas, quem revê precisa de saber de onde veio
    // cada pedido — sem isto, dois pedidos de empresas diferentes são indistinguíveis.
    // "root" não é um documento em `tenants`, e um id inválido faria o ObjectId rebentar
    // e derrubar a listagem inteira por causa de um único pedido malformado.
    const tenantIds: string[] = Array.from(
      new Set<string>((requests as any[]).map((r) => String(r.tenant_id || "")))
    ).filter((t) => t !== "" && t !== "root" && ObjectId.isValid(t));
    const tenantDocs = tenantIds.length
      ? await db
          .collection("tenants")
          .find({ _id: { $in: tenantIds.map((t) => new ObjectId(t)) } })
          .toArray()
      : [];
    const nomePorTenant = new Map<string, string>(
      tenantDocs.map((t: any) => [t._id.toString(), t.name as string])
    );

    return NextResponse.json({
      success: true,
      requests: requests.map((r: any) => ({
        ...r,
        _id: r._id.toString(),
        tenantName:
          r.tenant_id === "root" ? "MOZAI (plataforma)" : nomePorTenant.get(r.tenant_id) || r.tenant_id,
      })),
    });
  } catch (error: any) {
    console.error("Erro ao listar pedidos de eliminação de conta:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
