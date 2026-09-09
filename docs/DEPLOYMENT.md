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
2. **Clerk**: a instância é de *development* (`pk_test_…`, `clerk.accounts.dev`) e
   **funciona** num domínio publicado — o percurso `/dashboard` → `/sign-in` → login
   está verificado em produção num browser real. O que se paga: o rótulo
   *"Development mode"* no fundo do formulário e o tecto de utilizadores do plano de
   desenvolvimento. Nada disto impede uma apresentação.

   Um aviso para quem for diagnosticar: com `curl`, `/dashboard` responde **404** com
   `X-Clerk-Auth-Reason: protect-rewrite, dev-browser-missing`. **Não é uma avaria** —
   é o Clerk a exigir o *dev browser token*, que só o Clerk JS estabelece. Num browser
   a rota reencaminha para o login como deve. Testar autenticação com `curl` numa
   instância de desenvolvimento dá sempre um falso negativo.

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

**A causa era outra, e não estava no painel.** O repositório foi criado com um README
em `main` e o trabalho seguiu todo em `master`: 129 commits num lado, um no outro. Como
`main` é o branch por omissão do repositório, é dele que a Vercel publica — e por isso
não havia *Production Branch* para corrigir nas definições. O painel estava certo; os
pushes é que iam para o branch errado.

Os dois branches foram juntos e `main` passou a conter tudo. **Publicar significa
empurrar para `main`:**

```bash
npm run build && npx tsc --noEmit   # validar SEMPRE antes de empurrar
git push origin main
```

**Empurrar para `main` e mais nada.** Se empurrares primeiro para `master`, a Vercel
constrói esse SHA como *Preview* e depois deduplica o push para `main` — a produção
só actualiza alguns minutos mais tarde, ou não actualiza. Passa a trabalhar em `main`
e deixa `master` morrer: dois branches com o mesmo conteúdo é a forma de isto voltar
a acontecer.

### Variáveis de ambiente e o Git Bash

`NEXT_PUBLIC_CLERK_SIGN_IN_URL` chegou a produção como
`C:/Area de Trabalho/.../SOFTWARE/Git/sign-in`. Um valor que começa por `/` é
convertido em caminho do Windows quando passa por um shell MSYS, e o Clerk ficou a
reencaminhar para um caminho inexistente. As rotas de login deixaram de vir do
ambiente por causa disto (ver `app/layout.tsx` e `middleware.ts`), mas a armadilha
continua de pé para qualquer variável nova que comece por `/`: definir essas no painel
da Vercel, ou pelo `npm run deploy:env`, que passa os valores por stdin e escapa à
conversão.

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

**Já está tudo lá — não correr seeds.** Verificado na base de dados de produção
(`mozai_ai_edu_platform`): 2 cursos, 10 perfis, 68 permissões, 6 níveis de gamificação,
3 empresas, 16 itens de media, e o índice do RAG povoado (22 `lesson_chunks` +
934 `uploaded_chunks`, embeddings de 1536 dimensões). O `/api/catalog` responde com os
cursos reais.

**Não são precisas seis contas.** Uma só chega, e a razão está em
`app/api/auth/session/route.ts`: quem tem o perfil `ADMIN` atribuído pode passar a
**qualquer** perfil existente na coleção `roles` a partir de `/choose-role` — a
validação aceita-o desde que o perfil exista. A conta `pedropdvp@gmail.com` já tem
`ADMIN`, `ALUNO`, `SUPORTE` e `FORMADOR` em `root`, mais `GESTOR_EMPRESA` em três
empresas. Um login demonstra a plataforma inteira.

Trocar de perfil durante a apresentação: `/choose-role` → escolher → a aplicação
recarrega em `/dashboard` com o novo perfil (cookie `active-role`, 24h de validade).

### Se um dia for preciso uma conta nova com um perfil específico

Não se cria à mão na base de dados. O `GET /api/auth/session` já trata disso: basta
inserir em `users` um documento com o `email` e os `tenants[].roles` desejados, e no
primeiro login desse email o registo é re-chaveado para o `_id` do Clerk **mantendo os
perfis**. É o mecanismo de pré-registo, e evita mexer em ids do Clerk à mão.

Nota: as três empresas chamam-se "Empresa de Teste 1/2/3". Se a apresentação passar
pelo perfil `GESTOR_EMPRESA`, esses nomes aparecem no ecrã — vale a pena renomeá-las
em `/dashboard/admin` antes.

### Os scripts de seed, para memória futura

`npm run seed:crypto` escreve no **Sanity**, não no MongoDB, e usa `createOrReplace`
— é idempotente e não duplica. `npm run index:content` reconstrói os embeddings do RAG
(consome quota da OpenAI). Nenhum dos dois é necessário agora.

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

**Domínio próprio.** Não é necessário para apresentar — o `.vercel.app` serve — mas é
o que tira o rótulo *"Development mode"* e o tecto de utilizadores, porque uma
instância de produção do Clerk exige CNAMEs em `clerk.<dominio>`, impossíveis em
`*.vercel.app`. Ordem de trabalhos, quando for altura:

1. Apontar `mozai.education` (ou `demo.mozai.education`) à Vercel.
2. Criar a instância de **produção** no Clerk e acrescentar os CNAMEs que ele indica.
3. Trocar `pk_test_`/`sk_test_` por `pk_live_`/`sk_live_` e actualizar
   `NEXT_PUBLIC_BASE_DOMAIN`.

Fica para depois: subdomínios por tenant, ambiente de staging separado, monitorização
e alertas, rate limiting, verificação automática dos backups.
