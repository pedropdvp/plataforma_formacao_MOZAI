/**
 * Perfis autorizados por rota — fonte única do RBAC de navegação.
 *
 * Antes, estas regras viviam como uma cascata de `if (path.startsWith(...)) allowedRoles.push(...)`
 * dentro do middleware, e só cobriam `/dashboard/admin`. Tudo o resto ficava protegido
 * apenas por o item não aparecer no menu — o que esconde, mas não impede: bastava escrever
 * o endereço. Tê-las aqui, em dados, permite que o middleware as aplique e que outras
 * camadas (menu, testes, documentação da matriz de acessos) leiam as mesmas regras em vez
 * de reconstruírem cada uma a sua versão.
 *
 * Este módulo é propositadamente puro — sem acesso a base de dados — porque corre no
 * middleware (edge runtime). O que aqui se decide é ao nível do PERFIL ativo; as
 * permissões finas de cada perfil vivem na coleção `roles` e são aplicadas dentro das
 * páginas e das rotas de API.
 */

export interface RouteAccessRule {
  /** Prefixo da rota (ou caminho completo, quando `exact`). */
  prefix: string;
  /** Perfis que podem entrar. */
  roles: string[];
  /** Aplica-se apenas ao caminho exato, não aos seus descendentes. */
  exact?: boolean;
}

const ADMIN_ONLY = ["ADMIN"];
const PLATFORM = ["ADMIN", "SUPORTE"];
const PLATFORM_AND_COMPANY = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA"];
/**
 * O Funcionário é o delegado operacional do Gestor Empresa ("tarefas operacionais
 * delegadas, gerir faturas e formandos da empresa") e o seeder dá-lhe EMPLOYEES_MANAGE,
 * STUDENTS_MANAGE, COURSES_SCHEDULE e COMPANY_INFO_UPDATE. O menu mostrava-lhe as páginas
 * correspondentes por causa dessas permissões, mas o middleware nunca o tinha contemplado
 * e devolvia-o ao dashboard: via o item, clicava, e era expulso.
 */
const COMPANY_SCOPE = [...PLATFORM_AND_COMPANY, "FUNCIONARIO"];

/**
 * Ordem irrelevante: a resolução escolhe sempre a regra de prefixo mais longo (a mais
 * específica), e as regras `exact` têm precedência sobre as de prefixo do mesmo caminho.
 */
export const ROUTE_ACCESS_RULES: RouteAccessRule[] = [
  // Variáveis de Ambiente: só ADMIN. Nem o SUPORTE — saber que variáveis existem e como
  // estão preenchidas é informação de infraestrutura, e a página revela segredos.
  { prefix: "/dashboard/admin/env-check", roles: ADMIN_ONLY },

  // Consola de RH específica da empresa: o Gestor Empresa acede ao seu próprio painel.
  { prefix: "/dashboard/admin/hr", roles: COMPANY_SCOPE },

  // Fábrica de Cursos e Gerador de Conteúdo: Gestor Académico e Formadores criam
  // conteúdo; o Aluno Individual gera cursos privados seus. São duas rotas irmãs
  // (.../content-factory e .../content-factory-tools) e cada uma tem de estar escrita:
  // um prefixo só corresponde ao próprio caminho ou a descendentes seus, e "-tools" não
  // é descendente de "content-factory".
  {
    prefix: "/dashboard/admin/content-factory",
    roles: [...PLATFORM, "GESTOR_ACADEMICO", "FORMADOR", "ALUNO"],
  },
  {
    prefix: "/dashboard/admin/content-factory-tools",
    roles: [...PLATFORM, "GESTOR_ACADEMICO", "FORMADOR", "ALUNO"],
  },

  // Backup & Restore, API's, ChatBot e Discord: o Gestor Empresa acede em âmbito só da
  // sua empresa.
  { prefix: "/dashboard/admin/backups", roles: PLATFORM_AND_COMPANY },
  { prefix: "/dashboard/admin/api-keys", roles: PLATFORM_AND_COMPANY },
  { prefix: "/dashboard/admin/chatbot", roles: PLATFORM_AND_COMPANY },
  { prefix: "/dashboard/admin/discord", roles: PLATFORM_AND_COMPANY },

  // Academia Corporativa: currículo próprio da empresa, gerido pelo Gestor Empresa.
  { prefix: "/dashboard/admin/academy", roles: COMPANY_SCOPE },

  // Vagas de Emprego e Plugins (Marketplace): geridos pelo Gestor Empresa.
  { prefix: "/dashboard/admin/job-postings", roles: COMPANY_SCOPE },
  { prefix: "/dashboard/admin/plugins", roles: PLATFORM_AND_COMPANY },

  // Tab "Perfil da Empresa": o Gestor Empresa só vê essa tab; a Gestão de Empresas e o
  // Branding continuam exclusivos de ADMIN/SUPORTE, controlado dentro da página.
  { prefix: "/dashboard/admin", roles: COMPANY_SCOPE, exact: true },

  // Avaliação de Projetos: o catálogo de permissões declara PROJECTS_REVIEW como sendo
  // do Professor ("exclusiva de ADMIN e PROFESSOR", lib/seeder.ts), mas a rota só deixava
  // entrar a plataforma.
  { prefix: "/dashboard/admin/projects", roles: [...PLATFORM, "PROFESSOR"] },

  // Restante consola administrativa (Menus, Níveis, Perfis de acesso, Compliance, ...).
  { prefix: "/dashboard/admin", roles: PLATFORM },

  // Auditoria: registos de toda a plataforma, incluindo ações de outras empresas.
  { prefix: "/dashboard/reports/audit", roles: PLATFORM },

  // Relatórios: mostram alunos, professores, funcionários e empresas — dados de terceiros.
  // O menu já os escondia a quem não é gestor, mas a página abria a quem soubesse o
  // endereço (ficava vazia, porque /api/admin/reports/* recusa, mas abria).
  { prefix: "/dashboard/reports", roles: PLATFORM_AND_COMPANY },
];

/**
 * Perfis autorizados a abrir `path`, ou `null` se a rota não tem restrição de perfil
 * (basta estar autenticado e com um perfil ativo).
 */
export function allowedRolesForPath(path: string): string[] | null {
  let best: RouteAccessRule | null = null;

  for (const rule of ROUTE_ACCESS_RULES) {
    const matches = rule.exact
      ? path === rule.prefix
      : path === rule.prefix || path.startsWith(`${rule.prefix}/`);
    if (!matches) continue;

    if (
      !best ||
      rule.prefix.length > best.prefix.length ||
      // Entre regras do mesmo caminho, a exata é a mais específica.
      (rule.prefix.length === best.prefix.length && rule.exact && !best.exact)
    ) {
      best = rule;
    }
  }

  return best ? best.roles : null;
}

/** Conveniência para quem só quer saber se um perfil entra. */
export function canRoleAccessPath(role: string | null | undefined, path: string): boolean {
  const allowed = allowedRolesForPath(path);
  if (!allowed) return true;
  return Boolean(role && allowed.includes(role));
}
