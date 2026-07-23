import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";

/**
 * Verifica a assinatura do webhook do Mux (header `mux-signature`), se o segredo
 * estiver configurado. Sem MUX_WEBHOOK_SECRET, o pedido é aceite sem verificação
 * (tal como o resto da integração Mux existente antes desta funcionalidade) — para
 * produção recomenda-se configurar o segredo em "Mux Dashboard → Webhooks".
 */
function isValidSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k, v];
    })
  );
  const timestamp = parts["t"];
  const expectedSig = parts["v1"];
  if (!timestamp || !expectedSig) return false;

  const payload = `${timestamp}.${rawBody}`;
  const computed = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(expectedSig));
  } catch {
    return false;
  }
}

// POST — Recebe eventos do Mux (video.asset.ready / video.asset.errored) e atualiza media_library.
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const secret = process.env.MUX_WEBHOOK_SECRET;

    if (secret) {
      const sigHeader = req.headers.get("mux-signature");
      if (!isValidSignature(rawBody, sigHeader, secret)) {
        return NextResponse.json({ error: "Assinatura do webhook inválida." }, { status: 401 });
      }
    }

    const event = JSON.parse(rawBody);
    const db = await getDb();

    if (event.type === "video.asset.ready") {
      const asset = event.data;
      const playbackId: string | undefined = asset.playback_ids?.[0]?.id;
      const uploadId: string | undefined = asset.upload_id;

      if (uploadId && playbackId) {
        await db.collection("media_library").updateOne(
          { muxUploadId: uploadId },
          { $set: { muxPlaybackId: playbackId, muxAssetId: asset.id, status: "ready", readyAt: new Date() } }
        );
      }
    } else if (event.type === "video.asset.errored") {
      const asset = event.data;
      const uploadId: string | undefined = asset.upload_id;
      if (uploadId) {
        await db.collection("media_library").updateOne(
          { muxUploadId: uploadId },
          { $set: { status: "error", erroredAt: new Date() } }
        );
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Erro ao processar webhook do Mux:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
