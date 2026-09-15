import type { UserRecord } from "./users";

/**
 * Regra que decide se o perfil pedido na cookie "active-role" vale alguma coisa.
 *
 * A cookie é escrita por POST /api/auth/session, mas não é assinada nem httpOnly — a
 * interface lê-a para se adaptar ao perfil —, por isso o browser pode enviar o valor que
 * quiser. As rotas liam-na tal como chegava: bastava escrever "ADMIN" na cookie para passar
 * nas verificações de perfil, incluindo as que revelam variáveis de ambiente.
 *
 * O perfil só é aceite se estiver atribuído ao utilizador, ou pela exceção que o POST
 * /api/auth/session já concedia: um Administrador pode experimentar qualquer perfil que exista
 * na plataforma.
 *
 * Módulo puro, sem base de dados, para se poder testar isoladamente. Quem consulta a base de
 * dados e aplica esta regra a cada pedido é lib/session.ts.
 */

export const ACTIVE_ROLE_COOKIE = "active-role";

/** Perfil autorizado a experimentar os restantes. */
const ROLE_SWITCHER = "ADMIN";

/**
 * União dos perfis do utilizador em todas as empresas a que pertence. Um registo sem perfis é
 * ALUNO, como o GET /api/auth/session sempre assumiu; sem registo, não há perfil nenhum.
 */
export function assignedRolesOf(user: Pick<UserRecord, "tenants"> | null): string[] {
  if (!user) return [];
  const roles = Array.from(new Set((user.tenants ?? []).flatMap((tenant) => tenant.roles ?? [])));
  return roles.length > 0 ? roles : ["ALUNO"];
}

/**
 * A existência do perfil só importa quando o pedido depende da exceção do Administrador —
 * nos restantes casos a resposta já é conhecida e não se vai à base de dados.
 */
export function needsRoleExistenceCheck(requestedRole: string | undefined, assignedRoles: string[]): boolean {
  if (!requestedRole || assignedRoles.includes(requestedRole)) return false;
  return assignedRoles.includes(ROLE_SWITCHER);
}

/** Perfil ativo aceite, ou `undefined` se não houver pedido ou se o pedido não for legítimo. */
export function resolveActiveRole(
  requestedRole: string | undefined,
  assignedRoles: string[],
  requestedRoleExists = false
): string | undefined {
  if (!requestedRole) return undefined;
  if (assignedRoles.includes(requestedRole)) return requestedRole;
  if (assignedRoles.includes(ROLE_SWITCHER) && requestedRoleExists) return requestedRole;
  return undefined;
}
