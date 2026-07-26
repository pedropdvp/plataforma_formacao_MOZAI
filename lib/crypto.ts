import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Encriptação simétrica (AES-256-GCM) para segredos guardados na base de dados — hoje só
 * as chaves de API da OpenAI configuradas por empresa (tenant_settings.openaiApiKeyEncrypted).
 * A chave vem de SECRETS_ENCRYPTION_KEY (64 caracteres hex = 32 bytes), nunca da base de dados.
 */

function getKey(): Buffer {
  const hex = process.env.SECRETS_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("SECRETS_ENCRYPTION_KEY em falta ou inválida (esperado: 64 caracteres hex / 32 bytes).");
  }
  return Buffer.from(hex, "hex");
}

/** Devolve "iv:tag:ciphertext" em hex, tudo o que é preciso para decifrar depois. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12); // GCM: 12 bytes é o recomendado
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("Formato de segredo encriptado inválido.");
  }
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}

/** Máscara segura para exibição: "sk-...ab12" — nunca expõe o valor completo. */
export function maskSecret(plaintext: string): string {
  if (plaintext.length <= 8) return "••••";
  return `${plaintext.slice(0, 3)}...${plaintext.slice(-4)}`;
}
