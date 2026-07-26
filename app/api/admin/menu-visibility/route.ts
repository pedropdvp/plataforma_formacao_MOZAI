import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { getHiddenMenuIdsForTenant, setHiddenMenuIdsForTenant } from "@/lib/menu-visibility";

const ALLOWED_ROLES = ["ADMIN", "SUPORTE"];

/**
 * GET — Estado de visibilidade de menus. Sem ?tenantId, devolve o da plataforma ("root")
 * mais a lista de todas as empresas (para o seletor da página). Com ?tenantId, devolve o
 * dessa empresa em concreto. Só ADMIN/SUPORTE podem gerir a visibilidade de menus de
 * qualquer tenant — ao contrário de Backup/API's, aqui não há âmbito "Gestor Empresa".
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !ALLOWED_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const requestedTenantId = req.nextUrl.searchParams.get("tenantId") || "root";
    const hiddenIds = await getHiddenMenuIdsForTenant(requestedTenantId);

    const db = await getDb();
    const tenants = await db.collection("tenants").find({}).toArray();
    const companies = tenants.map((t: any) => ({ tenantId: t._id.toString(), name: t.name }));

    return NextResponse.json({ success: true, tenantId: requestedTenantId, hiddenIds, companies });
  } catch (error: any) {
    console.error("Erro ao consultar a visibilidade de menus:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST — Define os ids de menus ocultos de um tenant específico (plataforma ou uma empresa).
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !ALLOWED_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { tenantId, hiddenIds } = await req.json();
    if (!tenantId || typeof tenantId !== "string") {
      return NextResponse.json({ error: "tenantId é obrigatório." }, { status: 400 });
    }
    if (!Array.isArray(hiddenIds) || !hiddenIds.every((id) => typeof id === "string")) {
      return NextResponse.json({ error: "hiddenIds tem de ser uma lista de strings." }, { status: 400 });
    }

    await setHiddenMenuIdsForTenant(tenantId, hiddenIds);
    await logAuditEvent(userId, "MENU_VISIBILITY_UPDATED", { tenantId, hiddenIds });

    const savedHiddenIds = await getHiddenMenuIdsForTenant(tenantId);
    return NextResponse.json({ success: true, tenantId, hiddenIds: savedHiddenIds });
  } catch (error: any) {
    console.error("Erro ao guardar a visibilidade de menus:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
