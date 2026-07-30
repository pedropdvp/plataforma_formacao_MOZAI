import { NextRequest } from "next/server";
import { getDb } from "./mongodb";
import { hashApiKey } from "./developer-keys";

/**
 * Autentica um pedido externo (API pública para developers) através do cabeçalho
 * "Authorization: Bearer mozai_...". Devolve o utilizador e tenant dono da chave, ou null
 * se a chave for inválida/revogada — nunca aceita pedidos sem uma chave válida e ativa.
 */
export async function authenticateApiKey(req: NextRequest): Promise<{ userId: string; tenantId: string; keyId: string } | null> {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(mozai_[a-f0-9]+)$/i);
  if (!match) return null;

  const plaintext = match[1];
  const keyHash = hashApiKey(plaintext);

  const db = await getDb();
  const key = await db.collection("developer_api_keys").findOne({ keyHash, revoked: { $ne: true } });
  if (!key) return null;

  await db.collection("developer_api_keys").updateOne({ _id: key._id }, { $set: { lastUsedAt: new Date() } });

  return { userId: key.userId, tenantId: key.tenant_id, keyId: key._id.toString() };
}
