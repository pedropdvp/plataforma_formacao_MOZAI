import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { debitCredits } from "@/lib/ai-credits";
import { logAuditEvent } from "@/lib/audit";

export const maxDuration = 30;

const reviewSchema = z.object({
  overallQuality: z.enum(["fraca", "razoável", "boa", "excelente"]).describe("Avaliação geral honesta da qualidade do código"),
  issues: z.array(
    z.object({
      severity: z.enum(["crítico", "aviso", "sugestão"]),
      description: z.string().describe("Descrição concreta e específica do problema encontrado NESTE código"),
    })
  ).describe("Problemas reais encontrados no código (bugs, más práticas, riscos) — lista vazia se não houver nenhum"),
  suggestions: z.array(z.string()).describe("Sugestões concretas de melhoria (nomes, estrutura, legibilidade, eficiência)"),
});

// POST — Revisão de código real feita por IA, tal como um "Code Review" de um par: recebe o
// código exato submetido pelo aluno e devolve uma análise fundamentada nesse código — nunca um
// parecer genérico. Debita 1 Crédito IA, como qualquer chamada ao motor de IA da plataforma.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { code, language } = await req.json();
    if (!code?.trim()) {
      return NextResponse.json({ error: "Não há código para rever." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const newBalance = await debitCredits(tenantId, userId, 1);
    if (newBalance === null) {
      return NextResponse.json(
        { error: "Saldo de Créditos IA insuficiente. Recarregue em Créditos IA para continuar." },
        { status: 402 }
      );
    }

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: reviewSchema,
      prompt: `Faz um code review honesto e específico ao seguinte código em ${language || "desconhecida"}.
Aponta apenas problemas reais que existam NESTE código concreto (nunca inventes problemas genéricos que não se apliquem).
Se o código estiver correto e bem escrito, di-lo claramente e devolve uma lista de "issues" vazia.

CÓDIGO:
\`\`\`${language || ""}
${code}
\`\`\``,
    });

    await logAuditEvent(userId, "CODING_LAB_AI_REVIEW", { tenantId, language, quality: object.overallQuality });

    return NextResponse.json({ success: true, review: object });
  } catch (error: any) {
    console.error("Erro na revisão de código (IA):", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
