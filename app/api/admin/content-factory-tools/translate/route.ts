import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { debitCredits } from "@/lib/ai-credits";
import { saveContentFactoryAsset } from "@/lib/content-factory-tools";

export const maxDuration = 30;

// POST — Tradução REAL do conteúdo fornecido para o idioma pedido, preservando formatação
// (Markdown, listas) e terminologia técnica.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });

    const { sourceText, targetLanguage, title } = await req.json();
    if (!sourceText?.trim() || !targetLanguage?.trim()) {
      return NextResponse.json({ error: "Indique o conteúdo e o idioma de destino." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const newBalance = await debitCredits(tenantId, userId, 1);
    if (newBalance === null) return NextResponse.json({ error: "Saldo de Créditos IA insuficiente." }, { status: 402 });

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: `Traduz o seguinte conteúdo para ${targetLanguage}. Preserva a formatação Markdown/listas e a terminologia técnica correta (não traduzas literalmente termos técnicos com tradução consagrada diferente). Devolve só a tradução.\n\nCONTEÚDO:\n${sourceText}`,
    });

    const assetId = await saveContentFactoryAsset({ tenantId, userId, type: "translation", title: title || `Tradução (${targetLanguage})`, content: text });

    return NextResponse.json({ success: true, assetId, translation: text });
  } catch (error: any) {
    console.error("Erro ao traduzir:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
