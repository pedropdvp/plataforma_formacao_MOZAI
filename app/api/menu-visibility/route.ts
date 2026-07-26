import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getHiddenMenuIdsForTenant } from "@/lib/menu-visibility";

/**
 * GET — Ids de menus ocultos para o tenant ATIVO do utilizador autenticado (derivado do
 * servidor via x-tenant-id, nunca do cliente). Usado pelo sidebar para filtrar o que mostra
 * a cada utilizador, seja qual for o seu perfil — a visibilidade é definida pelo Admin em
 * Configuração > Menus, não por permissão individual.
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const hiddenIds = await getHiddenMenuIdsForTenant(tenantId);
    return NextResponse.json({ success: true, hiddenIds });
  } catch (error: any) {
    console.error("Erro ao ler a visibilidade de menus:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
