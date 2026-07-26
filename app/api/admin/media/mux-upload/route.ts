import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 30;

const MUX_API_BASE = "https://api.mux.com";

function muxAuthHeader() {
  const id = process.env.MUX_TOKEN_ID;
  const secret = process.env.MUX_TOKEN_SECRET;
  if (!id || !secret) {
    throw new Error("Mux não está configurado (MUX_TOKEN_ID/MUX_TOKEN_SECRET em falta).");
  }
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

/**
 * POST — Pede ao Mux um URL de upload direto (browser → Mux), evitando os limites
 * de tamanho/tempo das funções serverless da Vercel. Aceita nativamente MP4/MOV com
 * H.264 ou H.265/HEVC, ProRes 422 HQ/4444 e a generalidade dos ficheiros MXF de
 * produção profissional — o Mux transcodifica automaticamente para streaming adaptativo.
 * O item fica registado em `media_library` com status "processing"; o webhook
 * mux-webhook atualiza para "ready" quando o Mux terminar o processamento.
 *
 * Se o corpo incluir `id`, substitui o vídeo desse item existente em vez de criar um novo
 * (mesmo _id — os blocos de lição que já o referenciam pelo muxPlaybackId acabam por
 * mostrar o novo vídeo assim que o processamento terminar). O asset antigo no Mux é
 * apagado (melhor esforço, não bloqueia a substituição se falhar).
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    const allowedRoles = ["ADMIN", "GESTOR_EMPRESA", "GESTOR_ACADEMICO", "SUPORTE"];
    if (!allowedRoles.includes(activeRole || "")) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const body = await req.json().catch(() => ({}));
    const filename = body?.filename || "video";
    const replaceId: string | undefined = body?.id;

    const db = await getDb();
    let existing: any = null;
    if (replaceId) {
      existing = await db.collection("media_library").findOne({ _id: new ObjectId(replaceId), tenantId });
      if (!existing) {
        return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
      }
      if (existing.type !== "video") {
        return NextResponse.json({ error: "Este item não é um vídeo — não pode ser substituído por este endpoint." }, { status: 400 });
      }
      if (existing.muxAssetId) {
        try {
          await fetch(`${MUX_API_BASE}/video/v1/assets/${existing.muxAssetId}`, {
            method: "DELETE",
            headers: { Authorization: muxAuthHeader() },
          });
        } catch (err) {
          console.warn("Falha ao apagar o asset antigo no Mux ao substituir vídeo (a continuar):", err);
        }
      }
    }

    const muxRes = await fetch(`${MUX_API_BASE}/video/v1/uploads`, {
      method: "POST",
      headers: {
        Authorization: muxAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cors_origin: "*",
        new_asset_settings: {
          playback_policy: ["public"],
          // Metadados devolvidos no webhook, para ligarmos o asset final ao item da media_library
          passthrough: JSON.stringify({ tenantId, userId }),
        },
      }),
    });

    if (!muxRes.ok) {
      const errText = await muxRes.text();
      throw new Error(`Mux recusou o pedido de upload: ${muxRes.status} ${errText}`);
    }

    const muxData = await muxRes.json();
    const uploadId: string = muxData.data.id;
    const uploadUrl: string = muxData.data.url;

    if (existing) {
      const update = {
        muxUploadId: uploadId,
        muxPlaybackId: null as string | null,
        filename,
        status: "processing" as const,
        updatedAt: new Date(),
      };
      await db.collection("media_library").updateOne({ _id: existing._id }, { $set: update });

      await logAuditEvent(userId, "MEDIA_LIBRARY_VIDEO_REPLACED", { id: replaceId, filename, tenantId, uploadId });

      return NextResponse.json({
        success: true,
        uploadUrl,
        item: { ...existing, ...update },
      });
    }

    const doc = {
      tenantId,
      type: "video" as const,
      provider: "mux" as const,
      muxUploadId: uploadId,
      muxPlaybackId: null as string | null,
      filename,
      status: "processing" as const,
      createdAt: new Date(),
      createdBy: userId,
    };
    const result = await db.collection("media_library").insertOne(doc);

    await logAuditEvent(userId, "MEDIA_LIBRARY_VIDEO_UPLOAD_STARTED", { filename, tenantId, uploadId });

    return NextResponse.json({
      success: true,
      uploadUrl,
      item: { ...doc, _id: result.insertedId },
    });
  } catch (error: any) {
    console.error("Erro ao iniciar upload de vídeo no Mux:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET ?uploadId=... — Consulta diretamente o estado do upload no Mux e sincroniza
 * `media_library`. Serve de rede de segurança quando o webhook não consegue alcançar
 * o ambiente (ex.: localhost em desenvolvimento, onde o Mux não tem acesso à máquina).
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const uploadId = searchParams.get("uploadId");
    if (!uploadId) {
      return NextResponse.json({ error: "Parâmetro uploadId é obrigatório." }, { status: 400 });
    }

    const muxRes = await fetch(`${MUX_API_BASE}/video/v1/uploads/${uploadId}`, {
      headers: { Authorization: muxAuthHeader() },
    });
    if (!muxRes.ok) {
      throw new Error(`Mux devolveu ${muxRes.status} ao consultar o upload.`);
    }
    const muxData = await muxRes.json();
    const assetId: string | undefined = muxData.data.asset_id;
    const uploadStatus: string = muxData.data.status; // waiting | asset_created | errored | cancelled | timed_out

    const db = await getDb();

    if (uploadStatus === "asset_created" && assetId) {
      const assetRes = await fetch(`${MUX_API_BASE}/video/v1/assets/${assetId}`, {
        headers: { Authorization: muxAuthHeader() },
      });
      if (assetRes.ok) {
        const assetData = await assetRes.json();
        const asset = assetData.data;
        const playbackId: string | undefined = asset.playback_ids?.[0]?.id;
        if (asset.status === "ready" && playbackId) {
          await db.collection("media_library").updateOne(
            { muxUploadId: uploadId },
            { $set: { muxPlaybackId: playbackId, muxAssetId: asset.id, status: "ready", readyAt: new Date() } }
          );
          return NextResponse.json({ success: true, status: "ready", muxPlaybackId: playbackId });
        }
        if (asset.status === "errored") {
          await db.collection("media_library").updateOne(
            { muxUploadId: uploadId },
            { $set: { status: "error", erroredAt: new Date() } }
          );
          return NextResponse.json({ success: true, status: "error" });
        }
      }
    } else if (uploadStatus === "errored" || uploadStatus === "cancelled" || uploadStatus === "timed_out") {
      await db.collection("media_library").updateOne(
        { muxUploadId: uploadId },
        { $set: { status: "error", erroredAt: new Date() } }
      );
      return NextResponse.json({ success: true, status: "error" });
    }

    return NextResponse.json({ success: true, status: "processing" });
  } catch (error: any) {
    console.error("Erro ao consultar estado do upload Mux:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
