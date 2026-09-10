# Plano — Chatbot ao nível do Pharus AI, painel de monitorização e vista das variáveis

## Contexto

Três pedidos, com pontos de partida muito diferentes. O primeiro passo foi comparar o
que existe dos dois lados, e a conclusão muda o trabalho:

| Pedido | Ponto de partida real |
|---|---|
| 1. Chatbot com a flexibilidade do Pharus | **Já existe** um chatbot no MOZAI, com boa parte dessas capacidades. Faltam 7 coisas concretas. |
| 2. Painel de monitorização de uso | **Já existe** (`/dashboard/admin/chatbot`). Faltam 5 métricas e o editor de sugestões. |
| 3. Vista das *Environment Variables* | **Não existe em lado nenhum.** No projecto do website é só um atalho `.url` para o painel da Vercel. É construção de raiz. |

> Nota sobre o caminho indicado: `WEBSITE_STD` não existe no disco. O projecto é
> `APPS - CRIAÇÃO/WEBSITE_STD_Bak_PharusAI` — confirmado pelos atalhos lá dentro
> (`WEBSITE_STD_online.url`, `WEBSITE_STD—Painel_Admin_Monitoriza_uso_Chatbot.url`,
> `WEBSITE_STD_Vercel_Environment_Variables.url`).

### As duas arquitecturas não são comparáveis

O Pharus é um site estático (Vite) com uma função serverless Express e **Neon/Postgres**,
usando **Gemini**. O MOZAI é Next.js com **MongoDB** e o **Vercel AI SDK** sobre OpenAI.
Copiar código não se põe: `server/routes/chat.js` usa `sql\`\`` e o SDK do Google.

O que se transporta são as **ideias** — e há uma que o MOZAI não tem e vale por si só:
o Pharus corta custo em dois sítios (resume conversas longas, e serve de cache as
perguntas repetidas). O MOZAI envia sempre o histórico todo e chama o modelo sempre.

**Regra que atravessa o plano:** nada aqui pode contornar `tenant_id` nem o RBAC. O
chatbot do MOZAI já é multi-tenant e resolve a chave da OpenAI por empresa
(`lib/ai/tenant-api-key.ts`) — o Pharus não tem nada disso, e não se perde.

---

## Comparação, item a item

### O que o MOZAI já tem (e o Pharus não)

Personas (5, em `CHATBOT_PERSONAS`), multi-tenancy com chave de API por empresa, RBAC,
base de conhecimento por empresa além da global, entrada por voz e leitura em voz alta.

### O que falta ao MOZAI (Fase 1)

| # | Capacidade | Onde está no Pharus | Porque importa |
|---|---|---|---|
| 1 | **Resumo automático** de conversas longas | `maybeSummarize`, `SUMMARY_TRIGGER/KEEP` | O MOZAI envia o histórico todo a cada pergunta: o custo cresce com a conversa |
| 2 | **Cache de perguntas frequentes** | `qa_cache`, `normalizeQuestion` | Numa demonstração, as mesmas perguntas repetem-se — e cada uma paga |
| 3 | **Limite de histórico** (`MAX_HISTORY`) | `MAX_HISTORY_MESSAGES` | `getRecentMessages` não tem tecto explícito |
| 4 | **Regenerar** a última resposta | `regenerate` + `deleteLastAssistantMessage` | Botão que se espera hoje em qualquer chat |
| 5 | **Criatividade** (temperature 0–1) | `validateChatBody` | Controlo directo sobre o tom da resposta |
| 6 | **Multi-idioma** (pt/en/fr) | `lang` em prompts, sugestões e erros | O widget está fixo em pt-PT |
| 7 | **Erros legíveis** por categoria | `friendlyError` (quota/auth/genérico) | Hoje um 429 da OpenAI chega ao aluno como erro cru |

---

## Fase 1 — Chatbot

### 1.1 Cache de respostas — `lib/chatbot-cache.ts` (novo)

Colecção `chatbot_qa_cache`, com `tenant_id` (a cache **não** atravessa empresas — seria
uma fuga de contexto entre clientes).

Só entram perguntas "frescas": primeira mensagem da conversa, sem histórico, sem resumo,
sem anexo e sem pesquisa Web. É a regra do Pharus e é a certa: uma resposta que dependeu
de contexto não se reutiliza noutra conversa.

Normalizar a pergunta como em `normalizeQuestion` — minúsculas, sem acentos, sem
pontuação, espaços colapsados — e contar `hits`, que alimentam a métrica *Perguntas mais
frequentes* da Fase 2. TTL configurável (`CHATBOT_CACHE_TTL_DAYS`, omissão 30).

### 1.2 Resumo automático — `lib/chatbot-conversation.ts`

Acrescentar `summary` e `summarizedUntil` ao documento da conversa. Quando as mensagens
por resumir passam de `CHATBOT_SUMMARY_TRIGGER` (16), resumir as antigas e manter as
últimas `CHATBOT_SUMMARY_KEEP` (8). O resumo entra no *system prompt*.

Correr **depois** de a resposta ter sido enviada, como no Pharus — nunca a atrasar.

### 1.3 Alterações na rota — `app/api/chatbot/chat/route.ts`

Aceitar `regenerate`, `temperature` e `lang` no corpo, validados como em
`validateChatBody`. Aplicar `MAX_HISTORY` ao `getRecentMessages`. Envolver os erros do
modelo num equivalente a `friendlyError`, com as três categorias e as três línguas.

### 1.4 Motor — `lib/ai/chatbot-engine.ts`

Passar `temperature` ao `streamText`; aceitar `summary` no contexto; e o *system prompt*
passa a incluir a instrução de idioma. As personas ficam como estão.

### 1.5 Widget — `components/chatbot-widget.tsx`

Botão *Regenerar* na última resposta, selector de criatividade, selector de idioma
(que também muda `recog.lang` e a voz da leitura, hoje fixos em `pt-PT`), e as sugestões
iniciais vindas de `/api/chatbot/suggestions`.

### 1.6 Sugestões configuráveis — `app/api/chatbot/suggestions/route.ts` (novo)

`GET` público (por idioma) para o widget; `PUT` restrito a ADMIN para o painel. Guardadas
em `tenant_settings`, que já existe.

---

## Fase 2 — Painel de monitorização

Estender `app/api/admin/chatbot/stats/route.ts`, que já devolve conversas, mensagens,
tokens e mensagens por dia. **O RBAC não muda**: `ADMIN`/`SUPORTE` vêem tudo,
`GESTOR_EMPRESA` vê só a sua empresa — a rota já faz essa distinção e é para manter.

| Métrica nova | Equivalente no Pharus |
|---|---|
| Custo estimado em EUR | `PRICE_EUR_PER_MTOK` × tokens |
| Conversas por idioma | `byLang` |
| Perguntas mais frequentes | `topQuestions` (vem da cache da Fase 1) |
| Acertos da cache | `cacheHits` |
| Blocos indexados no RAG | `ragChunks` (contar `lesson_chunks` + `uploaded_chunks`) |
| Conversas nos últimos 7 dias | `conversations7d` |

Na página `app/dashboard/admin/chatbot/page.tsx`: cartões para os totais, barras para as
mensagens por dia (já existe), tabela das perguntas frequentes, e o editor das sugestões
por idioma. Reutilizar os componentes de gráfico já presentes na plataforma em vez de
importar uma biblioteca nova.

---

## Fase 3 — Vista das *Environment Variables*

### Isto merece um aviso antes do desenho

As variáveis desta plataforma incluem `CLERK_SECRET_KEY`, `MONGODB_URI` (com palavra-passe
embutida), `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `SANITY_API_WRITE_TOKEN` e
`SECRETS_ENCRYPTION_KEY`. **Uma página que mostre estes valores é, na prática, uma página
que entrega a plataforma inteira a quem lá chegar** — e uma sessão de ADMIN esquecida
aberta num computador de sala de formação chega.

A própria Vercel não mostra os valores por omissão: mostra os nomes e obriga a um clique
explícito, por variável, com a conta autenticada.

**Proposta: mostrar o que é útil sem mostrar segredos.** Na esmagadora maioria dos casos
a pergunta real é *"a variável X está definida neste ambiente?"* — e é essa que uma
página de diagnóstico deve responder.

### Desenho

Rota `app/api/admin/env-check/route.ts`, restrita a `ADMIN` (não `SUPORTE` — é o nível
mais alto), com registo em `audit_logs` de cada consulta.

Devolve, **por nome de variável**, a partir da lista de `.env.example` (que já é o
catálogo do que a aplicação exige):

- **Estado**: definida / em falta / vazia
- **Origem**: `NEXT_PUBLIC_` (visível no browser) ou apenas servidor
- **Máscara**: 4 últimos caracteres para os segredos (`sk-…a4f2`), valor inteiro só para
  as `NEXT_PUBLIC_`, que já são públicas por definição
- **Comprimento** e um aviso quando há espaços no início ou fim — foi exactamente isso
  que partiu o login em produção (ver `docs/DEPLOYMENT.md`)
- **Aviso de caminho do Windows**: um valor que devia começar por `/` e começa por `C:/`
  é o bug do Git Bash que já nos custou um dia

A página `app/dashboard/admin/env-check/page.tsx` fica em *Configuração*, ao lado de
*Menus* e *API Keys*, com o item registado em `lib/menu-registry.ts`.

### 3.2 Revelação do valor completo (via API da Vercel)

Incluído a pedido. O princípio é o da Vercel e o dos cofres de senhas: **o valor completo
nunca vem junto com a listagem** — é sempre um pedido à parte, por variável, deliberado
e registado.

**Rota** `app/api/admin/env-check/[key]/reveal/route.ts`, `POST` (nunca `GET`: um `GET`
fica no histórico do browser, em logs de proxy e pode ser disparado por um link).
Restrita a `ADMIN`.

**Como obtém o valor.** `GET https://api.vercel.com/v9/projects/{projectId}/env/{envId}`
da API da Vercel, que devolve o valor decifrado para variáveis do tipo `encrypted`.
Precisa de:

| Variável | Para quê |
|---|---|
| `VERCEL_API_TOKEN` | Token de conta com acesso de leitura ao projecto |
| `VERCEL_PROJECT_ID` | `prj_uLgeDnvarIgmz4QnPugp0wrEwj3m` (está em `.vercel/project.json`) |
| `VERCEL_TEAM_ID` | `team_mWejoBFQcwo1q2nAXDluxrSW`, como parâmetro `teamId` |

Sem `VERCEL_API_TOKEN` a funcionalidade **não existe** — a rota responde 503 e o botão
não aparece. É o comportamento certo: quem não configurou o token não fica com um botão
que promete o que não pode cumprir.

**Salvaguardas**, e nenhuma é decorativa:

1. **Uma variável de cada vez.** Não há "revelar todas" — obriga a um acto deliberado por
   segredo e limita o estrago de um clique distraído.
2. **Auditoria antes de revelar.** `logAuditEvent(userId, "ENV_VAR_REVEALED", { key })`
   é gravado **antes** de responder. Se a gravação falhar, não se revela: um segredo
   mostrado sem rasto é pior do que um segredo não mostrado.
3. **Confirmação explícita** na interface, nomeando a variável — não um `confirm()`
   genérico que se despacha sem ler.
4. **Nunca no ecrã por omissão.** O valor aparece, copia-se, e desaparece ao fim de 30
   segundos ou ao mudar de página. Não fica atrás numa aba esquecida.
5. **O valor não é registado** em lado nenhum — nem no log de auditoria, nem em
   `console`, nem em cache do Next. A rota devolve `Cache-Control: no-store`.
6. **Limite de ritmo**: um máximo por minuto e por utilizador, contado em
   `audit_logs`. Uma varredura de segredos deixa de ser um script de dez segundos.

**O que isto não protege.** Um ADMIN comprometido continua a poder ver os segredos — é
inerente ao pedido. O que se ganha é saber **quem viu o quê e quando**, e que essa
resposta exista depois de um incidente. Por isso a rotação de chaves depois de uma
revelação em computador alheio continua a ser a atitude certa, e é o que o ecrã deve
dizer.

---

## Ficheiros

**Novos:** `lib/chatbot-cache.ts` · `app/api/chatbot/suggestions/route.ts` ·
`app/api/admin/env-check/route.ts` · `app/api/admin/env-check/[key]/reveal/route.ts` ·
`app/dashboard/admin/env-check/page.tsx`

**Alterados:** `lib/ai/chatbot-engine.ts` · `lib/chatbot-conversation.ts` ·
`app/api/chatbot/chat/route.ts` · `app/api/admin/chatbot/stats/route.ts` ·
`components/chatbot-widget.tsx` · `app/dashboard/admin/chatbot/page.tsx` ·
`lib/menu-registry.ts` · `middleware.ts` (rota nova no RBAC) · `.env.example`

**Reutilizar** (não recriar): os helpers `*TenantScoped` de `lib/mongodb.ts`,
`resolveOpenAIKeyForTenant`, `logAuditEvent`, `SecureRender` e o `useToast`.

**Variáveis novas** (todas com valor por omissão, nenhuma obrigatória):
`CHATBOT_MAX_HISTORY` · `CHATBOT_SUMMARY_TRIGGER` · `CHATBOT_SUMMARY_KEEP` ·
`CHATBOT_CACHE_TTL_DAYS` · `CHATBOT_PRICE_EUR_PER_MTOK`

**Variáveis da revelação** (opcionais — sem elas a funcionalidade fica desligada):
`VERCEL_API_TOKEN` · `VERCEL_PROJECT_ID` · `VERCEL_TEAM_ID`

---

## Verificação

1. `npm run build` e `npx tsc --noEmit` — o build de produção é mais estrito que `dev`.
2. **Cache**: fazer a mesma pergunta em duas conversas novas; a segunda responde sem
   consumir tokens, e `cacheHits` sobe no painel.
3. **Isolamento entre empresas**: a mesma pergunta como `GESTOR_EMPRESA` de duas empresas
   diferentes **não** pode devolver a resposta em cache da outra. É o teste que prova que
   a cache respeita o `tenant_id`.
4. **Resumo**: passar das 16 mensagens e confirmar em `chatbot_conversations` que
   `summary` foi preenchido e que as chamadas seguintes enviam menos histórico.
5. **Regenerar**: a resposta é substituída, não duplicada.
6. **Painel**: com `GESTOR_EMPRESA`, os números têm de ser só da empresa activa.
7. **Env-check**: confirmar que nenhum valor completo de segredo aparece na resposta da
   listagem — inspeccionar a rede no browser, não só o ecrã.
8. **Revelação**: sem `VERCEL_API_TOKEN`, a rota responde 503 e o botão não aparece. Com
   token, revelar uma variável e confirmar que ficou uma entrada `ENV_VAR_REVEALED` em
   `audit_logs` **sem o valor lá dentro**, e que a segunda tentativa no mesmo minuto é
   recusada.
9. Ensaiar em produção depois do deploy, noutro computador (secção 5 do
   `docs/DEPLOYMENT.md`).

## Sequência sugerida

Fase 1 e Fase 2 estão acopladas — as *Perguntas mais frequentes* do painel vêm da cache
da Fase 1, por isso 1 antes de 2. A Fase 3 é independente e pode ser feita primeiro se
for a mais urgente.
