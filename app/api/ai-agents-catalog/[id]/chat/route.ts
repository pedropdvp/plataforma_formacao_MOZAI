import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAgentPersona } from "@/lib/ai-agents-catalog";
import { debitCredits } from "@/lib/ai-credits";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

export const maxDuration = 30;

// POST — Conversa real com uma das personas do catálogo curado do Módulo 9 AI Agents. Usa o
// mesmo motor de IA (gpt-4o-mini) que todo o resto da plataforma — a especialização vem do
// system prompt da persona, nunca de um modelo ou capacidade diferente.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const persona = getAgentPersona(id);
    if (!persona) {
      return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 });
    }

    const { messages } = await req.json();
    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "Parâmetro 'messages' é obrigatório." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const newBalance = await debitCredits(tenantId, userId, 1);
    if (newBalance === null) {
      return NextResponse.json(
        { error: "Saldo de Créditos IA insuficiente. Recarregue em Créditos IA para continuar." },
        { status: 402 }
      );
    }

    after(async () => {
      try {
        await logAuditEvent(userId, "AI_AGENT_CATALOG_CHAT", { tenantId, agentId: id });
        const db = await getDb();
        await db.collection("ai_agent_catalog_usage").updateOne(
          { tenant_id: tenantId, agentId: id },
          { $inc: { usesCount: 1 }, $set: { lastUsedAt: new Date() } },
          { upsert: true }
        );
      } catch (e) {
        console.warn("Erro ao registar uso do agente do catálogo:", e);
      }
    });

    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: persona.systemPrompt,
      messages,
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error("Erro no chat do agente do catálogo:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
