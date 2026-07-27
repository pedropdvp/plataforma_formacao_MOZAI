import { getDb } from "@/lib/mongodb";

/**
 * Estado do PDF de conhecimento do ChatBot por tenant — um ficheiro por tenant, guardado
 * numa coleção própria (metadados) enquanto os chunks/embeddings vivem em `uploaded_chunks`
 * (a mesma coleção RAG usada pela Fábrica de Cursos), sob um `briefingId` reservado e nunca
 * colidente com briefings reais (que usam UUIDs).
 */

export function getChatbotBriefingId(tenantId: string): string {
  return `chatbot__${tenantId}`;
}

export interface ChatbotDocumentStatus {
  tenantId: string;
  configured: boolean;
  fileName: string | null;
  sizeBytes: number | null;
  chunksCount: number | null;
  uploadedAt: Date | null;
}

export async function getChatbotDocumentStatus(tenantId: string): Promise<ChatbotDocumentStatus> {
  const db = await getDb();
  const doc = await db.collection("chatbot_documents").findOne({ _id: tenantId as any });
  if (!doc) {
    return { tenantId, configured: false, fileName: null, sizeBytes: null, chunksCount: null, uploadedAt: null };
  }
  return {
    tenantId,
    configured: true,
    fileName: doc.fileName,
    sizeBytes: doc.sizeBytes,
    chunksCount: doc.chunksCount,
    uploadedAt: doc.uploadedAt,
  };
}

export async function setChatbotDocument(
  tenantId: string,
  data: { fileName: string; sizeBytes: number; chunksCount: number; uploadedBy: string }
): Promise<void> {
  const db = await getDb();
  await db.collection("chatbot_documents").updateOne(
    { _id: tenantId as any },
    {
      $set: {
        _id: tenantId,
        tenant_id: tenantId,
        fileName: data.fileName,
        sizeBytes: data.sizeBytes,
        chunksCount: data.chunksCount,
        uploadedBy: data.uploadedBy,
        uploadedAt: new Date(),
      },
    },
    { upsert: true }
  );
}

/** Remove o documento e todos os chunks RAG associados a este tenant (substituição ou remoção). */
export async function clearChatbotDocument(tenantId: string): Promise<void> {
  const db = await getDb();
  await db.collection("uploaded_chunks").deleteMany({ briefingId: getChatbotBriefingId(tenantId) });
  await db.collection("chatbot_documents").deleteOne({ _id: tenantId as any });
}
