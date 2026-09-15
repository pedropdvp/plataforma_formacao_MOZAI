import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { MUX_SIGNATURE_TOLERANCE_SECONDS, verifyMuxSignature } from "@/lib/mux-webhook";

const SECRET = "segredo-de-teste";
const NOW = 1_800_000_000;
const BODY = JSON.stringify({ type: "video.asset.ready", data: { upload_id: "u1" } });

function sign(body: string, secret: string, timestamp: number): string {
  const hmac = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${hmac}`;
}

describe("verifyMuxSignature", () => {
  it("aceita uma assinatura válida e recente", () => {
    assert.ok(verifyMuxSignature({ rawBody: BODY, signatureHeader: sign(BODY, SECRET, NOW), secret: SECRET, nowSeconds: NOW }));
  });

  it("recusa tudo quando o segredo não está configurado", () => {
    assert.ok(!verifyMuxSignature({ rawBody: BODY, signatureHeader: sign(BODY, SECRET, NOW), secret: undefined, nowSeconds: NOW }));
    assert.ok(!verifyMuxSignature({ rawBody: BODY, signatureHeader: sign(BODY, "", NOW), secret: "", nowSeconds: NOW }));
  });

  it("recusa um segredo errado ou um corpo alterado", () => {
    assert.ok(!verifyMuxSignature({ rawBody: BODY, signatureHeader: sign(BODY, "outro", NOW), secret: SECRET, nowSeconds: NOW }));
    assert.ok(!verifyMuxSignature({ rawBody: `${BODY} `, signatureHeader: sign(BODY, SECRET, NOW), secret: SECRET, nowSeconds: NOW }));
  });

  it("recusa uma notificação antiga, para não poder ser reenviada", () => {
    const old = NOW - MUX_SIGNATURE_TOLERANCE_SECONDS - 1;
    assert.ok(!verifyMuxSignature({ rawBody: BODY, signatureHeader: sign(BODY, SECRET, old), secret: SECRET, nowSeconds: NOW }));
  });

  it("recusa cabeçalhos ausentes ou mal formados", () => {
    for (const header of [null, "", "abc", "t=,v1=", `v1=${"a".repeat(64)}`, `t=${NOW}`, `t=abc,v1=${"a".repeat(64)}`]) {
      assert.ok(!verifyMuxSignature({ rawBody: BODY, signatureHeader: header, secret: SECRET, nowSeconds: NOW }), String(header));
    }
  });
});
