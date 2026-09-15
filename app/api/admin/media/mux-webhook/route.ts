import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyMuxSignature } from "@/lib/mux-webhook";

export const runtime = "nodejs";

// POST — Recebe eventos do Mux (video.asset.ready / video.asset.errored) e atualiza media_library.
// A autenticação é a assinatura do Mux, não a sessão do Clerk (ver lib/mux-webhook.ts).
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const secret = process.env.MUX_WEBHOOK_SECRET;

    if (!secret) {
      console.error("Webhook do Mux recusado: MUX_WEBHOOK_SECRET não está configurada.");
      return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 });
    }

    if (!verifyMuxSignature({ rawBody, signatureHeader: req.headers.get("mux-signature"), secret })) {
      return NextResponse.json({ error: "Assinatura do webhook inválida." }, { status: 401 });
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
