import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { debitCredits } from "@/lib/ai-credits";
import { searchRelevantContext } from "@/lib/vector-store";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { ObjectId } from "mongodb";

export const maxDuration = 30;

// POST — Conversa com um Modelo IA publicado no Marketplace. Usa o mesmo motor (Vercel AI SDK +
// gpt-4o-mini + RAG) do Tutor de IA das aulas, mas com o system prompt e o conhecimento próprios
// definidos pelo autor do modelo. Debita 1 Crédito IA por interação, como qualquer outra chamada à IA.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const { messages } = await req.json();
    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "Parâmetro 'messages' é obrigatório." }, { status: 400 });
    }

    let model: any;
    try {
      model = await (await getDb()).collection("ai_models").findOne({ _id: new ObjectId(id) });
    } catch {
      model = null;
    }
    if (!model) {
      return NextResponse.json({ error: "Modelo IA não encontrado." }, { status: 404 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";

    // Só pode usar se for público, ou o próprio autor a testá-lo (mesmo antes de o publicar).
    if (!model.isPublic && model.ownerId !== userId) {
      return NextResponse.json({ error: "Este Modelo IA é privado." }, { status: 403 });
    }

    const newBalance = await debitCredits(tenantId, userId, 1);
    if (newBalance === null) {
      return NextResponse.json(
        { error: "Saldo de Créditos IA insuficiente. Recarregue em Créditos IA para continuar." },
        { status: 402 }
      );
    }

    let groundingContext = "";
    if (model.hasKnowledge) {
      const latestUserMessage = messages[messages.length - 1].content;
      const chunks = await searchRelevantContext(model.tenant_id, `aimodel-${id}`, latestUserMessage, 3);
      groundingContext = chunks.join("\n\n---\n\n");
    }

    const systemPrompt = model.hasKnowledge
      ? `${model.systemPrompt}\n\nUsa como referência exclusiva, quando relevante, o seguinte CONHECIMENTO PRÓPRIO deste assistente:\n${groundingContext || "(sem conhecimento relevante encontrado para esta pergunta)"}`
      : model.systemPrompt;

    after(async () => {
      try {
        const db = await getDb();
        await db.collection("ai_models").updateOne({ _id: new ObjectId(id) }, { $inc: { usesCount: 1 } });
      } catch (e) {
        console.warn("Erro ao incrementar contador de uso do Modelo IA:", e);
      }
    });

    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      messages,
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error("Erro no chat do Modelo IA:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
