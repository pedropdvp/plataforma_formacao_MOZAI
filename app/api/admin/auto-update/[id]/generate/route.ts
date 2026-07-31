import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { debitCredits } from "@/lib/ai-credits";
import { logAuditEvent } from "@/lib/audit";
import { ObjectId } from "mongodb";

export const maxDuration = 30;

// POST — Gera um RASCUNHO real de conteúdo educativo a partir de um item real do feed
// (título+descrição genuínos vindos do GitHub/arXiv) — fica com status "draft_pending_review":
// nunca é publicado automaticamente, precisa da revisão humana (item 23 já implementado).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }
    const activeRole = req.cookies.get("active-role")?.value;
    if (activeRole !== "ADMIN" && activeRole !== "SUPORTE") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { id } = await params;
    const db = await getDb();
    const item = await db.collection("auto_update_feed").findOne({ _id: new ObjectId(id) });
    if (!item) {
      return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const newBalance = await debitCredits(tenantId, userId, 1);
    if (newBalance === null) {
      return NextResponse.json({ error: "Saldo de Créditos IA insuficiente." }, { status: 402 });
    }

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: `Com base NESTA informação real e recente, escreve um rascunho curto (300-500 palavras) de módulo educativo para a plataforma MOZAI, explicando o que mudou e porque é relevante para quem está a aprender. Não inventes detalhes que não estejam na fonte.\n\nFonte: ${item.sourceLabel}\nTítulo: ${item.title}\nDescrição: ${item.description}`,
    });

    await db.collection("auto_update_feed").updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "draft_pending_review", draftContent: text, draftedAt: new Date(), draftedBy: userId } }
    );

    await logAuditEvent(userId, "AUTO_UPDATE_DRAFT_GENERATED", { tenantId, itemId: id });

    return NextResponse.json({ success: true, draftContent: text });
  } catch (error: any) {
    console.error("Erro ao gerar rascunho de Atualização Automática:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
