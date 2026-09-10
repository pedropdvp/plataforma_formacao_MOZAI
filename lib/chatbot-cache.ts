import { getDb } from "@/lib/mongodb";

/**
 * Cache de respostas a perguntas frequentes.
 *
 * Numa turma ou numa demonstração, a mesma pergunta chega dezenas de vezes — e sem cache
 * cada uma delas é uma chamada paga ao modelo, com a mesma resposta no fim. Guardar a
 * primeira e servi-la às seguintes corta esse custo e responde de imediato.
 *
 * Duas regras dão-lhe a segurança:
 *
 * 1. **A cache não atravessa empresas.** A chave inclui o `tenantId`, porque a resposta é
 *    construída com o conhecimento carregado por essa empresa — servir a um cliente a
 *    resposta gerada para outro seria uma fuga de contexto, não uma optimização.
 * 2. **Só entram perguntas "frescas"** (ver `isCacheable`): primeira mensagem da conversa,
 *    sem histórico, sem resumo, sem anexo e sem pesquisa Web. Uma resposta que dependeu do
 *    contexto de uma conversa não é reutilizável noutra.
 *
 * O campo `hits` conta quantas vezes cada resposta foi reaproveitada, e é o que alimenta
 * as "Perguntas mais frequentes" do painel de monitorização.
 */

const COLLECTION = "chatbot_qa_cache";

/** Ao fim de quantos dias uma resposta guardada deixa de ser servida. A base de
 *  conhecimento muda, e uma resposta de há meses pode já não ser verdade. */
const TTL_DAYS = Number(process.env.CHATBOT_CACHE_TTL_DAYS || 30);

/** Perguntas muito curtas ("ok", "sim") não identificam nada e encheriam a cache de lixo. */
const MIN_QUESTION_LEN = 8;

/**
 * Reduz a pergunta à sua forma comparável: minúsculas, sem acentos, sem pontuação e com
 * os espaços colapsados. É o que faz "Como me inscrevo?" e "como me inscrevo" contarem
 * como a mesma pergunta.
 */
export function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Uma pergunta só é elegível para cache se não depender de nada além de si própria. */
export function isCacheable(opts: {
  historyLength: number;
  hasSummary: boolean;
  hasAttachment: boolean;
  webSearch: boolean;
  regenerate: boolean;
  message: string;
}): boolean {
  return (
    opts.historyLength === 0 &&
    !opts.hasSummary &&
    !opts.hasAttachment &&
    !opts.webSearch &&
    !opts.regenerate &&
    normalizeQuestion(opts.message).length >= MIN_QUESTION_LEN
  );
}

/**
 * Devolve a resposta guardada para esta pergunta, ou `null`. Incrementa `hits` quando
 * acerta — a contagem serve as estatísticas e não deve depender de quem perguntou.
 */
export async function getCachedAnswer(
  tenantId: string,
  lang: string,
  question: string
): Promise<string | null> {
  const normalized = normalizeQuestion(question);
  if (!normalized) return null;

  const db = await getDb();
  const limite = new Date(Date.now() - TTL_DAYS * 24 * 60 * 60 * 1000);

  const row = await db.collection(COLLECTION).findOneAndUpdate(
    { tenantId, lang, question: normalized, createdAt: { $gt: limite } },
    { $inc: { hits: 1 }, $set: { lastHitAt: new Date() } },
    { returnDocument: "after" }
  );

  // O driver do MongoDB devolve o documento directamente ou dentro de `.value`,
  // consoante a versão — aceitar ambos evita uma cache que nunca acerta.
  const resultado = row as { value?: CacheDoc } | CacheDoc | null;
  const doc = (resultado && "value" in resultado ? resultado.value : resultado) as CacheDoc | null;
  return doc?.answer || null;
}

/** Guarda (ou renova) a resposta a uma pergunta fresca. */
export async function putCachedAnswer(
  tenantId: string,
  lang: string,
  question: string,
  answer: string
): Promise<void> {
  const normalized = normalizeQuestion(question);
  if (!normalized || !answer.trim()) return;

  const db = await getDb();
  await db.collection(COLLECTION).updateOne(
    { tenantId, lang, question: normalized },
    {
      // `createdAt` é reescrito de propósito: uma resposta regenerada volta a contar
      // o seu TTL do zero, em vez de expirar à conta da versão anterior.
      $set: { answer, createdAt: new Date() },
      $setOnInsert: { tenantId, lang, question: normalized, hits: 0 },
    },
    { upsert: true }
  );
}

/** Documento tal como é guardado na colecção. */
interface CacheDoc {
  tenantId: string;
  lang: string;
  question: string;
  answer: string;
  hits?: number;
  createdAt: Date;
}

export interface CachedQuestion {
  question: string;
  hits: number;
  lang: string;
}

/** As perguntas mais reaproveitadas, para o painel de monitorização. */
export async function getTopCachedQuestions(
  tenantId: string,
  limit = 10
): Promise<CachedQuestion[]> {
  const db = await getDb();
  const rows = await db
    .collection(COLLECTION)
    .find({ tenantId, hits: { $gt: 0 } })
    .sort({ hits: -1, createdAt: -1 })
    .limit(limit)
    .toArray();
  return (rows as CacheDoc[]).map((r) => ({ question: r.question, hits: r.hits || 0, lang: r.lang || "pt" }));
}

/** Total de respostas servidas a partir da cache — chamadas ao modelo que não aconteceram. */
export async function countCacheHits(tenantId: string): Promise<number> {
  const db = await getDb();
  const rows = await db.collection(COLLECTION).find({ tenantId }).toArray();
  return (rows as CacheDoc[]).reduce((total, r) => total + (r.hits || 0), 0);
}
