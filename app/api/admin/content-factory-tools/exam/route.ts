import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { debitCredits } from "@/lib/ai-credits";
import { saveContentFactoryAsset } from "@/lib/content-factory-tools";

export const maxDuration = 30;

const examSchema = z.object({
  title: z.string(),
  timeLimitMinutes: z.number(),
  questions: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()).length(4),
      correctIndex: z.number().min(0).max(3),
      explanation: z.string(),
    })
  ).min(8).max(20),
});

// POST — Gera um EXAME formal REAL (mais extenso e rigoroso que um quiz de lição, com limite
// de tempo e explicação por pergunta) — distinto do Quiz já existente por curso.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });

    const { sourceText, title, questionCount } = await req.json();
    if (!sourceText?.trim()) return NextResponse.json({ error: "Cole o conteúdo do curso para gerar o exame." }, { status: 400 });

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const newBalance = await debitCredits(tenantId, userId, 2); // exame = mais perguntas, mais caro
    if (newBalance === null) return NextResponse.json({ error: "Saldo de Créditos IA insuficiente (exame custa 2 Créditos IA)." }, { status: 402 });

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: examSchema,
      prompt: `Cria um exame formal com ${Math.min(20, Math.max(8, questionCount || 12))} perguntas de escolha múltipla (4 opções cada, só 1 correta), cobrindo TODO o conteúdo abaixo com dificuldade progressiva, mais um limite de tempo razoável em minutos.\n\nCONTEÚDO:\n${sourceText}`,
    });

    const assetId = await saveContentFactoryAsset({ tenantId, userId, type: "exam", title: title || object.title, content: object });

    return NextResponse.json({ success: true, assetId, exam: object });
  } catch (error: any) {
    console.error("Erro ao gerar exame:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
