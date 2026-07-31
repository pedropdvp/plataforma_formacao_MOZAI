import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { openai } from "@ai-sdk/openai";
import { transcribe } from "ai";
import { put } from "@vercel/blob";
import { debitCredits } from "@/lib/ai-credits";
import { saveContentFactoryAsset } from "@/lib/content-factory-tools";
import { buildSrtFromSegments } from "@/lib/srt";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST — Transcrição REAL (OpenAI Whisper) de um ficheiro de áudio/vídeo já carregado (via
// audio-upload-token). Devolve o texto completo e os segmentos com timestamps reais, e já
// gera o ficheiro de Legendas (.srt) a partir desses MESMOS timestamps reais — nunca
// timestamps aproximados/inventados.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });

    const { audioUrl, title } = await req.json();
    if (!audioUrl?.trim()) return NextResponse.json({ error: "Carregue um ficheiro de áudio/vídeo primeiro." }, { status: 400 });

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const newBalance = await debitCredits(tenantId, userId, 2);
    if (newBalance === null) return NextResponse.json({ error: "Saldo de Créditos IA insuficiente (transcrição custa 2 Créditos IA)." }, { status: 402 });

    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) return NextResponse.json({ error: "Não foi possível descarregar o ficheiro de áudio." }, { status: 502 });
    const audioBuffer = new Uint8Array(await audioRes.arrayBuffer());

    const result = await transcribe({ model: openai.transcription("whisper-1"), audio: audioBuffer });

    const srt = buildSrtFromSegments(result.segments as any);
    const srtBlob = await put(`subtitles/${tenantId}/${Date.now()}.srt`, srt, { access: "public", contentType: "text/srt" });

    const assetId = await saveContentFactoryAsset({
      tenantId,
      userId,
      type: "transcription",
      title: title || "Transcrição gerada",
      content: { text: result.text, segments: result.segments, srtUrl: srtBlob.url },
    });

    return NextResponse.json({ success: true, assetId, text: result.text, segments: result.segments, srtUrl: srtBlob.url });
  } catch (error: any) {
    console.error("Erro ao transcrever áudio:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
