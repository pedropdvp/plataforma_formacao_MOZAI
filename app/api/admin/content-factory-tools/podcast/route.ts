import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { openai } from "@ai-sdk/openai";
import { generateText, generateSpeech } from "ai";
import { put } from "@vercel/blob";
import { debitCredits } from "@/lib/ai-credits";
import { saveContentFactoryAsset } from "@/lib/content-factory-tools";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST — Gera um Podcast REAL: primeiro escreve um guião narrado a partir do conteúdo
// fornecido, depois sintetiza ÁUDIO REAL (OpenAI TTS) a partir desse guião, e guarda o
// ficheiro .mp3 real no Vercel Blob. Nunca finge geração de áudio.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });

    const { sourceText, title } = await req.json();
    if (!sourceText?.trim()) return NextResponse.json({ error: "Cole o conteúdo para gerar o podcast." }, { status: 400 });

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const newBalance = await debitCredits(tenantId, userId, 3); // guião + síntese de voz = mais caro
    if (newBalance === null) return NextResponse.json({ error: "Saldo de Créditos IA insuficiente (podcast custa 3 Créditos IA)." }, { status: 402 });

    const { text: script } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: `Escreve um guião de podcast curto (1-2 minutos falados, ~200-300 palavras), tom conversacional, narrado por UM apresentador, a explicar este conteúdo de forma envolvente.\n\nCONTEÚDO:\n${sourceText}`,
    });

    const speechResult = await generateSpeech({
      model: openai.speech("tts-1"),
      text: script,
      voice: "alloy",
    });

    const fileName = `podcasts/${tenantId}/${Date.now()}.mp3`;
    const blob = await put(fileName, Buffer.from(speechResult.audio.uint8Array), {
      access: "public",
      contentType: speechResult.audio.mediaType || "audio/mpeg",
    });

    const assetId = await saveContentFactoryAsset({
      tenantId,
      userId,
      type: "podcast",
      title: title || "Podcast gerado",
      content: { script, audioUrl: blob.url },
    });

    return NextResponse.json({ success: true, assetId, script, audioUrl: blob.url });
  } catch (error: any) {
    console.error("Erro ao gerar podcast:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
