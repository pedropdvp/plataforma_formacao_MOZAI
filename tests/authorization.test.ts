import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { allowedRolesForPath } from "@/lib/route-access";

/**
 * Garantias estáticas da autorização. Desde que o proxy.ts deixou de proteger uma lista de
 * caminhos, cada recurso protege-se a si próprio — e são estes testes que impedem uma rota ou
 * uma página nova de nascer sem proteção sem que ninguém dê por isso.
 */

const ROOT = process.cwd();
const APP = join(ROOT, "app");

function filesMatching(dir: string, name: RegExp): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...filesMatching(full, name));
    else if (name.test(entry.name)) found.push(full);
  }
  return found;
}

const read = (file: string) => readFileSync(file, "utf8");
const toPosix = (path: string) => path.split(sep).join("/");
const isClientModule = (source: string) => /^\s*["']use client["']/.test(source);

/**
 * Rotas de API que não usam a sessão do Clerk porque se autenticam de outra forma. Cada uma
 * declara a marca da sua própria verificação, para esta lista não se tornar numa porta aberta.
 */
const API_ROUTES_WITHOUT_SESSION: Record<string, { reason: string; check: RegExp }> = {
  "admin/media/mux-webhook": { reason: "webhook do Mux, validado pela assinatura", check: /verifyMuxSignature\(/ },
  "auth/sso-discover": { reason: "descoberta do SSO da empresa, antes do login", check: /discoverTenantByEmailDomain/ },
  "cron/auto-update": { reason: "Vercel Cron, validado pelo CRON_SECRET", check: /CRON_SECRET/ },
  "cron/backup": { reason: "Vercel Cron, validado pelo CRON_SECRET", check: /CRON_SECRET/ },
  "public/v1/prompts/[id]/run": { reason: "API pública, validada pela chave de developer", check: /authenticateApiKey/ },
  "sanity-webhook": { reason: "webhook do Sanity, validado pelo segredo", check: /secret/i },
  "stripe/webhook": { reason: "webhook do Stripe, validado pela assinatura", check: /constructEvent\(/ },
};

const SESSION_CHECK = /\bauth\(\)|auth\.protect\(|currentUser\(|getAuthorizedSession\(|getActiveRole\(/;

describe("rotas de API", () => {
  const routes = filesMatching(join(APP, "api"), /^route\.ts$/).map((file) => ({
    file,
    id: toPosix(relative(join(APP, "api"), file)).replace(/\/?route\.ts$/, ""),
  }));

  it("todas verificam a sessão ou estão na lista de exceções", () => {
    const unprotected = routes
      .filter(({ file, id }) => !(id in API_ROUTES_WITHOUT_SESSION) && !SESSION_CHECK.test(read(file)))
      .map(({ id }) => id);
    assert.deepEqual(unprotected, [], `Rotas sem verificação de sessão: ${unprotected.join(", ")}`);
  });

  it("as exceções existem e têm a sua própria verificação", () => {
    for (const [id, { reason, check }] of Object.entries(API_ROUTES_WITHOUT_SESSION)) {
      const route = routes.find((candidate) => candidate.id === id);
      assert.ok(route, `A exceção "${id}" (${reason}) aponta para uma rota que já não existe`);
      assert.match(read(route.file), check, `A rota "${id}" devia conter ${check} (${reason})`);
    }
  });
});

describe("páginas com restrição de perfil", () => {
  const restricted = filesMatching(join(APP, "dashboard"), /^page\.tsx$/)
    .map((file) => ({
      file,
      route:
        "/" +
        toPosix(relative(APP, file))
          .split("/")
          .slice(0, -1)
          .filter((segment) => !/^\(.*\)$/.test(segment))
          .join("/"),
    }))
    .filter(({ route }) => allowedRolesForPath(route) !== null);

  it("a lista não está vazia por engano", () => {
    assert.ok(restricted.length > 0);
  });

  it("chamam requirePageAccess, no servidor, com o próprio caminho", () => {
    const unguarded = restricted
      .filter(({ file, route }) => {
        const source = read(file);
        return isClientModule(source) || !source.includes(`requirePageAccess("${route}")`);
      })
      .map(({ route }) => route);
    assert.deepEqual(unguarded, [], `Páginas restritas sem guarda: ${unguarded.join(", ")}`);
  });
});

describe("perfil ativo", () => {
  it("nenhum ficheiro do servidor lê a cookie active-role diretamente", () => {
    const directRead = /\.get\(\s*["']active-role["']\s*\)/;
    const offenders = [...filesMatching(APP, /\.tsx?$/), ...filesMatching(join(ROOT, "lib"), /\.tsx?$/)]
      .filter((file) => {
        const source = read(file);
        return !isClientModule(source) && directRead.test(source);
      })
      .map((file) => toPosix(relative(ROOT, file)));
    assert.deepEqual(offenders, [], "Usar getActiveRole() ou getAuthorizedSession() de lib/session.ts");
  });
});

describe("proxy", () => {
  it("usa a convenção proxy.ts do Next.js 16", () => {
    assert.ok(existsSync(join(ROOT, "proxy.ts")), "Falta o proxy.ts");
    assert.ok(!existsSync(join(ROOT, "middleware.ts")), "middleware.ts está descontinuado no Next.js 16");
  });

  it("não usa o createRouteMatcher descontinuado do Clerk", () => {
    const importsRouteMatcher = /import\s*\{[^}]*\bcreateRouteMatcher\b[^}]*\}\s*from\s*["']@clerk\//;
    const offenders = [
      join(ROOT, "proxy.ts"),
      ...["app", "lib", "components"].flatMap((dir) => filesMatching(join(ROOT, dir), /\.tsx?$/)),
    ]
      .filter((file) => importsRouteMatcher.test(read(file)))
      .map((file) => toPosix(relative(ROOT, file)));
    assert.deepEqual(offenders, []);
  });
});

describe("tenant", () => {
  it("nenhum ficheiro do servidor lê o cabeçalho x-tenant-id diretamente", () => {
    const directRead = /\.get\(\s*["']x-tenant-id["']\s*\)/;
    const offenders = [...filesMatching(APP, /\.tsx?$/), ...filesMatching(join(ROOT, "lib"), /\.tsx?$/)]
      .filter((file) => toPosix(relative(ROOT, file)) !== "lib/session.ts")
      .filter((file) => {
        const source = read(file);
        return !isClientModule(source) && directRead.test(source);
      })
      .map((file) => toPosix(relative(ROOT, file)));
    assert.deepEqual(offenders, [], "Usar getTenantId() de lib/session.ts, que valida a pertença à empresa");
  });
});

describe("rotas de administração", () => {
  const adminRoutes = filesMatching(join(APP, "api", "admin"), /^route\.ts$/).map((file) => ({
    file,
    id: toPosix(relative(join(APP, "api"), file)).replace(/\/route\.ts$/, ""),
  }));

  it("verificam o perfil ativo, e não só a sessão", () => {
    const roleCheck = /getActiveRole\(|getAuthorizedSession\(|canActiveRoleOpen\(/;
    const unchecked = adminRoutes
      .filter(({ file, id }) => !(id in API_ROUTES_WITHOUT_SESSION) && !roleCheck.test(read(file)))
      .map(({ id }) => id);
    assert.deepEqual(unchecked, [], `Rotas de administração sem verificação de perfil: ${unchecked.join(", ")}`);
  });

  it("as rotas de geração com IA seguem a regra das páginas que as usam", () => {
    const generationRoute = /^admin\/(content-factory-tools\/|courses\/generate\/|courses\/presence$)/;
    const unguarded = adminRoutes
      .filter(({ id }) => generationRoute.test(id))
      .filter(({ file }) => !read(file).includes("canActiveRoleOpen("))
      .map(({ id }) => id);
    assert.deepEqual(unguarded, [], `Rotas de geração sem controlo de perfil: ${unguarded.join(", ")}`);
  });
});

describe("cursos pagos", () => {
  it("o progresso e as lições verificam a compra", () => {
    for (const file of ["app/api/progress/route.ts", "app/dashboard/courses/[courseId]/lessons/[lessonId]/page.tsx"]) {
      assert.match(read(join(ROOT, file)), /canAccessCourse\(/, file);
    }
  });

  it("o simulador de checkout só funciona sem o Stripe configurado", () => {
    assert.match(read(join(ROOT, "app/api/checkout/simulate/route.ts")), /isStripeConfigured\(\)/);
  });
});
