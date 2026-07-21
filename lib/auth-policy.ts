import { getDb } from "./mongodb";

export interface UserSessionData {
  userId: string;
  activeRole: string | null;
  assignedRoles: string[];
  permissions: string[];
  tenantId: string;
  globalAdmin: boolean;
}

/**
 * ABAC Policy: Determina se o utilizador pode aceder aos dados de uma empresa específica.
 * Regra: O utilizador tem de pertencer ao mesmo tenantId, OU possuir papel ADMIN/SUPORTE no tenant raiz.
 */
export function canAccessCompanyData(user: UserSessionData, targetTenantId: string): boolean {
  if (user.activeRole === "ADMIN" || user.activeRole === "SUPORTE") {
    return true;
  }
  return user.tenantId === targetTenantId;
}

/**
 * ABAC Policy: Restrições de acesso a dados confidenciais financeiros/pedagógicos.
 * Regra: O perfil de SUPORTE técnico NÃO deve ter acesso a dados financeiros e pedagógicos detalhados,
 * apenas ADMIN, FINANCEIRO e gestores/funcionários do respetivo tenant têm autorização.
 */
export function canAccessFinancialDetails(user: UserSessionData): boolean {
  if (user.activeRole === "SUPORTE") {
    return false;
  }
  return ["ADMIN", "FINANCEIRO", "GESTOR_EMPRESA", "FUNCIONARIO"].includes(user.activeRole || "");
}

/**
 * ABAC Policy: Prevenção de fuga de utilizadores entre tenants (cross-tenant leakage).
 * Regra: Gestores e Funcionários de empresa B2B só podem gerir utilizadores pertencentes ao mesmo Tenant.
 */
export async function canManageUserInTenant(
  actor: UserSessionData,
  targetUserEmail: string,
  targetTenantId: string
): Promise<boolean> {
  // Administradores e Suporte globais podem gerir técnicos e criar utilizadores de forma livre
  if (actor.activeRole === "ADMIN" || actor.activeRole === "SUPORTE") {
    return true;
  }

  // Garantir isolamento de contexto de tenant
  if (actor.tenantId !== targetTenantId) {
    return false;
  }

  const db = await getDb();
  const targetUser = await db.collection("users").findOne({
    email: targetUserEmail.toLowerCase().trim()
  });

  if (!targetUser) {
    // Novo utilizador (pré-registo) no mesmo tenant é permitido
    return true;
  }

  // Garantir que o utilizador-alvo já pertence ou está associado a este tenant
  const isAffiliated = targetUser.tenants?.some((t: any) => t.tenantId === targetTenantId);
  return !!isAffiliated;
}
