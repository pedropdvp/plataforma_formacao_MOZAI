import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { canRoleAccessPath } from "@/lib/route-access";

// Define rotas protegidas que exigem autenticação
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/admin(.*)",
  "/api/progress(.*)",
  "/api/chat(.*)",
  "/api/history(.*)",
  "/api/career(.*)",
  "/api/coding-lab(.*)",
  "/api/admin(.*)",
  // A lista é explícita: uma rota de API fora dela fica acessível sem sessão.
  "/api/reports(.*)",
  "/api/content-factory(.*)",
  "/api/gamification(.*)",
  "/api/quiz(.*)"
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // 1. Proteger rotas que exigem login
  if (isProtectedRoute(req)) {
    if (!userId) {
      // Redireciona para o login do Clerk caso não autenticado
      await auth.protect();
    }
  }

  // 2. Extrair o subdomínio ou ler dos cookies para facilidade de simulação multi-tenancy
  let subdomain = req.cookies.get("x-tenant-id")?.value || "";

  if (!subdomain) {
    const hostname = req.headers.get("host") || "";
    const isLocalhost = hostname.includes("localhost");
    // Configurável para que o mesmo código sirva localhost, os deployments *.vercel.app
    // e o domínio próprio, sem que o host da apresentação seja lido como um subdomínio
    // (e portanto como um tenant) por acidente.
    const baseDomain = isLocalhost
      ? "localhost:3000"
      : process.env.NEXT_PUBLIC_BASE_DOMAIN || "mozai.education";
    
    if (hostname !== baseDomain) {
      subdomain = hostname.replace(`.${baseDomain}`, "");
    }
    
    if (subdomain === hostname || !subdomain) {
      subdomain = "root"; // Tenant principal/admin global ou landing page
    }
  }

  const url = req.nextUrl.clone();
  const path = url.pathname;

  // 3. Controlo de Perfis / Roles (RBAC) do Utilizador autenticado
  if (userId && path.startsWith("/dashboard")) {
    const activeRole = req.cookies.get("active-role")?.value;

    // Se não tiver perfil ativo na sessão e não estiver no ecrã de escolha, redireciona para lá
    if (!activeRole && path !== "/choose-role") {
      url.pathname = "/choose-role";
      return NextResponse.redirect(url);
    }

    // Se tiver perfil ativo, validar o acesso à rota pela tabela de lib/route-access.ts
    if (activeRole && !canRoleAccessPath(activeRole, path)) {
      // Perfil sem acesso a esta rota: devolve à raiz do dashboard
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // 4. Injetar o tenant_id extraído nos cabeçalhos da requisição
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-tenant-id", subdomain);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
},
// Pelo mesmo motivo do `app/layout.tsx`: o `auth.protect()` daqui reencaminha para o
// login, e se for buscar o destino ao ambiente herda o caminho do Windows que um shell
// MSYS lhe deixa. Escrito aqui, não há como o perder.
{ signInUrl: "/sign-in", signUpUrl: "/sign-up" });

export const config = {
  matcher: [
    // Ignora estáticos, imagens e ficheiros internos do Next.js
    "/((?!_next|[^?]*\\.(?:html|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Processa rotas de API
    "/(api|trpc)(.*)",
  ],
};
