import { NextRequest, NextResponse, after } from "next/server";
import { getDb } from "@/lib/mongodb";
import { authenticateApiKey } from "@/lib/api-auth";
import { debitCredits } from "@/lib/ai-credits";
import { fillPromptTemplate } from "@/lib/prompts";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { ObjectId } from "mongodb";

export const maxDuration = 30;

// POST — API pública real para developers externos: executa um Prompt do Marketplace usando
// uma chave de API (Authorization: Bearer mozai_...) em vez de sessão Clerk. Debita créditos ao
// dono da chave, tal como o uso normal na aplicação.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await authenticateApiKey(req);
    if (!identity) {
      return NextResponse.json({ error: "Chave de API em falta, inválida ou revogada." }, { status: 401 });
    }

    const { id } = await params;
    const { variables } = await req.json();

    let prompt: any;
    try {
      prompt = await (await getDb()).collection("ai_prompts").findOne({ _id: new ObjectId(id) });
    } catch {
      prompt = null;
    }
    if (!prompt) {
      return NextResponse.json({ error: "Prompt não encontrado." }, { status: 404 });
    }
    if (!prompt.isPublic && prompt.ownerId !== identity.userId) {
      return NextResponse.json({ error: "Este Prompt é privado." }, { status: 403 });
    }

    const missing = (prompt.variables || []).filter((v: string) => !variables?.[v]?.trim());
    if (missing.length > 0) {
      return NextResponse.json({ error: `Preencha as variáveis: ${missing.join(", ")}.` }, { status: 400 });
    }

    const newBalance = await debitCredits(identity.tenantId, identity.userId, 1);
    if (newBalance === null) {
      return NextResponse.json({ error: "Saldo de Créditos IA insuficiente." }, { status: 402 });
    }

    const finalPrompt = fillPromptTemplate(prompt.template, variables || {});
    const { text } = await generateText({ model: openai("gpt-4o-mini"), prompt: finalPrompt });

    after(async () => {
      try {
        const db = await getDb();
        await db.collection("ai_prompts").updateOne({ _id: new ObjectId(id) }, { $inc: { usesCount: 1 } });
      } catch (e) {
        console.warn("Erro ao incrementar contador de uso do Prompt (API pública):", e);
      }
    });

    return NextResponse.json({ success: true, result: text, creditsRemaining: newBalance });
  } catch (error: any) {
    console.error("Erro na API pública de Prompts:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
