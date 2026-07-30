import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

const REVIEWER_ROLES = ["ADMIN", "SUPORTE"];

// GET — Lista todos os pedidos de eliminação de conta do tenant (pendentes e já
// processados), para revisão por ADMIN/SUPORTE.
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

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const requests = await db
      .collection("data_deletion_requests")
      .find({ tenant_id: tenantId })
      .sort({ requestedAt: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      requests: requests.map((r: any) => ({ ...r, _id: r._id.toString() })),
    });
  } catch (error: any) {
    console.error("Erro ao listar pedidos de eliminação de conta:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
