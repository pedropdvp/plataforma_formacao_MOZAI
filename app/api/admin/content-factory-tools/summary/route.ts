import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { debitCredits } from "@/lib/ai-credits";
import { saveContentFactoryAsset } from "@/lib/content-factory-tools";

export const maxDuration = 30;

// POST — Gera um resumo REAL, fundamentado exclusivamente no texto fornecido (nunca
// acrescenta factos que não estejam na fonte).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });

    const { sourceText, title } = await req.json();
    if (!sourceText?.trim()) return NextResponse.json({ error: "Cole o conteúdo a resumir." }, { status: 400 });

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const newBalance = await debitCredits(tenantId, userId, 1);
    if (newBalance === null) return NextResponse.json({ error: "Saldo de Créditos IA insuficiente." }, { status: 402 });

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: `Resume o seguinte conteúdo em 150-250 palavras, com os pontos-chave em bullets no final. Usa EXCLUSIVAMENTE informação presente no texto — nunca acrescentes factos externos.\n\nCONTEÚDO:\n${sourceText}`,
    });

    const assetId = await saveContentFactoryAsset({ tenantId, userId, type: "summary", title: title || "Resumo gerado", content: text });

    return NextResponse.json({ success: true, assetId, summary: text });
  } catch (error: any) {
    console.error("Erro ao gerar resumo:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
