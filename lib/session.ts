import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "./mongodb";
import { getUserRecord, type UserRecord } from "./users";
import {
  ACTIVE_ROLE_COOKIE,
  assignedRolesOf,
  needsRoleExistenceCheck,
  resolveActiveRole,
} from "./active-role";
import { allowedRolesForPath } from "./route-access";
import { ROOT_TENANT, TENANT_HEADER, authorizeTenant } from "./tenant-resolution";

export interface AuthorizedSession {
  userId: string;
  user: UserRecord | null;
  assignedRoles: string[];
  /** Perfil ativo validado; `undefined` se não houver nenhum ou se a cookie não for aceite. */
  activeRole: string | undefined;
}

/**
 * Sessão do pedido atual: quem é (Clerk), que registo tem na base de dados e que perfil ativo
 * lhe é de facto permitido.
 *
 * É a forma de ler o perfil ativo no servidor. A cookie, lida diretamente, devolve o que o
 * browser quiser enviar — ver lib/active-role.ts —, e tests/authorization.test.ts falha se
 * alguma rota ou página voltar a fazê-lo.
 *
 * O `cache` partilha o resultado entre o layout, a página e as funções chamadas no mesmo
 * pedido, que de outra forma iriam cada uma à base de dados.
 */
export const getAuthorizedSession = cache(async (): Promise<AuthorizedSession | null> => {
  const { userId } = await auth();
  if (!userId) return null;

  const [user, cookieStore] = await Promise.all([getUserRecord(userId), cookies()]);
  const assignedRoles = assignedRolesOf(user);
  const requestedRole = cookieStore.get(ACTIVE_ROLE_COOKIE)?.value;

  let requestedRoleExists = false;
  if (requestedRole && needsRoleExistenceCheck(requestedRole, assignedRoles)) {
    const db = await getDb();
    const role = await db.collection("roles").findOne({ _id: requestedRole }, { projection: { _id: 1 } });
    requestedRoleExists = Boolean(role);
  }

  return {
    userId,
    user,
    assignedRoles,
    activeRole: resolveActiveRole(requestedRole, assignedRoles, requestedRoleExists),
  };
});

/** Perfil ativo validado do pedido atual, ou `undefined` sem sessão ou sem perfil aceite. */
export async function getActiveRole(): Promise<string | undefined> {
  return (await getAuthorizedSession())?.activeRole;
}

/**
 * Tenant sobre o qual o pedido atual pode operar — a forma de ler o tenant no servidor.
 *
 * O cabeçalho `x-tenant-id` que o proxy injeta vem, em última análise, de uma cookie que o
 * browser controla. Com sessão, o pedido é confrontado com as empresas do utilizador
 * (authorizeTenant, em lib/tenant-resolution.ts); sem sessão — páginas públicas, webhooks,
 * cron — não há a quem pertencer, e fica o tenant pedido.
 *
 * `requestedTenantId` serve as rotas que aceitam a empresa por parâmetro (relatórios, por
 * exemplo): o parâmetro passa pela mesma validação que a cookie, em vez de a contornar.
 */
export async function getTenantId(requestedTenantId?: string | null): Promise<string> {
  const headerTenantId = (await headers()).get(TENANT_HEADER) || ROOT_TENANT;
  const requested = requestedTenantId || headerTenantId;

  const session = await getAuthorizedSession();
  if (!session) return requested;

  return authorizeTenant({
    requestedTenantId: requested,
    memberships: session.user?.tenants ?? [],
    assignedRoles: session.assignedRoles,
    activeRole: session.activeRole,
  });
}

/**
 * O perfil ativo pode abrir pelo menos uma das páginas indicadas?
 *
 * Para as rotas de API que servem uma página com restrição de perfil: quem as pode chamar é
 * quem pode abrir essa página — a regra de lib/route-access.ts, em vez de uma segunda lista de
 * perfis que um dia se desencontraria da primeira. Um caminho sem regra conta como recusa, para
 * que um erro de escrita no caminho feche a rota em vez de a abrir a todos.
 */
export async function canActiveRoleOpen(...paths: string[]): Promise<boolean> {
  const activeRole = await getActiveRole();
  if (!activeRole) return false;
  return paths.some((path) => allowedRolesForPath(path)?.includes(activeRole) ?? false);
}
