# Plano de Teste — Plataforma MOZAI (Nível I)

Guia passo-a-passo para testar tudo: desde criar um curso até percorrer cada menu e botão.
Marca `[x]` à medida que validas. Base local: **http://localhost:3000**

---

## FASE 0 — Preparação do ambiente

| # | Passo | Comando / Ação | Resultado esperado |
|---|-------|----------------|--------------------|
| 0.1 | Preencher `.env.local` | `SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `SANITY_API_WRITE_TOKEN`, `OPENAI_API_KEY`, `MONGODB_URI`, `MONGODB_DB`, credenciais Clerk | Ficheiro completo |
| 0.2 | CORS Sanity | manage.sanity.io → API → CORS → add `http://localhost:3000` | Guardado |
| 0.3 | Índice vetorial Atlas | Criar `vector_index` na coleção `lesson_chunks` (1536 dims + filtros `tenant_id`/`courseId`) | Índice "Active" |
| 0.4 | Instalar deps | `npm install --legacy-peer-deps` | Sem erros |
| 0.5 | Arrancar servidor | `npm run dev` | App em `http://localhost:3000` |

- [ ] Ambiente pronto

---

## FASE 1 — Criar o curso (2 caminhos)

### Caminho A — Seed automático (rápido)
- [ ] `npm run seed:crypto` → deve imprimir "✓ Categoria", "✓ Módulo…", "✓ Curso criado"
- [ ] `npm run index:content` → deve imprimir "✓ Indexada: …" por cada lição e "✅ Indexação concluída"

### Caminho B — Sanity Studio (manual)
- [ ] Abrir **http://localhost:3000/studio** → autentica com conta Sanity
- [ ] `Categoria` → criar 1 (ex.: "Criptomoedas & Blockchain") → **Publish**
- [ ] `Lição` → criar 1: título, slug (auto), duração, `content` (Portable Text), `isFree`, quiz → **Publish**
- [ ] `Módulo` → criar 1, ordem, associar a lição → **Publish**
- [ ] `Curso` → criar 1, descrição, imagem de capa, categoria, associar módulos → **Publish**
- [ ] Reindexar após edições: `npm run index:content`

**Validar no Studio:** editar uma lição e voltar a `Publish` → confirmar que grava sem erros.

- [ ] Curso existe e está indexado

---

## FASE 2 — Acesso e navegação base

| # | Ação | Rota | Verificar |
|---|------|------|-----------|
| 2.1 | Registo | `/sign-up` | Cria conta, redireciona |
| 2.2 | Login | `/sign-in` | Entra no dashboard |
| 2.3 | Dashboard | `/dashboard` | "Área de Trabalho", sidebar visível |
| 2.4 | Sidebar — expandir/colapsar | Clicar cada grupo (Aprendizagem, Comunicação, Financeiro, Pessoal, Workspace, Guias) | Seta ▼/▶ alterna, secção abre/fecha |
| 2.5 | Branding do tenant | (após Fase 4.1) | Cor/logo/nome refletem definições |
| 2.6 | Botão de perfil (canto inf. esq.) | popover | Abre opções de conta |

- [ ] Navegação base OK

---

## FASE 3 — Grupo APRENDIZAGEM (o núcleo do curso)

| Menu | Rota | O que testar |
|------|------|--------------|
| Os Meus Cursos | `/dashboard` | O curso semeado aparece na lista |
| **Abrir curso** | `/dashboard/courses/[courseId]` | Módulos e lições carregam; player de vídeo aparece |
| **Player + Tutor IA (RAG)** | dentro do curso | Ver ponto 3.1 abaixo |
| O meu Progresso | `/dashboard/personal/progress` | Barra/percentagem de progresso |
| O Meu Histórico | `/dashboard/personal/history` | Histórico de atividade |
| Catálogo | `/dashboard/catalog` | Lista de cursos disponíveis |
| Reciclagem | `/dashboard/recycling` | Página carrega |
| Gamificação | `/dashboard/gamification` | Pontos/troféus |
| Desafios | `/dashboard/challenges` | Lista de desafios |
| Certificados | `/dashboard/certificates` | Emissão/lista |
| Diplomas | `/dashboard/diplomas` | Lista |
| Cartão Profissional | `/dashboard/professional-card` | Cartão renderiza |
| MOZAI Academy | `/dashboard/mozai-academy` | Página carrega |
| Agência de Marketing | `/dashboard/marketing-agency` | Página carrega |
| Treino com Avatares | `/dashboard/avatar-training` | Página carrega |

### 3.1 — Teste crítico do Tutor de IA (RAG) ⭐
1. [ ] Abrir uma lição do curso.
2. [ ] No chat lateral, perguntar algo **do curso**: *"Quem criou o Bitcoin?"* → deve responder **Satoshi Nakamoto** (baseado no conteúdo).
3. [ ] Perguntar algo **fora do curso**: *"Qual é a capital da França?"* → deve recusar educadamente ("esse tópico não é abordado…").
4. [ ] Perguntar sobre um capítulo avançado: *"O que é uma stablecoin?"* → deve explicar com base na lição de Stablecoins.
5. [ ] Confirmar que a resposta não inventa factos fora do material.

- [ ] Aprendizagem + RAG OK

---

## FASE 4 — Grupo WORKSPACE (admin/conteúdos)

| # | Menu | Rota | O que testar |
|---|------|------|--------------|
| 4.1 | Configurar Inquilino | `/dashboard/admin` | Preencher Nome, Cor, Domínio, Logo, SSO → **Guardar** → aparece "Configurações guardadas". Recarregar → valores persistem |
| 4.2 | **Cartão Gestão de Conteúdos** | `/dashboard/admin` (topo) | Clicar → abre `/studio` em nova aba |
| 4.3 | Consola de RH (Gaps) | `/dashboard/admin/hr` | Página carrega |
| 4.4 | Content Factory (IA) | `/dashboard/admin/content-factory` | Página carrega / gera conteúdo |
| 4.5 | Auto-Update (Engine) | `/dashboard/admin/auto-update` | Página carrega |
| 4.6 | Skills OS | `/dashboard/skills` | Grafo de competências renderiza |
| 4.7 | Coding Lab | `/dashboard/skills/coding-lab` | Editor/prática carrega |
| 4.8 | Career OS | `/dashboard/career` | Mentoria carrega |

- [ ] Workspace OK

---

## FASE 5 — Grupo COMUNICAÇÃO

- [ ] Fórum — `/dashboard/forum` (criar/ver post)
- [ ] Aulas ao Vivo — `/dashboard/live-classes`
- [ ] Notificações — `/dashboard/notifications` (sino)
- [ ] Comunidade — `/dashboard/community`
- [ ] Salas de Treino — `/dashboard/training-rooms`

---

## FASE 6 — Grupo FINANCEIRO

- [ ] Pagamentos — `/dashboard/financial/payments` (fluxo Stripe/checkout, se ativo)
- [ ] Mensalidades — `/dashboard/financial/subscriptions`
- [ ] (Checkout) — `/api/checkout` é invocado ao subscrever

---

## FASE 7 — Grupo PESSOAL

- [ ] Créditos IA — `/dashboard/personal/ai-credits` (saldo/consumo)
- [ ] Suporte — `/dashboard/personal/support`
- [ ] Telegram IA — `/dashboard/personal/telegram-ia`
- [ ] Guia do Formando — `/dashboard/personal/student-guide`
- [ ] A minha Conta — `/dashboard/personal/profile` (editar/guardar)
- [ ] Alterar Password — `/dashboard/personal/change-password`

---

## FASE 8 — Grupo GUIAS DE APOIO

- [ ] Guia de Utilização — `/dashboard/user-guide`

---

## FASE 9 — Webhook de reindexação (opcional, precisa de URL público)

> Só testável com deploy (Vercel/túnel), pois o Sanity precisa de chamar um URL acessível.

1. [ ] Deploy da app.
2. [ ] Sanity → manage → API → Webhooks → Create:
   - URL: `https://<dominio>/api/sanity-webhook`
   - Triggers: Create/Update/Delete, filtro `_type == "lesson"`
   - Header secreto = `SANITY_WEBHOOK_SECRET`
3. [ ] Editar uma lição no Studio → **Publish**.
4. [ ] Confirmar nos logs que o webhook respondeu `{ ok: true, indexed: ... }`.
5. [ ] No chat, perguntar sobre o texto alterado → resposta reflete a edição.

**Teste local rápido do endpoint** (sem Sanity):
```bash
curl -X POST http://localhost:3000/api/sanity-webhook \
  -H "sanity-webhook-secret: <o-teu-segredo>" \
  -H "Content-Type: application/json" \
  -d '{"_type":"lesson","_id":"crypto-n1-l-intro"}'
```
Esperado: `{ "ok": true, "indexed": "crypto-n1-l-intro", ... }`

---

## FASE 10 — Verificações técnicas (multi-tenant + dados)

- [ ] `db.lesson_chunks.distinct("tenant_id")` → mostra os tenants esperados (ex.: `["root"]`)
- [ ] Chat envia header `x-tenant-id` igual ao `TENANT_ID` da indexação
- [ ] Testar com 2º tenant (se aplicável): conteúdo de um não aparece no chat do outro
- [ ] Consola do browser (F12) sem erros vermelhos ao navegar
- [ ] Terminal do `npm run dev` sem erros de servidor

---

## Registo de bugs

| Página/Botão | Passo para reproduzir | Esperado | Obtido | Prioridade |
|--------------|----------------------|----------|--------|------------|
|              |                      |          |        |            |
