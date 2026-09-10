import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

/**
 * Múltiplas conversas nomeadas por (tenant, utilizador) — cada utilizador pode ter várias
 * conversas em curso com o ChatBot (tal como o histórico de um assistente normal), pode
 * criar uma nova a qualquer momento, renomear, marcar como favorita e apagar.
 */

/** Tecto de mensagens enviadas ao modelo como histórico. Acima disto, a memória mais
 *  antiga entra pelo resumo (ver `setSummary`) em vez de ir mensagem a mensagem — é o que
 *  impede o custo de uma conversa de crescer sem limite à medida que ela se alonga. */
const MAX_HISTORY_MESSAGES = Number(process.env.CHATBOT_MAX_HISTORY || 12);
const TITLE_MAX_LEN = 60;

export interface ChatbotMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  tokens?: number;
}

/** Estado de memória de uma conversa: o resumo do que já foi dito e até quando resume. */
export interface ChatbotConversationState {
  summary: string | null;
  /** Marca temporal da última mensagem já coberta pelo resumo. */
  summarizedUntil: Date | null;
}

export interface ChatbotConversationSummary {
  id: string;
  title: string;
  favorite: boolean;
  updatedAt: Date;
}

function toObjectId(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

/** Cria sempre uma conversa NOVA (usado em "Nova conversa" e na primeira mensagem enviada
 * sem conversationId — o título fica vazio até à primeira mensagem do utilizador). */
export async function createConversation(tenantId: string, userId: string): Promise<string> {
  const db = await getDb();
  const result = await db.collection("chatbot_conversations").insertOne({
    tenantId,
    userId,
    title: "",
    favorite: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return result.insertedId.toString();
}

/** Confirma que a conversa existe e pertence a este (tenant, utilizador) — nunca deixa um
 * utilizador ler/escrever/apagar a conversa de outro. */
export async function getOwnedConversation(
  conversationId: string,
  tenantId: string,
  userId: string
): Promise<{ _id: ObjectId; title: string; favorite: boolean } | null> {
  const _id = toObjectId(conversationId);
  if (!_id) return null;
  const db = await getDb();
  const conv = await db.collection("chatbot_conversations").findOne({ _id, tenantId, userId });
  return conv ? { _id: conv._id, title: conv.title || "", favorite: !!conv.favorite } : null;
}

export async function listConversations(tenantId: string, userId: string): Promise<ChatbotConversationSummary[]> {
  const db = await getDb();
  const rows = await db
    .collection("chatbot_conversations")
    .find({ tenantId, userId })
    .sort({ favorite: -1, updatedAt: -1 })
    .toArray();
  return rows.map((r: any) => ({
    id: r._id.toString(),
    title: r.title || "Conversa",
    favorite: !!r.favorite,
    updatedAt: r.updatedAt,
  }));
}

export async function renameConversation(
  conversationId: string,
  tenantId: string,
  userId: string,
  title: string
): Promise<boolean> {
  const db = await getDb();
  const result = await db
    .collection("chatbot_conversations")
    .updateOne({ _id: new ObjectId(conversationId), tenantId, userId }, { $set: { title: title.slice(0, TITLE_MAX_LEN) } });
  return result.matchedCount > 0;
}

export async function setFavorite(
  conversationId: string,
  tenantId: string,
  userId: string,
  favorite: boolean
): Promise<boolean> {
  const db = await getDb();
  const result = await db
    .collection("chatbot_conversations")
    .updateOne({ _id: new ObjectId(conversationId), tenantId, userId }, { $set: { favorite } });
  return result.matchedCount > 0;
}

export async function deleteConversation(conversationId: string, tenantId: string, userId: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.collection("chatbot_conversations").deleteOne({ _id: new ObjectId(conversationId), tenantId, userId });
  if (result.deletedCount > 0) {
    await db.collection("chatbot_messages").deleteMany({ conversationId });
  }
  return result.deletedCount > 0;
}

/** Define o título automaticamente a partir do texto da primeira mensagem, só se ainda
 * estiver vazio (não sobrepõe um título já escolhido/renomeado pelo utilizador). */
export async function setTitleIfEmpty(conversationId: string, text: string): Promise<void> {
  const db = await getDb();
  const title = text.trim().slice(0, TITLE_MAX_LEN) || "Conversa";
  await db.collection("chatbot_conversations").updateOne(
    { _id: new ObjectId(conversationId), title: "" },
    { $set: { title } }
  );
}

export async function getRecentMessages(conversationId: string): Promise<ChatbotMessage[]> {
  const db = await getDb();
  const rows = await db
    .collection("chatbot_messages")
    .find({ conversationId })
    .sort({ createdAt: -1 })
    .limit(MAX_HISTORY_MESSAGES)
    .toArray();
  return rows.reverse().map((r: any) => ({ role: r.role, content: r.content, createdAt: r.createdAt, tokens: r.tokens }));
}

/** Todas as mensagens de uma conversa (para o widget carregar o histórico completo ao
 * abrir uma conversa antiga — {@link getRecentMessages} só devolve as últimas, usadas como
 * contexto enviado ao modelo). */
export async function getAllMessages(conversationId: string): Promise<ChatbotMessage[]> {
  const db = await getDb();
  const rows = await db.collection("chatbot_messages").find({ conversationId }).sort({ createdAt: 1 }).toArray();
  return rows.map((r: any) => ({ role: r.role, content: r.content, createdAt: r.createdAt, tokens: r.tokens }));
}

export async function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  tokens?: number
): Promise<void> {
  const db = await getDb();
  await db.collection("chatbot_messages").insertOne({
    conversationId,
    role,
    content,
    ...(tokens !== undefined ? { tokens } : {}),
    createdAt: new Date(),
  });
  await db.collection("chatbot_conversations").updateOne(
    { _id: new ObjectId(conversationId) },
    { $set: { updatedAt: new Date() } }
  );
}

/** Lê o resumo acumulado de uma conversa e até que ponto do histórico ele cobre. */
export async function getConversationState(conversationId: string): Promise<ChatbotConversationState> {
  const _id = toObjectId(conversationId);
  if (!_id) return { summary: null, summarizedUntil: null };
  const db = await getDb();
  const conv = await db.collection("chatbot_conversations").findOne({ _id });
  return {
    summary: conv?.summary || null,
    summarizedUntil: conv?.summarizedUntil ? new Date(conv.summarizedUntil) : null,
  };
}

/** Guarda o resumo e avança a marca de até onde ele cobre. */
export async function setSummary(
  conversationId: string,
  summary: string,
  summarizedUntil: Date
): Promise<void> {
  const _id = toObjectId(conversationId);
  if (!_id) return;
  const db = await getDb();
  await db.collection("chatbot_conversations").updateOne({ _id }, { $set: { summary, summarizedUntil } });
}

/** Mensagens ainda não cobertas pelo resumo, por ordem cronológica. */
export async function getMessagesAfter(
  conversationId: string,
  since: Date | null
): Promise<ChatbotMessage[]> {
  const db = await getDb();
  const filtro: Record<string, unknown> = { conversationId };
  if (since) filtro.createdAt = { $gt: since };
  const rows = await db.collection("chatbot_messages").find(filtro).sort({ createdAt: 1 }).toArray();
  return (rows as ChatbotMessage[]).map((r) => ({
    role: r.role,
    content: r.content,
    createdAt: r.createdAt,
    tokens: r.tokens,
  }));
}

/**
 * Apaga a última resposta do assistente. É o que permite "regenerar": a pergunta do
 * utilizador continua guardada e a nova resposta ocupa o lugar da anterior, em vez de a
 * conversa ficar com duas respostas seguidas à mesma pergunta.
 */
export async function deleteLastAssistantMessage(conversationId: string): Promise<boolean> {
  const db = await getDb();
  const ultima = await db
    .collection("chatbot_messages")
    .find({ conversationId, role: "assistant" })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();
  if (!ultima.length) return false;
  await db.collection("chatbot_messages").deleteOne({ _id: ultima[0]._id });
  return true;
}

/**
 * Regista o idioma em que a conversa está a decorrer.
 *
 * Sem isto não há como responder à pergunta "em que línguas nos procuram?" — as mensagens
 * não guardam idioma nenhum, e o painel não tinha por onde o contar. Fica na conversa e
 * não na mensagem porque é a conversa que tem uma língua; trocar a meio é raro e o valor
 * mais recente é o que interessa.
 */
export async function setConversationLang(conversationId: string, lang: string): Promise<void> {
  const _id = toObjectId(conversationId);
  if (!_id) return;
  const db = await getDb();
  await db.collection("chatbot_conversations").updateOne({ _id }, { $set: { lang } });
}
