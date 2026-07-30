import { findOneTenantScoped, getDb } from "@/lib/mongodb";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/crypto";

/** Guarda o webhook do Discord do tenant, encriptado (mesma cifra das chaves de API). */
export async function setTenantDiscordWebhook(tenantId: string, webhookUrl: string): Promise<void> {
  const encrypted = encryptSecret(webhookUrl);
  const db = await getDb();
  await db.collection("tenant_settings").updateOne(
    { tenant_id: tenantId },
    { $set: { tenant_id: tenantId, discordWebhookEncrypted: encrypted, discordWebhookUpdatedAt: new Date() } },
    { upsert: true }
  );
}

export async function removeTenantDiscordWebhook(tenantId: string): Promise<void> {
  const db = await getDb();
  await db.collection("tenant_settings").updateOne(
    { tenant_id: tenantId },
    { $unset: { discordWebhookEncrypted: "", discordWebhookUpdatedAt: "" } }
  );
}

export interface DiscordStatus {
  configured: boolean;
  maskedUrl: string | null;
}

export async function getTenantDiscordStatus(tenantId: string): Promise<DiscordStatus> {
  const settings = await findOneTenantScoped("tenant_settings", tenantId);
  const encrypted = settings?.discordWebhookEncrypted;
  if (!encrypted) return { configured: false, maskedUrl: null };
  try {
    return { configured: true, maskedUrl: maskSecret(decryptSecret(encrypted)) };
  } catch {
    return { configured: false, maskedUrl: null };
  }
}

/**
 * Envia uma mensagem REAL para o canal do Discord ligado a este tenant (via Discord Webhook —
 * https://discord.com/developers/docs/resources/webhook), usando o formato de "embed" nativo
 * do Discord. Nunca lança exceção para o chamador: uma falha aqui não pode impedir a ação
 * principal (criar um post, etc.) — só regista um aviso.
 */
export async function sendDiscordNotification(
  tenantId: string,
  title: string,
  description: string,
  url?: string
): Promise<{ sent: boolean; error?: string }> {
  try {
    const settings = await findOneTenantScoped("tenant_settings", tenantId);
    const encrypted = settings?.discordWebhookEncrypted;
    if (!encrypted) return { sent: false, error: "not_configured" };

    const webhookUrl = decryptSecret(encrypted);
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title,
            description,
            url,
            color: 0x6366f1,
            footer: { text: "MOZAI Community" },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { sent: false, error: `Discord devolveu HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (err: any) {
    console.warn("Erro ao enviar notificação para o Discord:", err);
    return { sent: false, error: err.message };
  }
}
