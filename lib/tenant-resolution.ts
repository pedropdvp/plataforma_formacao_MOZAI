/**
 * Tenant de um pedido, em duas etapas — porque só a segunda sabe quem está autenticado:
 *
 * 1. resolveTenantId — o proxy.ts escolhe o tenant pedido (cookie `x-tenant-id`, subdomínio ou
 *    raiz) e injeta-o no cabeçalho `x-tenant-id`. O valor vem do browser e ainda não foi
 *    confrontado com ninguém.
 * 2. authorizeTenant — getTenantId() (lib/session.ts) confronta esse pedido com as empresas a
 *    que o utilizador pertence. É aqui que um Gestor de Empresa deixa de poder ler os dados de
 *    outra empresa só por mudar a cookie.
 *
 * Módulo puro para se poder testar sem arrancar o servidor.
 */

export const ROOT_TENANT = "root";
export const TENANT_HEADER = "x-tenant-id";
const DEFAULT_BASE_DOMAIN = "mozai.education";

/** Perfis da plataforma: operam sobre qualquer empresa (ver canAccessCompanyData em lib/auth-policy.ts). */
export const PLATFORM_ROLES = ["ADMIN", "SUPORTE"];

export interface TenantRequestInfo {
  tenantCookie?: string;
  host?: string | null;
  /** NEXT_PUBLIC_BASE_DOMAIN — o host do deployment na Vercel, ou o domínio próprio. */
  baseDomain?: string;
}

export function resolveTenantId({ tenantCookie, host, baseDomain }: TenantRequestInfo): string {
  if (tenantCookie) return tenantCookie;

  const hostname = host ?? "";

  // Em localhost o domínio base é o próprio "localhost:<porta>", seja qual for a porta. Estava
  // fixo em "localhost:3000", e os subdomínios de teste deixavam de funcionar quando o servidor
  // arrancava noutra porta — o que acontece sempre que a 3000 já está ocupada.
  const localhostIndex = hostname.indexOf("localhost");
  const domain = localhostIndex >= 0 ? hostname.slice(localhostIndex) : baseDomain || DEFAULT_BASE_DOMAIN;

  // Só um subdomínio do próprio domínio base é tenant. Qualquer outro host cai no tenant raiz,
  // em vez de o resto do nome ser lido como uma empresa.
  if (hostname === domain || !hostname.endsWith(`.${domain}`)) return ROOT_TENANT;
  return hostname.slice(0, -(domain.length + 1)) || ROOT_TENANT;
}

export interface TenantMembership {
  tenantId: string;
  roles?: string[];
}

export interface TenantAuthorizationInput {
  requestedTenantId: string;
  memberships: TenantMembership[];
  assignedRoles: string[];
  activeRole?: string;
}

/**
 * Tenant sobre o qual o utilizador pode de facto operar.
 *
 * - Quem tem um perfil da plataforma atribuído opera sobre a empresa pedida: é o que permite ao
 *   Administrador acompanhar e testar qualquer empresa.
 * - Os restantes só operam sobre empresas a que pertencem. Um pedido para outra empresa não é
 *   recusado — fica na empresa do perfil ativo, ou na primeira a que pertence, como se a cookie
 *   não existisse. Recusar partiria a sessão de quem traz uma cookie antiga; aceitar abria os
 *   dados de terceiros.
 */
export function authorizeTenant({
  requestedTenantId,
  memberships,
  assignedRoles,
  activeRole,
}: TenantAuthorizationInput): string {
  if (assignedRoles.some((role) => PLATFORM_ROLES.includes(role))) return requestedTenantId;
  if (memberships.some((membership) => membership.tenantId === requestedTenantId)) return requestedTenantId;

  const activeRoleTenant = activeRole
    ? memberships.find((membership) => membership.roles?.includes(activeRole))
    : undefined;
  return activeRoleTenant?.tenantId ?? memberships[0]?.tenantId ?? ROOT_TENANT;
}
