import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { debitCredits } from "@/lib/ai-credits";
import { fillPromptTemplate } from "@/lib/prompts";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { ObjectId } from "mongodb";

export const maxDuration = 30;

// POST — Executa um Prompt publicado no Marketplace: preenche as variáveis {{...}} com os
// valores dados pelo utilizador e invoca o motor real de IA uma única vez (resposta não-stream,
// já que é um resultado pontual, não uma conversa). Debita 1 Crédito IA, como qualquer chamada à IA.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
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

    const tenantId = req.headers.get("x-tenant-id") || "root";

    if (!prompt.isPublic && prompt.ownerId !== userId) {
      return NextResponse.json({ error: "Este Prompt é privado." }, { status: 403 });
    }

    const missing = (prompt.variables || []).filter((v: string) => !variables?.[v]?.trim());
    if (missing.length > 0) {
      return NextResponse.json({ error: `Preencha as variáveis: ${missing.join(", ")}.` }, { status: 400 });
    }

    const newBalance = await debitCredits(tenantId, userId, 1);
    if (newBalance === null) {
      return NextResponse.json(
        { error: "Saldo de Créditos IA insuficiente. Recarregue em Créditos IA para continuar." },
        { status: 402 }
      );
    }

    const finalPrompt = fillPromptTemplate(prompt.template, variables || {});

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: finalPrompt,
    });

    after(async () => {
      try {
        const db = await getDb();
        await db.collection("ai_prompts").updateOne({ _id: new ObjectId(id) }, { $inc: { usesCount: 1 } });
      } catch (e) {
        console.warn("Erro ao incrementar contador de uso do Prompt:", e);
      }
    });

    return NextResponse.json({ success: true, result: text });
  } catch (error: any) {
    console.error("Erro ao executar Prompt:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
