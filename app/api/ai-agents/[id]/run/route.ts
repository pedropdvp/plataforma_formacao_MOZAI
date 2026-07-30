import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { debitCredits } from "@/lib/ai-credits";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { ObjectId } from "mongodb";

export const maxDuration = 60;

// POST — Executa um Agente IA: corre cada passo em sequência, real, com o motor de IA da
// plataforma. O resultado de cada passo anterior é injetado no seguinte via {{anterior}},
// e o objetivo inicial do utilizador via {{objetivo}}. Cada passo é uma chamada real e debita
// 1 Crédito IA (um Agente de N passos custa N créditos) — nunca uma simulação de "raciocínio".
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const { goal } = await req.json();
    if (!goal?.trim()) {
      return NextResponse.json({ error: "Descreva o objetivo para o Agente." }, { status: 400 });
    }

    let agent: any;
    try {
      agent = await (await getDb()).collection("ai_agents").findOne({ _id: new ObjectId(id) });
    } catch {
      agent = null;
    }
    if (!agent) {
      return NextResponse.json({ error: "Agente IA não encontrado." }, { status: 404 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";

    if (!agent.isPublic && agent.ownerId !== userId) {
      return NextResponse.json({ error: "Este Agente IA é privado." }, { status: 403 });
    }

    const steps: { title: string; instruction: string }[] = agent.steps || [];
    const results: { title: string; output: string }[] = [];
    let previousOutput = "";

    for (const step of steps) {
      const newBalance = await debitCredits(tenantId, userId, 1);
      if (newBalance === null) {
        return NextResponse.json(
          {
            error: `Saldo de Créditos IA insuficiente para continuar (parou no passo "${step.title}"). Recarregue em Créditos IA.`,
            partialResults: results,
          },
          { status: 402 }
        );
      }

      const filledInstruction = step.instruction
        .replace(/\{\{\s*objetivo\s*\}\}/gi, goal.trim())
        .replace(/\{\{\s*anterior\s*\}\}/gi, previousOutput);

      const { text } = await generateText({
        model: openai("gpt-4o-mini"),
        prompt: filledInstruction,
      });

      previousOutput = text;
      results.push({ title: step.title, output: text });
    }

    after(async () => {
      try {
        const db = await getDb();
        await db.collection("ai_agents").updateOne({ _id: new ObjectId(id) }, { $inc: { usesCount: 1 } });
      } catch (e) {
        console.warn("Erro ao incrementar contador de uso do Agente IA:", e);
      }
    });

    return NextResponse.json({ success: true, results, finalOutput: previousOutput });
  } catch (error: any) {
    console.error("Erro ao executar Agente IA:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
