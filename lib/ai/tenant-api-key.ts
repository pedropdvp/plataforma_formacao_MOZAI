import { findOneTenantScoped, getDb } from "@/lib/mongodb";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/crypto";

/**
 * Resolve qual chave da OpenAI usar para gerar cursos deste tenant:
 * - "root" (plataforma/Admin): chave configurada em tenant_settings, com fallback para a
 *   variável de ambiente OPENAI_API_KEY (a mesma que já funcionava antes desta funcionalidade).
 * - qualquer outra empresa: só a chave configurada pelo próprio Gestor de Empresa em
 *   tenant_settings — SEM fallback para a chave da plataforma, para garantir que o custo de
 *   geração de cursos de uma empresa é sempre da própria empresa, nunca da MOZAI.
 * Devolve null quando não há chave disponível (o chamador deve bloquear a geração nesse caso).
 */
export async function resolveOpenAIKeyForTenant(tenantId: string): Promise<string | null> {
  const settings = await findOneTenantScoped("tenant_settings", tenantId);
  const encrypted = settings?.openaiApiKeyEncrypted;
  if (encrypted) {
    try {
      return decryptSecret(encrypted);
    } catch (err) {
      console.error(`Falha ao decifrar a chave OpenAI do tenant ${tenantId}:`, err);
    }
  }
  if (tenantId === "root" && process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }
  return null;
}

export interface TenantApiKeyStatus {
  tenantId: string;
  configured: boolean;
  maskedKey: string | null;
  updatedAt: Date | null;
}

/** Estado (sem nunca expor o valor completo) da chave configurada por um tenant. */
export async function getTenantApiKeyStatus(tenantId: string): Promise<TenantApiKeyStatus> {
  const settings = await findOneTenantScoped("tenant_settings", tenantId);
  const encrypted = settings?.openaiApiKeyEncrypted;
  if (!encrypted) {
    // "root" mostra a chave da plataforma (env var) como configurada, já que é ela que é
    // realmente usada — não faz sentido dizer "não configurada" quando já está a funcionar.
    if (tenantId === "root" && process.env.OPENAI_API_KEY) {
      return {
        tenantId,
        configured: true,
        maskedKey: maskSecret(process.env.OPENAI_API_KEY),
        updatedAt: null,
      };
    }
    return { tenantId, configured: false, maskedKey: null, updatedAt: null };
  }
  try {
    const plain = decryptSecret(encrypted);
    return {
      tenantId,
      configured: true,
      maskedKey: maskSecret(plain),
      updatedAt: settings?.openaiApiKeyUpdatedAt || null,
    };
  } catch {
    return { tenantId, configured: false, maskedKey: null, updatedAt: null };
  }
}

export async function setTenantApiKey(tenantId: string, apiKey: string): Promise<void> {
  const encrypted = encryptSecret(apiKey);
  const db = await getDb();
  // upsert: uma empresa pode ainda não ter nenhum documento em tenant_settings
  // (ex: nunca configurou branding) — tem de ser criado na primeira vez que define a chave.
  await db.collection("tenant_settings").updateOne(
    { tenant_id: tenantId },
    { $set: { tenant_id: tenantId, openaiApiKeyEncrypted: encrypted, openaiApiKeyUpdatedAt: new Date() } },
    { upsert: true }
  );
}

export async function removeTenantApiKey(tenantId: string): Promise<void> {
  const db = await getDb();
  await db.collection("tenant_settings").updateOne(
    { tenant_id: tenantId },
    { $unset: { openaiApiKeyEncrypted: "", openaiApiKeyUpdatedAt: "" } }
  );
}
