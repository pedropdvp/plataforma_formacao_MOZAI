import { getDb } from "@/lib/mongodb";
import { decryptSecret } from "@/lib/crypto";

export async function getAwsCredentials(tenantId: string, userId: string) {
  const db = await getDb();
  const record = await db.collection("user_integrations").findOne({ tenant_id: tenantId, userId, provider: "aws" });
  if (!record) return null;

  return {
    accessKeyId: decryptSecret(record.accessKeyIdEncrypted),
    secretAccessKey: decryptSecret(record.secretAccessKeyEncrypted),
    region: record.region || "us-east-1",
  };
}
