import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

/**
 * Múltiplas conversas nomeadas por (tenant, utilizador) — cada utilizador pode ter várias
 * conversas em curso com o ChatBot (tal como o histórico de um assistente normal), pode
 * criar uma nova a qualquer momento, renomear, marcar como favorita e apagar.
 */

const MAX_HISTORY_MESSAGES = 12;
const TITLE_MAX_LEN = 60;

export interface ChatbotMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  tokens?: number;
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
