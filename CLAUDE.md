# Instruções para Claude Code

## Idioma de comunicação

Todas as respostas do Claude Code ao utilizador neste projeto — mensagens de conversa,
explicações, resumos, perguntas — devem ser sempre escritas em Português de Portugal,
exceto quando o utilizador pedir explicitamente outro idioma numa mensagem concreta.
Esta regra aplica-se à comunicação em si, não só ao código/texto gerado (ver regra 12
abaixo, que cobre especificamente esse caso).

## Stack tecnológica (real, verificada no código)

Aplicação **Next.js fullstack única**: o frontend (App Router) e o backend (route
handlers em `app/api/`) vivem no mesmo projeto e são servidos pelo mesmo servidor.
**Não existe backend Java/Spring Boot, nem qualquer serviço separado.**

| Camada | Tecnologia | Notas |
|---|---|---|
| Framework | Next.js 16.2 (App Router, RSC, Turbopack) | ver `AGENTS.md` — breaking changes |
| UI | React 19.2 + TypeScript 5 + Tailwind CSS 4 | Tailwind via `@tailwindcss/postcss` |
| Base de dados | MongoDB (Atlas), driver `mongodb` 7 | schema-less, sem ORM nem migrations |
| Autenticação + RBAC | Clerk (`@clerk/nextjs` 7) | `middleware.ts` |
| SSO B2B | WorkOS | `lib/workos.ts` |
| CMS de conteúdos | Sanity 3 (Studio embutido em `/studio`) | `lib/sanity.ts` |
| IA | Vercel AI SDK 7 (OpenAI, Anthropic, Google) | `lib/ai/` |
| Ficheiros / uploads | Vercel Blob | não usar filesystem local |
| Vídeo | Mux | |
| Pagamentos | Stripe | |
| Alojamento + cron | Vercel | `vercel.json` |

## Antes de gerar qualquer código

1. Ler `AGENTS.md`. Esta versão do Next.js tem breaking changes face ao conhecimento
   pré-treinado: consultar `node_modules/next/dist/docs/` antes de escrever código de
   framework (rotas, params, caching, server actions).
2. Ler `docs/DEPLOYMENT.md` antes de mexer em configuração, variáveis de ambiente ou
   qualquer coisa que afete o deployment.
3. Preferir sempre reutilizar os helpers já existentes em `lib/` a criar novos.
4. **Nunca alterar a stack tecnológica** nem introduzir tecnologias não autorizadas.
   Em particular: não adicionar ORMs, não adicionar bases de dados relacionais, não
   substituir o Clerk, não introduzir uma API separada do Next.js.
5. Seguir os princípios SOLID, Clean Code e Clean Architecture, adaptados ao modelo do
   Next.js: componentes e route handlers finos, lógica de negócio isolada em `lib/`.
6. Produzir código de nível empresarial e preparado para produção.
7. **RBAC em todo o sistema.** Os dez perfis são `ADMIN`, `SUPORTE`, `GESTOR_EMPRESA`,
   `GESTOR_ACADEMICO`, `PROFESSOR`, `FORMADOR`, `TUTOR`, `ALUNO`, `FINANCEIRO` e
   `FUNCIONARIO` — definidos em `lib/seeder.ts` (`ROLES_DATA`), a par do catálogo de
   permissões (`PERMISSIONS_DATA`). O perfil ativo vive no cookie `active-role`.
   Quem pode abrir que rota está em `lib/route-access.ts`: uma rota nova protegida
   acrescenta-se ao `isProtectedRoute` de `middleware.ts` e, se tiver restrição de perfil,
   a `ROUTE_ACCESS_RULES` — não se escrevem listas de perfis dentro do middleware.
   Esconder um item no menu não é proteger a rota: o menu é aparência, a tabela é a
   barreira. Alterações a perfis ou permissões fazem-se no seeder e propagam-se à base de
   dados com `npm run perms:sync -- --apply`; `seedSecurityData()` apaga os utilizadores
   e não pode ser corrido numa base com contas reais.
8. **Multi-tenancy obrigatório.** Os documentos de dados têm `tenant_id` e todo o acesso
   tem de passar pelos helpers de `lib/mongodb.ts` — `findTenantScoped`,
   `findOneTenantScoped`, `insertTenantScoped`, `updateTenantScoped`,
   `deleteTenantScoped` — nunca por `db.collection(...).find()` direto. O tenant é
   resolvido no `middleware.ts` e injetado no header `x-tenant-id`.
   Exceção: as coleções de identidade e segurança (`users`, `roles`, `permissions`) são
   globais e **não** têm `tenant_id` — nos utilizadores, o âmbito vive no array `tenants`
   de cada documento, porque a mesma pessoa pode ter perfis diferentes em empresas
   diferentes. Acedem-se por `lib/users.ts`, nunca pelos helpers `*TenantScoped`, que
   filtrariam por um campo inexistente e devolveriam sempre vazio.
9. Segredos apenas em variáveis de ambiente, documentadas em `.env.example`. Nunca
   expor ao browser um segredo sem o prefixo `NEXT_PUBLIC_` — e nunca dar esse prefixo a
   um valor que deva permanecer secreto (ex.: `SANITY_API_WRITE_TOKEN`).
10. TypeScript estrito: sem `any` não justificado, sem `@ts-ignore` sem comentário a
    explicar porquê.
11. Validar sempre com `npm run build` e `npx tsc --noEmit` — o build de produção é mais
    estrito do que `next dev`.
12. Escrever sempre em Português de Portugal (identificadores de código em inglês,
    comentários, textos de interface e documentação em português), exceto quando existir
    uma instrução explícita para utilizar outro idioma.

## Documentação adicional

- `AGENTS.md` — avisos sobre a versão do Next.js.
- `docs/DEPLOYMENT.md` — runbook de deployment, variáveis de ambiente e checklist.
