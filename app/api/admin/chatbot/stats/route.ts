import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

const ALLOWED_ROLES = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA"];

// Preço estimado por 1 milhão de tokens (blended input+output, gpt-4o-mini), em USD.
// Só uma estimativa informativa — ajustável por variável de ambiente.
const PRICE_USD_PER_MTOK = Number(process.env.OPENAI_PRICE_USD_PER_MTOK || 0.3);

interface TenantStats {
  conversations: number;
  messages: number;
  userMessages: number;
  assistantMessages: number;
  totalTokens: number;
  conversations7d: number;
  estimatedCostUsd: number;
  perDay: { day: string; messages: number }[];
}

async function computeStatsForTenant(tenantId: string): Promise<TenantStats> {
  const db = await getDb();
  const conversations = await db.collection("chatbot_conversations").find({ tenantId }).toArray();
  const conversationIds = conversations.map((c: any) => c._id.toString());

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const conversations7d = conversations.filter((c: any) => c.createdAt && c.createdAt > sevenDaysAgo).length;

  if (conversationIds.length === 0) {
    return {
      conversations: 0,
      messages: 0,
      userMessages: 0,
      assistantMessages: 0,
      totalTokens: 0,
      conversations7d,
      estimatedCostUsd: 0,
      perDay: [],
    };
  }

  const messages = await db
    .collection("chatbot_messages")
    .find({ conversationId: { $in: conversationIds } })
    .toArray();

  let userMessages = 0;
  let assistantMessages = 0;
  let totalTokens = 0;
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const perDayMap = new Map<string, number>();

  for (const m of messages) {
    if (m.role === "user") userMessages++;
    else if (m.role === "assistant") assistantMessages++;
    if (typeof m.tokens === "number") totalTokens += m.tokens;

    if (m.createdAt && m.createdAt > fourteenDaysAgo) {
      const day = new Date(m.createdAt).toISOString().slice(0, 10);
      perDayMap.set(day, (perDayMap.get(day) || 0) + 1);
    }
  }

  const perDay = [...perDayMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => ({ day, messages: count }));

  return {
    conversations: conversations.length,
    messages: messages.length,
    userMessages,
    assistantMessages,
    totalTokens,
    conversations7d,
    estimatedCostUsd: Number(((totalTokens / 1_000_000) * PRICE_USD_PER_MTOK).toFixed(4)),
    perDay,
  };
}

/**
 * GET — Estatísticas de utilização/custo do ChatBot do próprio tenant. ADMIN/SUPORTE veem
 * ainda um resumo por empresa (só visualização, tal como nas outras páginas de Configurações).
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !ALLOWED_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const tenantId = activeRole === "GESTOR_EMPRESA" ? req.headers.get("x-tenant-id") || "root" : "root";
    const own = await computeStatsForTenant(tenantId);

    let companies: any[] = [];
    if (activeRole === "ADMIN" || activeRole === "SUPORTE") {
      const db = await getDb();
      const tenants = await db.collection("tenants").find({}).toArray();
      companies = await Promise.all(
        tenants.map(async (t: any) => {
          const stats = await computeStatsForTenant(t._id.toString());
          return { tenantId: t._id.toString(), name: t.name, ...stats };
        })
      );
    }

    return NextResponse.json({ success: true, own, companies, pricePerMTokUsd: PRICE_USD_PER_MTOK });
  } catch (error: any) {
    console.error("Erro ao consultar estatísticas do ChatBot:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
