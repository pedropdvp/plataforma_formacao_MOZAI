# Estado dos Testes — Plataforma MOZAI

> Registo do que já foi validado, bugs corrigidos e o que falta.
> Última atualização: 2026-07-14 · curso de teste: **Criptomoedas — Fundamentos (Nível I)**

## ✅ Validado (automatizado, confirmado)

| Área | Como foi confirmado |
|------|---------------------|
| Compilação / typecheck | `tsc --noEmit` — 0 erros em todo o projeto |
| Dependências | `npm install --legacy-peer-deps` |
| Conteúdo no Sanity | `npm run seed:crypto` → 1 categoria · 11 módulos · 19 lições |
| Indexação RAG (Atlas) | `npm run index:content` → 20 chunks persistidos, embeddings 1536 dims |
| Índice vetorial | `vector_index` criado no Atlas (1536 dims + filtros `tenant_id`/`courseId`) |
| Pesquisa semântica | `npm run verify:rag` → "Quem criou o Bitcoin?" devolve a lição correta |
| Multi-tenant | chunks com `tenant_id="root"`, curso `course-criptomoedas-n1` |

Comando de reconfirmação a qualquer momento: **`npm run verify:rag`**

## 🐞 Bugs encontrados e corrigidos

### 1. Crash ao abrir uma lição — `Cannot read properties of undefined (reading 'trim')`
- **Onde:** `components/ai-tutor-sidebar.tsx` (via `app/dashboard/courses/[courseId]/lessons/[lessonId]/page.tsx:139`).
- **Causa:** o componente usava a API antiga do `useChat` (`input`, `handleInputChange`, `handleSubmit`, `isLoading`), removida no **AI SDK v5** (`@ai-sdk/react@4.0.23` / `ai@7.0.22`). `input` vinha `undefined` → `input.trim()` rebentava.
- **Correção:**
  - Cliente reescrito com chat manual via `fetch` streaming + `useState` (input/mensagens/loading/erro geridos localmente). Já não depende da forma de `useChat`.
  - Rota `app/api/chat/route.ts`: removida a *tool* `suggestLessonRedirect` (API `parameters`/`z` obsoleta no AI SDK v5) para alinhar cliente↔servidor; devolve texto com o grounding RAG.
- **Verificação:** `tsc --noEmit` limpo. *(Falta confirmar em browser — enviar uma pergunta.)*

### 2. "Começar Estudo" / play não mostra o conteúdo do curso
- **Onde:** `app/dashboard/courses/[courseId]/lessons/[lessonId]/page.tsx` e `app/dashboard/catalog/page.tsx`.
- **Causa:** a página da lição era **100% hardcoded** (dicionário `COURSES_DATA` + "Mux Player Simulator") e **nunca lia o Sanity**. O catálogo ligava a IDs fictícios (`course-4` / `lesson-1-1`) que não existem no Sanity (real: `course-criptomoedas-n1` / `crypto-n1-l-intro`).
- **Correção:**
  - Página da lição reescrita para ser **data-driven do Sanity** (`GET_COURSE_BY_ID_QUERY` + `GET_LESSON_QUERY`), com renderização real de **Portable Text** (`@portabletext/react`), **player Mux/YouTube** real, índice de aulas navegável, e **fallback** para os cursos-demo estáticos.
  - Nova query `GET_COURSE_BY_ID_QUERY` em `lib/sanity.ts`.
  - Catálogo: card de cripto agora aponta para `course-criptomoedas-n1` + primeira lição `crypto-n1-l-intro` (campo `firstLesson`).
- **Verificação:** `tsc --noEmit` limpo. *(Falta confirmar em browser — o texto das lições deve aparecer; o vídeo mostrará "por configurar" até haver upload no Mux.)*
### 3. Catálogo tornado dinâmico (novos cursos aparecem automaticamente)
- **Onde:** `app/dashboard/catalog/page.tsx` + nova rota `app/api/catalog/route.ts`.
- **O quê:** o catálogo era hardcoded. Agora busca os cursos reais do Sanity (`/api/catalog` → GROQ com nº de lições, duração e primeira lição) e funde-os com os cursos-demo. **Criar um curso no Studio → aparece no catálogo sem tocar em código.** Os cards de pagamento/subscrição mantêm-se.
- **Verificação:** `tsc --noEmit` limpo. *(Falta confirmar em browser.)*

### 4. "Os Meus Cursos" (/dashboard) tornado dinâmico
- **Onde:** `components/courses-grid.tsx`.
- **O quê:** o grid era hardcoded (`ALL_COURSES`, links `lesson-1-1`). Agora busca `/api/catalog` (cursos reais do Sanity) + `/api/progress`, funde com os demos, deriva as **categorias dinamicamente**, calcula o **progresso real** (lições concluídas / total) e liga à **primeira lição correta** (`firstLesson`). Removido o card demo de cripto (o Sanity fornece-o).
- **Verificação:** `tsc --noEmit` limpo. *(Falta confirmar em browser.)*
### 5. Stats do dashboard alinhadas com os cursos reais
- **Onde:** `app/dashboard/page.tsx`.
- **O quê:** "Cursos em Progresso" e "Certificado Emitido" deixaram de usar a lista fixa `["course-1"..."course-4"]` e o denominador `/3`. Agora buscam o total de lições por curso do Sanity (`count(modules[]->lessons[])`, fallback 3 para demos) e contam: em progresso = iniciado mas incompleto; certificado = todas as lições concluídas com base no total real.
- **Verificação:** `tsc --noEmit` limpo. *(Falta confirmar em browser.)*

### 6. Tutor de IA recusava sempre ("tópico não abordado")
- **Onde:** `lib/vector-store.ts` (`searchRelevantContext`).
- **Causa:** a pesquisa era filtrada estritamente por `tenant_id` + `courseId`. Se a app passasse um `courseId` sem chunks (ex.: link antigo `course-4` de um build por reiniciar), a pesquisa devolvia 0 → o Tutor recusava. O `verify:rag` funcionava porque usava o `courseId` real.
- **Correção:** pesquisa robusta com fallbacks — (1) tenant+course; (2) se 0, **fallback tenant-wide** (qualquer curso do mesmo tenant, mantendo isolamento); (3) leitura direta por tenant. Adicionados logs `RAG search → tenant/course/hits` no terminal do dev.
- **Verificação:** teste com `courseId` errado (`course-4`) passou a devolver 2 resultados via fallback; `courseId` correto devolve 2. `tsc --noEmit` limpo.
- **Recomendação:** **reiniciar `npm run dev`** para carregar as chaves do `.env.local` e todo o código novo (catálogo/grid/lição dinâmicos).

### 7. Progresso do curso mostrava sempre 0% após concluir lições/quiz
- **Onde:** `app/dashboard/personal/progress/page.tsx`.
- **Causa:** a página tinha os cursos **hardcoded** com `id: "course-4"` e `totalLessons: 3`. O progresso é gravado com o `courseId` real `course-criptomoedas-n1` (20 lições) — como `course-4 ≠ course-criptomoedas-n1`, nunca encontrava lições concluídas → 0%.
- **Correção:** página tornada dinâmica — busca `/api/catalog` (cursos reais + `lessonsCount`) e calcula a % sobre o **total real de lições** (fallback demos). Removido `course-4`.
- **Verificação:** `tsc --noEmit` limpo. *(Falta confirmar em browser.)*
- **Nota:** a conclusão é **por lição** (mini-quiz de cada uma). Concluir 1 de 20 lições ≈ 5% — para 100% é preciso completar as 20. O "Fim do Curso" no rodapé é só navegação (última lição), não significa curso 100% concluído.

### 8. App presa em "Mock Database" → nada persistia (Tutor recusa + progresso 0% + quiz "sucesso" falso)
- **Onde:** `lib/mongodb.ts`.
- **Diagnóstico:** `user_progress`, `cognitive_logs` e `study_history` estavam VAZIOS no Atlas, apesar do quiz mostrar sucesso. Só `lesson_chunks` (escrito por script) tinha dados → a app estava a usar a **base de dados mock em memória**.
- **Causa:** o `getDb()` "travava" permanentemente em mock (`isMongoOffline = true`) após a 1ª falha de ligação. Se o dev server arrancou com a password Mongo errada (antes da correção), ficou preso em mock todo o processo — o `uri` é lido no arranque, por isso editar `.env.local` sem reiniciar não resolvia.
- **Correção:** removida a trava permanente; adicionado `serverSelectionTimeoutMS: 8000`, um `ping` de validação e cache da ligação saudável. Agora, se o Atlas estiver acessível, liga; se não, cai no mock só nessa chamada (com aviso claro no terminal) e volta a tentar depois.
- **Verificação:** `getDb()` liga ao Atlas real e vê os 20 chunks; `tsc --noEmit` limpo.
- **AÇÃO NECESSÁRIA:** matar TODOS os processos node antigos e reiniciar o dev (o processo em execução ainda tem o `uri` antigo em memória). Ver instruções no fim deste ficheiro.

## 🔑 Configuração corrigida durante os testes
- Token Sanity: era Viewer → substituído por **Editor** do projeto `gshtua6e`.
- `MONGODB_URI` / `MONGODB_DB`: removidas linhas placeholder duplicadas que prevaleciam.
- `OPENAI_API_KEY`: estava com um token Sanity por engano → substituída por chave `sk-proj-...`.
- Utilizador Atlas: password corrigida (resolveu `bad auth`).

## ⏳ Por fazer

### Testes de browser (dependem de sessão real — plano interativo)
- Login Clerk (`/sign-in`, `/sign-up`)
- Percorrer todos os menus da sidebar (Aprendizagem, Comunicação, Financeiro, Pessoal, Workspace, Guias)
- **Tutor de IA (3 perguntas):** do curso responde · fora do curso recusa · capítulo avançado explica
- Cartão "Gestão de Conteúdos" em `/dashboard/admin` abre `/studio`

### Integrações opcionais (chaves em placeholder)
- **Stripe** (pagamentos/mensalidades) — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Mux** (vídeo das lições) — `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`
- **WorkOS** (SSO/SAML) — `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`

### Webhook de reindexação
- Testável só com URL público (deploy). Endpoint: `/api/sanity-webhook` (secret `SANITY_WEBHOOK_SECRET`).

## Referências
- Plano de teste detalhado: `TESTE_PLATAFORMA.md`
- Checklist interativa: artifact publicado (config/RAG/multi-tenant pré-marcados)
