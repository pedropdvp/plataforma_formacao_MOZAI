import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { findOneTenantScoped, updateTenantScoped } from "@/lib/mongodb";
import { getActiveRole, getTenantId } from "@/lib/session";

/**
 * Branding e SSO da empresa ativa. Esta rota respondia a qualquer pedido, com ou sem sessão:
 * bastava escolher a empresa na cookie x-tenant-id para lhe mudar o nome, o logótipo, o domínio
 * e o SSO. Consultar exige sessão; alterar fica para a plataforma, que é quem a página de
 * administração já deixava editar (`isGlobalAdmin` em app/dashboard/admin).
 */
const BRANDING_EDITORS = ["ADMIN", "SUPORTE"];

/**
 * GET: Retorna as configurações do tenant ativo (com base no cabeçalho x-tenant-id)
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const tenantId = await getTenantId();

    // Buscar no MongoDB
    const settings = await findOneTenantScoped("tenant_settings", tenantId);

    // Se não existir, retorna dados padrão
    if (!settings) {
      return NextResponse.json({
        tenant_id: tenantId,
        companyName: tenantId === "root" ? "MOZAI Global" : tenantId.toUpperCase(),
        brandColor: "#6366f1", // Indigo
        customDomain: "",
        logoUrl: "",
        ssoActive: false,
      });
    }

    return NextResponse.json(settings);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST/PUT: Atualiza as configurações do tenant ativo no MongoDB
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const activeRole = await getActiveRole();
    if (!activeRole || !BRANDING_EDITORS.includes(activeRole)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const tenantId = await getTenantId();
    const body = await req.json();

    const { companyName, brandColor, customDomain, logoUrl, ssoActive } = body;

    // Atualizar no banco de dados garantindo isolamento lógico (tenant_id)
    await updateTenantScoped(
      "tenant_settings",
      tenantId,
      {}, // Filtro básico (apenas tenant_id já é injetado pelo helper)
      {
        $set: {
          companyName: companyName || tenantId.toUpperCase(),
          brandColor: brandColor || "#6366f1",
          customDomain: customDomain || "",
          logoUrl: logoUrl || "",
          ssoActive: !!ssoActive,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
export { POST as PUT };
