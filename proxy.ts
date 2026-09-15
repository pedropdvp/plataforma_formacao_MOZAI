import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { resolveTenantId } from "@/lib/tenant-resolution";

/**
 * Proxy do Next.js 16 (a convenção que substituiu o middleware.ts).
 *
 * Não decide quem entra. A autenticação e o controlo de perfis vivem em cada recurso:
 * - páginas com restrição de perfil: requirePageAccess() (lib/page-access.ts);
 * - restantes páginas do dashboard: app/dashboard/layout.tsx;
 * - rotas de API: auth() e getActiveRole() (lib/session.ts), no próprio handler.
 *
 * Antes, o middleware protegia uma lista de caminhos com o createRouteMatcher do Clerk, entretanto
 * descontinuado: a correspondência por caminho pode divergir do encaminhamento do Next.js, e
 * uma rota de API fora da lista ficava acessível sem sessão sem que nada o denunciasse.
 * tests/authorization.test.ts é agora o que garante que nenhuma rota nasce desprotegida.
 *
 * O clerkMiddleware() continua obrigatório: é ele que dá ao auth() o estado da sessão.
 */
export default clerkMiddleware(
  async (_auth, req) => {
    const tenantId = resolveTenantId({
      tenantCookie: req.cookies.get("x-tenant-id")?.value,
      host: req.headers.get("host"),
      baseDomain: process.env.NEXT_PUBLIC_BASE_DOMAIN,
    });

    // Sobrescreve sempre o cabeçalho: um valor enviado pelo próprio browser nunca chega às rotas.
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-tenant-id", tenantId);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  },
  // Pelo mesmo motivo do `app/layout.tsx`: as rotas de login ficam escritas aqui e não vêm do
  // ambiente, onde um shell MSYS as converte num caminho do Windows.
  { signInUrl: "/sign-in", signUpUrl: "/sign-up" }
);

export const config = {
  matcher: [
    // Ignora estáticos, imagens e ficheiros internos do Next.js
    "/((?!_next|[^?]*\\.(?:html|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Processa rotas de API
    "/(api|trpc)(.*)",
  ],
};
