import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { openai } from "@ai-sdk/openai";
import { generateText, generateImage } from "ai";
import { put } from "@vercel/blob";
import { debitCredits } from "@/lib/ai-credits";
import { saveContentFactoryAsset } from "@/lib/content-factory-tools";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST — Gera um infográfico REAL: primeiro sintetiza os pontos-chave do conteúdo num guião
// visual, depois gera uma imagem REAL (OpenAI Images) com esse guião como prompt, e guarda o
// ficheiro no Vercel Blob. Nunca finge uma imagem.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });

    const { sourceText, title } = await req.json();
    if (!sourceText?.trim()) return NextResponse.json({ error: "Cole o conteúdo para gerar o infográfico." }, { status: 400 });

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const newBalance = await debitCredits(tenantId, userId, 3); // síntese + imagem = mais caro
    if (newBalance === null) return NextResponse.json({ error: "Saldo de Créditos IA insuficiente (infográfico custa 3 Créditos IA)." }, { status: 402 });

    const { text: visualBrief } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: `Resume este conteúdo em 4-6 pontos-chave muito curtos, próprios para um infográfico visual (frases curtas, sem floreados). Devolve só a lista.\n\nCONTEÚDO:\n${sourceText}`,
    });

    const { image } = await generateImage({
      model: openai.image("dall-e-3"),
      prompt: `Infográfico educativo moderno e limpo, estilo flat design, com estes pontos-chave organizados visualmente: ${visualBrief}. Sem texto ilegível, cores contrastantes, fundo claro.`,
      size: "1024x1024",
    });

    const fileName = `infographics/${tenantId}/${Date.now()}.png`;
    const blob = await put(fileName, Buffer.from(image.uint8Array), { access: "public", contentType: image.mediaType || "image/png" });

    const assetId = await saveContentFactoryAsset({
      tenantId,
      userId,
      type: "infographic",
      title: title || "Infográfico gerado",
      content: { visualBrief, imageUrl: blob.url },
    });

    return NextResponse.json({ success: true, assetId, visualBrief, imageUrl: blob.url });
  } catch (error: any) {
    console.error("Erro ao gerar infográfico:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
