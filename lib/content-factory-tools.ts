import { getDb } from "@/lib/mongodb";

/** Grava um asset gerado pela Content Factory, sempre como "pending_review" — nunca publicado
 * automaticamente (ver item 23: revisão humana obrigatória antes de publicar). */
export async function saveContentFactoryAsset(params: {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  content: unknown;
}) {
  const db = await getDb();
  const result = await db.collection("content_factory_assets").insertOne({
    tenant_id: params.tenantId,
    createdBy: params.userId,
    type: params.type,
    title: params.title,
    content: params.content,
    status: "pending_review",
    createdAt: new Date(),
  });
  return result.insertedId.toString();
}
