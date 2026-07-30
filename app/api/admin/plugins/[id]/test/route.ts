import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

const REVIEWER_ROLES = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA"];

// POST — Envia um pedido HTTP REAL de teste ao webhook do plugin e devolve o resultado
// verdadeiro (sucesso/erro/status HTTP) — nunca finge que funcionou.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !REVIEWER_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Sem permissão para testar plugins." }, { status: 403 });
    }

    const { id } = await params;
    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const plugin = await db.collection("installed_plugins").findOne({ _id: new ObjectId(id), tenant_id: tenantId });
    if (!plugin) {
      return NextResponse.json({ error: "Plugin não encontrado." }, { status: 404 });
    }

    try {
      const res = await fetch(plugin.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "test.ping",
          tenantId,
          timestamp: new Date().toISOString(),
          data: { message: "Pedido de teste real enviado pela MOZAI." },
        }),
        signal: AbortSignal.timeout(8000),
      });

      return NextResponse.json({
        success: res.ok,
        message: res.ok
          ? `Webhook respondeu com sucesso (HTTP ${res.status}).`
          : `O webhook respondeu com um erro (HTTP ${res.status}).`,
        httpStatus: res.status,
      });
    } catch (fetchError: any) {
      return NextResponse.json({
        success: false,
        message: `Não foi possível contactar o webhook: ${fetchError?.message || "erro de rede"}.`,
      });
    }
  } catch (error: any) {
    console.error("Erro ao testar plugin:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
