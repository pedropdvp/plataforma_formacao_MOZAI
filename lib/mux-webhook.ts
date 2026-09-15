import crypto from "node:crypto";

/**
 * Verificação da assinatura dos webhooks do Mux (cabeçalho `mux-signature: t=<unix>,v1=<hmac>`).
 *
 * Sem segredo configurado a verificação falha. Antes, a rota aceitava qualquer pedido quando
 * MUX_WEBHOOK_SECRET não estava definida, e qualquer pessoa podia marcar vídeos da biblioteca
 * como prontos ou com erro. Falhar fechado não parte nada: o estado dos uploads não depende do
 * webhook, porque o painel de media consulta o Mux diretamente (GET /api/admin/media/mux-upload).
 */

/** Tolerância recomendada pelo Mux: uma notificação capturada não pode ser reenviada mais tarde. */
export const MUX_SIGNATURE_TOLERANCE_SECONDS = 300;

export interface MuxSignatureInput {
  rawBody: string;
  signatureHeader: string | null;
  secret: string | undefined;
  nowSeconds?: number;
}

export function verifyMuxSignature({
  rawBody,
  signatureHeader,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
}: MuxSignatureInput): boolean {
  if (!secret || !signatureHeader) return false;

  const parts = new Map<string, string>();
  for (const part of signatureHeader.split(",")) {
    const separator = part.indexOf("=");
    if (separator > 0) parts.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }

  const timestamp = parts.get("t");
  const signature = parts.get("v1");
  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > MUX_SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = Buffer.from(crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex"));
  const received = Buffer.from(signature);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}
