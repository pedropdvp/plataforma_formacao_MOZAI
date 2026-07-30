import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { scanCodeForVulnerabilities } from "@/lib/cyber-lab/scanner";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { debitCredits } from "@/lib/ai-credits";
import { logAuditEvent } from "@/lib/audit";

export const maxDuration = 30;

const aiReviewSchema = z.object({
  riskLevel: z.enum(["baixo", "médio", "alto", "crítico"]),
  findings: z.array(
    z.object({
      description: z.string().describe("Vulnerabilidade ou má prática de segurança concreta encontrada NESTE código"),
      recommendation: z.string().describe("Como corrigir especificamente este problema"),
    })
  ),
});

// POST — Scanner estático REAL (regras determinísticas, sempre gratuito) + Revisão de
// Segurança por IA opcional (1 Crédito IA, chamada real ao motor de IA, nunca fabricada).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { code, includeAiReview } = await req.json();
    if (!code?.trim()) {
      return NextResponse.json({ error: "Não há código para analisar." }, { status: 400 });
    }

    const findings = scanCodeForVulnerabilities(code);

    let aiReview = null;
    if (includeAiReview) {
      const tenantId = req.headers.get("x-tenant-id") || "root";
      const newBalance = await debitCredits(tenantId, userId, 1);
      if (newBalance === null) {
        return NextResponse.json({ error: "Saldo de Créditos IA insuficiente para a revisão de IA." }, { status: 402 });
      }

      const { object } = await generateObject({
        model: openai("gpt-4o-mini"),
        schema: aiReviewSchema,
        prompt: `Faz uma revisão de segurança honesta e específica ao seguinte código. Aponta apenas problemas reais de segurança que existam NESTE código concreto (nunca inventes problemas genéricos).\n\nCÓDIGO:\n\`\`\`\n${code}\n\`\`\``,
      });
      aiReview = object;
    }

    await logAuditEvent(userId, "CYBER_LAB_SCAN", { findingsCount: findings.length, includeAiReview: !!includeAiReview });

    return NextResponse.json({ success: true, findings, aiReview });
  } catch (error: any) {
    console.error("Erro no scan do Cyber Lab:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
