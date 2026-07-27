import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

/**
 * Uma conversa contínua por (tenant, utilizador) — sem gestão de múltiplas conversas
 * nomeadas (âmbito propositadamente simples): cada utilizador tem sempre uma única
 * conversa em curso com o ChatBot, que persiste entre sessões/recarregamentos de página.
 */

const MAX_HISTORY_MESSAGES = 12;

export interface ChatbotMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

export async function getOrCreateConversation(tenantId: string, userId: string): Promise<string> {
  const db = await getDb();
  const col = db.collection("chatbot_conversations");
  const existing = await col.findOne({ tenantId, userId });
  if (existing) return existing._id.toString();

  const result = await col.insertOne({ tenantId, userId, createdAt: new Date(), updatedAt: new Date() });
  return result.insertedId.toString();
}

export async function getRecentMessages(conversationId: string): Promise<ChatbotMessage[]> {
  const db = await getDb();
  const rows = await db
    .collection("chatbot_messages")
    .find({ conversationId })
    .sort({ createdAt: -1 })
    .limit(MAX_HISTORY_MESSAGES)
    .toArray();
  return rows.reverse().map((r: any) => ({ role: r.role, content: r.content, createdAt: r.createdAt }));
}

export async function addMessage(conversationId: string, role: "user" | "assistant", content: string): Promise<void> {
  const db = await getDb();
  await db.collection("chatbot_messages").insertOne({ conversationId, role, content, createdAt: new Date() });
  await db.collection("chatbot_conversations").updateOne(
    { _id: new ObjectId(conversationId) },
    { $set: { updatedAt: new Date() } }
  );
}
