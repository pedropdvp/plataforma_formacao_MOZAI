import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { debitCredits } from "@/lib/ai-credits";
import { saveContentFactoryAsset } from "@/lib/content-factory-tools";

export const maxDuration = 30;

const briefSchema = z.object({
  title: z.string(),
  objective: z.string(),
  deliverables: z.array(z.string()).min(2).max(6),
  rubric: z.array(z.object({ criterion: z.string(), weightPct: z.number() })).min(2),
  estimatedHours: z.number(),
});

// POST — Gera um briefing de projeto prático REAL (objetivo, entregáveis, rubrica de
// avaliação com pesos) a partir do conteúdo da lição — pronto a usar em "Avaliação de
// Projetos" (já real na plataforma), após revisão humana.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });

    const { sourceText, title } = await req.json();
    if (!sourceText?.trim()) return NextResponse.json({ error: "Cole o conteúdo da lição/curso para gerar o projeto." }, { status: 400 });

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const newBalance = await debitCredits(tenantId, userId, 1);
    if (newBalance === null) return NextResponse.json({ error: "Saldo de Créditos IA insuficiente." }, { status: 402 });

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: briefSchema,
      prompt: `Cria um briefing de projeto prático de avaliação, com objetivo, entregáveis concretos, rubrica de avaliação (critérios com peso percentual que some 100) e horas estimadas, com base neste conteúdo de curso.\n\nCONTEÚDO:\n${sourceText}`,
    });

    const assetId = await saveContentFactoryAsset({ tenantId, userId, type: "project", title: title || object.title, content: object });

    return NextResponse.json({ success: true, assetId, project: object });
  } catch (error: any) {
    console.error("Erro ao gerar projeto:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
