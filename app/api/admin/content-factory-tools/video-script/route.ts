import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { openai } from "@ai-sdk/openai";
import { generateObject, generateSpeech } from "ai";
import { z } from "zod";
import { put } from "@vercel/blob";
import { debitCredits } from "@/lib/ai-credits";
import { saveContentFactoryAsset } from "@/lib/content-factory-tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const scriptSchema = z.object({
  scenes: z.array(
    z.object({
      visualDescription: z.string().describe("O que deve aparecer no ecrã nesta cena (texto/imagem/diagrama)"),
      narration: z.string().describe("Texto exato a narrar nesta cena"),
    })
  ).min(3).max(8),
});

/**
 * Gerador de "kit de produção de vídeo": roteiro real por cenas + narração ÁUDIO REAL (TTS)
 * para cada cena. Melhoria honesta face ao estado anterior (que só associava um vídeo do
 * YouTube já existente): agora produz conteúdo original real e pronto a montar.
 *
 * Decisão de âmbito deliberada: NÃO renderiza um ficheiro .mp4 final — isso exigiria um
 * pipeline de codificação de vídeo (ffmpeg) a correr em funções serverless, com risco sério
 * de exceder limites de tempo/memória/tamanho do Vercel de forma imprevisível. Em vez de
 * fingir essa capacidade, entrega os blocos reais (roteiro + narração gravada) que qualquer
 * pessoa pode montar num editor de vídeo em minutos.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });

    const { sourceText, title } = await req.json();
    if (!sourceText?.trim()) return NextResponse.json({ error: "Cole o conteúdo para gerar o roteiro de vídeo." }, { status: 400 });

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const newBalance = await debitCredits(tenantId, userId, 3);
    if (newBalance === null) return NextResponse.json({ error: "Saldo de Créditos IA insuficiente (roteiro de vídeo custa 3 Créditos IA)." }, { status: 402 });

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: scriptSchema,
      prompt: `Cria um roteiro de vídeo educativo (4-6 cenas) a partir deste conteúdo: para cada cena, descreve o que aparece no ecrã e escreve o texto exato a narrar.\n\nCONTEÚDO:\n${sourceText}`,
    });

    const scenesWithAudio = [];
    for (const scene of object.scenes) {
      const speechResult = await generateSpeech({ model: openai.speech("tts-1"), text: scene.narration, voice: "alloy" });
      const blob = await put(`videos/${tenantId}/${Date.now()}-${scenesWithAudio.length}.mp3`, Buffer.from(speechResult.audio.uint8Array), {
        access: "public",
        contentType: speechResult.audio.mediaType || "audio/mpeg",
      });
      scenesWithAudio.push({ visualDescription: scene.visualDescription, narration: scene.narration, audioUrl: blob.url });
    }

    const assetId = await saveContentFactoryAsset({ tenantId, userId, type: "video-script", title: title || "Roteiro de vídeo gerado", content: scenesWithAudio });

    return NextResponse.json({ success: true, assetId, scenes: scenesWithAudio });
  } catch (error: any) {
    console.error("Erro ao gerar roteiro de vídeo:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
