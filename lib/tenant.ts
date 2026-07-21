import { findOneTenantScoped } from "./mongodb";

export interface TenantBranding {
  tenantId: string;
  companyName: string;
  brandColor: string;
  logoUrl: string;
  ssoActive: boolean;
}

/**
 * Carrega as definições de branding do tenant ativo.
 * Retorna valores padrão (Fallback) caso o banco de dados não possua configurações guardadas.
 */
export async function getActiveTenantBranding(tenantId: string): Promise<TenantBranding> {
  try {
    const settings = await findOneTenantScoped("tenant_settings", tenantId);

    if (!settings) {
      return {
        tenantId,
        companyName: tenantId === "root" ? "MOZAI Global" : tenantId.toUpperCase(),
        brandColor: "#6366f1", // Indigo
        logoUrl: "",
        ssoActive: false,
      };
    }

    return {
      tenantId,
      companyName: settings.companyName || tenantId.toUpperCase(),
      brandColor: settings.brandColor || "#6366f1",
      logoUrl: settings.logoUrl || "",
      ssoActive: !!settings.ssoActive,
    };
  } catch (error) {
    console.error("Erro ao carregar branding do tenant ativo:", error);
    return {
      tenantId,
      companyName: tenantId === "root" ? "MOZAI Global" : tenantId.toUpperCase(),
      brandColor: "#6366f1",
      logoUrl: "",
      ssoActive: false,
    };
  }
}
