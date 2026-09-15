import "server-only";
import { redirect } from "next/navigation";
import { canRoleAccessPath } from "./route-access";
import { getAuthorizedSession, type AuthorizedSession } from "./session";

/**
 * Barreira das páginas com restrição de perfil (regras em lib/route-access.ts). Chama-se no
 * topo do page.tsx, no servidor, com o caminho da própria página.
 *
 * Substitui o que o middleware fazia por correspondência de caminhos. O Clerk descontinuou o
 * createRouteMatcher porque essa correspondência pode divergir do encaminhamento real do
 * Next.js e deixar recursos acessíveis; e um layout, sozinho, não chega, porque nem sempre
 * volta a correr quando a página muda. tests/authorization.test.ts falha se uma página
 * restrita ficar sem esta chamada.
 */
export async function requirePageAccess(
  path: string
): Promise<AuthorizedSession & { activeRole: string }> {
  const session = await getAuthorizedSession();
  if (!session) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(path)}`);
  }

  const { activeRole } = session;
  if (!activeRole) {
    redirect("/choose-role");
  }

  if (!canRoleAccessPath(activeRole, path)) {
    redirect("/dashboard");
  }

  return { ...session, activeRole };
}
