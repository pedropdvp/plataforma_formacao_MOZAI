# plataforma_formacao_MOZAI

Plataforma de Formação para Moçambique.

Aplicação **Next.js fullstack única**: o frontend (App Router) e o backend (route
handlers em `app/api/`) vivem no mesmo projeto e são servidos pelo mesmo servidor.

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, RSC, Turbopack) |
| UI | React 19 + TypeScript 5 + Tailwind CSS 4 |
| Base de dados | MongoDB Atlas |
| Autenticação, RBAC e multi-tenancy | Clerk |
| SSO B2B | WorkOS |
| CMS de conteúdos | Sanity (Studio em `/studio`) |
| IA | Vercel AI SDK (OpenAI, Anthropic, Google) |
| Ficheiros, vídeo e pagamentos | Vercel Blob, Mux, Stripe |
| Alojamento | Vercel |

## Arrancar localmente

```bash
npm install
cp .env.example .env.local   # e preencher os valores
npm run dev
```

Abre <http://localhost:3000>.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção (mais estrito que `dev` — correr antes de publicar) |
| `npm run lint` | ESLint |
| `npm run seed:crypto` | Semeia o curso de criptomoedas |
| `npm run index:content` | Gera os embeddings do RAG |
| `npm run verify:rag` | Confirma que o Tutor de IA responde com contexto |
| `npm run db:backup` / `db:restore` | Cópia de segurança da base de dados |
| `npm run deploy:env` | Envia as variáveis de `.env.local` para a Vercel |

## Documentação

- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — como se publica, variáveis de ambiente
  e checklist de verificação.
- [`CLAUDE.md`](CLAUDE.md) — stack, RBAC, multi-tenancy e regras para agentes.
- [`AGENTS.md`](AGENTS.md) — avisos sobre esta versão do Next.js.
