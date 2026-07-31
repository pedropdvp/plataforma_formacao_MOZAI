import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { debitCredits } from "@/lib/ai-credits";
import { saveContentFactoryAsset } from "@/lib/content-factory-tools";

export const maxDuration = 30;

const slidesSchema = z.object({
  slides: z.array(
    z.object({
      title: z.string(),
      bullets: z.array(z.string()).min(2).max(6),
      speakerNotes: z.string().describe("Notas para quem for apresentar este slide"),
    })
  ).min(4).max(12),
});

// POST — Gera um deck de slides REAL e estruturado (título + bullets + notas do orador por
// slide) a partir do conteúdo fornecido — nunca imagens fabricadas, apenas estrutura de texto
// diretamente renderizável.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });

    const { sourceText, title } = await req.json();
    if (!sourceText?.trim()) return NextResponse.json({ error: "Cole o conteúdo da lição para gerar os slides." }, { status: 400 });

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const newBalance = await debitCredits(tenantId, userId, 1);
    if (newBalance === null) return NextResponse.json({ error: "Saldo de Créditos IA insuficiente." }, { status: 402 });

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: slidesSchema,
      prompt: `Cria uma apresentação de slides (4 a 10 slides) a partir deste conteúdo de aula. Cada slide deve ter um título curto, 2-5 bullets concisos, e notas do orador.\n\nCONTEÚDO:\n${sourceText}`,
    });

    const assetId = await saveContentFactoryAsset({ tenantId, userId, type: "slides", title: title || "Slides gerados", content: object.slides });

    return NextResponse.json({ success: true, assetId, slides: object.slides });
  } catch (error: any) {
    console.error("Erro ao gerar slides:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
