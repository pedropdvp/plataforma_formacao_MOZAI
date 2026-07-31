import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { debitCredits } from "@/lib/ai-credits";
import { saveContentFactoryAsset } from "@/lib/content-factory-tools";

export const maxDuration = 30;

const flashcardsSchema = z.object({
  flashcards: z.array(z.object({ front: z.string(), back: z.string() })).min(6).max(20),
});

// POST — Gera pares REAIS de pergunta/resposta (flashcards) para memorização espaçada, a
// partir do conteúdo fornecido.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });

    const { sourceText, title } = await req.json();
    if (!sourceText?.trim()) return NextResponse.json({ error: "Cole o conteúdo para gerar os flashcards." }, { status: 400 });

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const newBalance = await debitCredits(tenantId, userId, 1);
    if (newBalance === null) return NextResponse.json({ error: "Saldo de Créditos IA insuficiente." }, { status: 402 });

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: flashcardsSchema,
      prompt: `Cria 10-15 flashcards (frente = pergunta/termo curto, verso = resposta/definição curta) a partir deste conteúdo, focados nos conceitos mais importantes para memorizar.\n\nCONTEÚDO:\n${sourceText}`,
    });

    const assetId = await saveContentFactoryAsset({ tenantId, userId, type: "flashcards", title: title || "Flashcards gerados", content: object.flashcards });

    return NextResponse.json({ success: true, assetId, flashcards: object.flashcards });
  } catch (error: any) {
    console.error("Erro ao gerar flashcards:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
