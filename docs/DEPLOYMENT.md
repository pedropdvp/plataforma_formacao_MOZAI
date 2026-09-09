# Runbook de Deployment — Plataforma MOZAI

Objectivo: ter a plataforma acessível a partir de **qualquer computador**, bastando um
**link público** e **login**, sem instalar nada.

## Arquitectura real

Aplicação **Next.js 16 fullstack única** — frontend (App Router) e backend (`app/api/*`)
no mesmo servidor, servida em serverless na **Vercel**. Todo o estado vive em serviços
externos, por isso não há nada a migrar do disco local:

| Camada | Serviço | Configuração |
|---|---|---|
| Base de dados | MongoDB Atlas | `lib/mongodb.ts` (`MONGODB_URI`, `MONGODB_DB`) |
| Autenticação + RBAC + multi-tenancy | Clerk | `middleware.ts` |
| SSO B2B | WorkOS | `lib/workos.ts`, callback `/sso-callback` |
| CMS de conteúdos | Sanity (Studio em `/studio`) | `lib/sanity.ts` |
| Ficheiros / uploads | Vercel Blob | `@vercel/blob` |
| Vídeo | Mux | `NEXT_PUBLIC_MUX_PLAYBACK_URL` |
| Pagamentos | Stripe | webhooks |
| Tarefas agendadas | Vercel Cron | `vercel.json` (backup 03:00, auto-update 06:00) |

Projecto Vercel já ligado: `plataforma-formacao-mozai` (ver `.vercel/project.json`).

---

## 1. Serviços externos — autorizar o tráfego da Vercel

**Esta é a causa nº 1 de "funciona local mas não online".** Fazer antes do primeiro deploy.

1. **MongoDB Atlas → Network Access**: as funções serverless da Vercel usam IPs
   dinâmicos. Adicionar `0.0.0.0/0` à allowlist. Sem isto, todas as ligações esgotam o
   timeout de 8 s definido em `CONNECT_OPTIONS` e a aplicação devolve erro 500.
2. **Clerk — atenção, isto não é cosmético.** Com *development keys* (`pk_test_…`)
   num domínio publicado, uma visita **sem sessão** a uma rota protegida não é
   reencaminhada para o login: recebe **404**. Verificado em produção —
   `GET /dashboard` responde `404` com os cabeçalhos
   `X-Clerk-Auth-Reason: protect-rewrite, dev-browser-missing` e
   `X-Matched-Path: /404`. Falta o *dev browser token*, que uma instância de
   desenvolvimento do Clerk só sabe estabelecer em localhost.

   Consequência prática: entrar pela landing page e clicar em *Entrar* funciona
   (o `ClerkProvider` fixa o cookie ao carregar `/sign-in`), mas **qualquer link
   directo para `/dashboard`, e qualquer separador novo, dá 404**. Para uma
   apresentação é frágil de mais.

   A correcção robusta é uma **instância de produção do Clerk**, que exige um
   **domínio próprio** (o Clerk precisa de CNAMEs em `clerk.<dominio>` — não é
   possível em `*.vercel.app`). É a razão pela qual o domínio próprio deixa de ser
   opcional: ver "Evolução futura".
3. **Sanity → API → CORS Origins**: adicionar `https://<host>.vercel.app` com
   *Allow credentials*, senão o Studio em `/studio` e as queries de conteúdo falham.
4. **Vercel Blob**: ligar a store ao projecto e confirmar os **dois** tokens distintos
   (`BLOB_READ_WRITE_TOKEN` e `BLOB_READ_WRITE_TOKEN_PUBLIC`) — ver
   `app/api/admin/media/route.ts`.
5. **Stripe / WorkOS**: actualizar webhooks e redirect URIs para o novo host.

---

## 2. Variáveis de ambiente (ambiente Production)

A fonte de verdade é o `.env.local` desta máquina. Em vez de colar ~28 variáveis à
mão no painel — onde basta uma esquecida ou com um espaço no fim para o deploy
arrancar e só falhar na primeira consulta — usar o script que as envia todas:

```bash
npx vercel login                 # uma vez por máquina
npx vercel link                  # liga a pasta ao projecto plataforma-formacao-mozai
npm run deploy:env -- --dry-run  # lista as chaves, não envia nada
npm run deploy:env               # envia
```

O script ([`scripts/vercel-env-push.ts`](../scripts/vercel-env-push.ts)) ignora
`VERCEL_OIDC_TOKEN` (gerada pela Vercel em cada build), avisa sobre variáveis vazias,
pode voltar a correr sem limpar o painel, e **nunca imprime valores** — só nomes de
chaves.

A lista completa e comentada está em [`.env.example`](../.env.example). Atenção às três
específicas do deployment:

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_BASE_DOMAIN` | host do deployment, ex.: `mozai-demo.vercel.app` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/dashboard` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/dashboard` |

Acrescentar `NEXT_PUBLIC_BASE_DOMAIN` ao `.env.local` **antes** de correr o script.

---

## 3. Deploy

O projeto está ligado ao repositório `pedropdvp/plataforma_formacao_MOZAI` e a
integração Git funciona — cada push constrói. **Mas está a construir para *Preview*,
não para produção.** Os 100 deployments que a API do GitHub devolve estão todos com
`environment: Preview`, incluindo o mais recente; nunca houve um deployment de
produção vindo do Git.

Isso tem duas consequências que se anulam mutuamente como link de apresentação:
um URL de *preview* está atrás da *Deployment Protection* da Vercel (responde `302`
para `vercel.com/sso-api` a quem não tiver sessão na equipa), e o host de produção
continua a servir um build antigo.

**Passo que só se faz no painel, uma vez:** Settings → Git → *Production Branch* →
`master`. A partir daí:

```bash
npm run build && npx tsc --noEmit   # validar SEMPRE antes de empurrar
git push origin master
```

Se o projeto ainda não estiver ligado ao Git: painel da Vercel → Project → Settings →
Git → *Connect Git Repository*. É o único passo que exige o painel, e faz-se uma vez.

Alternativa sem Git: `npx vercel --prod`.

Notas:
- O build de produção é mais estrito que `next dev` (TypeScript + ESLint). Validar
  localmente poupa ciclos de deploy falhados.
- O `.npmrc` com `legacy-peer-deps=true` está versionado, logo o `npm install` da Vercel
  já o respeita. Não é preciso *Install Command* personalizado.
- **Criar um alias estável** (Settings → Domains), ex.: `mozai-demo.vercel.app`, para o
  link da apresentação não mudar a cada deploy.

---

## 4. Dados e contas de demonstração

Semear conteúdo com `MONGODB_URI` a apontar ao ambiente de produção:

```bash
npm run seed:crypto
npx tsx scripts/seed-security.ts
npm run index:content   # embeddings do RAG (usa TENANT_ID, default "root")
npm run verify:rag      # confirma que o Tutor de IA responde com contexto
```

Criar **uma conta Clerk por perfil** — os seis papéis reconhecidos pelo `middleware.ts`:
`ADMIN`, `SUPORTE`, `GESTOR_EMPRESA`, `GESTOR_ACADEMICO`, `FORMADOR`, `ALUNO`.
O perfil activo é escolhido em `/choose-role` e guardado no cookie `active-role`.

Preparar um cartão com o link e as credenciais de cada perfil, para poder entrar em
qualquer PC sem depender do gestor de palavras-passe pessoal.

---

## 5. Checklist de verificação (obrigatória, noutro computador)

Fazer **num PC diferente**, em rede diferente (hotspot do telemóvel), em janela anónima —
é a única forma de apanhar dependências acidentais do ambiente local.

- [ ] O link abre a landing page.
- [ ] Login como `ALUNO` → `/choose-role` → `/dashboard`.
- [ ] Abrir um curso, um **PDF** (valida `pdf-parse`/`pdfjs-dist` com
      `serverExternalPackages` em serverless) e um **vídeo Mux**.
- [ ] Perguntar algo ao **Tutor de IA** (valida `OPENAI_API_KEY` + vector store).
- [ ] Como `ALUNO`, tentar `/dashboard/admin` → deve ser bloqueado (RBAC do middleware).
- [ ] Login como `ADMIN` → consola administrativa acessível.
- [ ] **Upload** de ficheiro no admin (valida os tokens do Vercel Blob).
- [ ] Recarregar a página: os dados **persistem** (prova que o Atlas está ligado).
- [ ] *Runtime Logs* da Vercel sem `✖ MongoDB indisponível em produção`.

---

## 6. Contingência para o dia da apresentação

1. **Gravação em vídeo** (5–10 min) do percurso completo, no portátil e numa pen. É o
   fallback que nunca falha.
2. **Cópia local pronta**: `npm run dev` no portátil + `ngrok http 3000` (ou Cloudflare
   Tunnel) dá um link público alternativo em segundos.
3. **Percurso sem IA**: ter um caminho de demonstração que não passe pelo Tutor de IA —
   cursos, gamificação e consola admin funcionam só com MongoDB.
4. **Não fazer deploys nas 24h anteriores.** Apresentar sempre um build já ensaiado.
5. **Screenshots** dos ecrãs-chave como último recurso.

---

## Evolução futura (fora do âmbito da demo)

**O domínio próprio deixou de ser opcional.** A secção 1 explica porquê: sem ele o
Clerk fica numa instância de desenvolvimento, e nessa instância as rotas protegidas
respondem 404 a quem não tenha sessão. Ordem de trabalhos:

1. Apontar `mozai.education` (ou um subdomínio, ex.: `demo.mozai.education`) à Vercel.
2. Criar a instância de **produção** no Clerk para esse domínio e acrescentar os
   CNAMEs que ele indica.
3. Trocar `pk_test_`/`sk_test_` pelas chaves `pk_live_`/`sk_live_` e actualizar
   `NEXT_PUBLIC_BASE_DOMAIN`.

Fica para depois: subdomínios por tenant, ambiente de staging separado, monitorização
e alertas, rate limiting, verificação automática dos backups.
