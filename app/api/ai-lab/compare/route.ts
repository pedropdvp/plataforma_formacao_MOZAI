import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateText } from "ai";
import { AI_LAB_PROVIDERS, getAiLabProvider } from "@/lib/ai-lab-providers";
import { searchRelevantContext } from "@/lib/vector-store";
import { debitCredits } from "@/lib/ai-credits";
import { logAuditEvent } from "@/lib/audit";

export const maxDuration = 45;

// GET — Lista o catálogo de fornecedores e quais estão realmente configurados nesta instância
// (nunca finge disponibilidade sem chave de API real).
export async function GET() {
  return NextResponse.json({
    success: true,
    providers: AI_LAB_PROVIDERS.map((p) => ({ id: p.id, label: p.label, vendor: p.vendor, configured: p.isConfigured() })),
  });
}

// POST — Envia o MESMO prompt (com grounding RAG opcional) a vários fornecedores de IA reais
// em paralelo, e devolve as respostas lado a lado — cada uma é uma chamada genuína à API do
// respetivo fornecedor; nunca simula ou reutiliza a resposta de outro modelo.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { prompt, providerIds, useRag, courseId } = await req.json();
    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Escreva um prompt para comparar." }, { status: 400 });
    }
    if (!Array.isArray(providerIds) || providerIds.length === 0) {
      return NextResponse.json({ error: "Escolha pelo menos um fornecedor de IA." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";

    let groundingContext = "";
    if (useRag && courseId) {
      const chunks = await searchRelevantContext(tenantId, courseId, prompt.trim(), 3);
      groundingContext = chunks.join("\n\n---\n\n");
    }

    const finalPrompt = groundingContext
      ? `Responde à pergunta com base EXCLUSIVA no contexto abaixo. Se não conseguires responder a partir dele, diz isso claramente.\n\nCONTEXTO:\n${groundingContext}\n\nPERGUNTA:\n${prompt.trim()}`
      : prompt.trim();

    const results = await Promise.all(
      providerIds.map(async (id: string) => {
        const provider = getAiLabProvider(id);
        if (!provider) {
          return { id, label: id, vendor: "", configured: false, error: "Fornecedor desconhecido." };
        }
        if (!provider.isConfigured()) {
          return {
            id,
            label: provider.label,
            vendor: provider.vendor,
            configured: false,
            error: `Não configurado nesta instância (variável de ambiente "${provider.envVar}" em falta).`,
          };
        }

        const newBalance = await debitCredits(tenantId, userId, 1);
        if (newBalance === null) {
          return { id, label: provider.label, vendor: provider.vendor, configured: true, error: "Saldo de Créditos IA insuficiente." };
        }

        try {
          const start = Date.now();
          const { text } = await generateText({ model: provider.getModel(), prompt: finalPrompt });
          return { id, label: provider.label, vendor: provider.vendor, configured: true, text, latencyMs: Date.now() - start };
        } catch (err: any) {
          return { id, label: provider.label, vendor: provider.vendor, configured: true, error: err.message || "Erro ao chamar este fornecedor." };
        }
      })
    );

    await logAuditEvent(userId, "AI_LAB_COMPARE", { tenantId, providerIds, usedRag: !!(useRag && courseId) });

    return NextResponse.json({ success: true, results, groundedInRag: !!groundingContext });
  } catch (error: any) {
    console.error("Erro na comparação do AI Lab:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
