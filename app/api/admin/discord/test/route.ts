import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { sendDiscordNotification } from "@/lib/discord";

const ALLOWED_ROLES = ["ADMIN", "GESTOR_EMPRESA"];

// POST — Envia uma mensagem de teste REAL para o canal do Discord ligado, e devolve o
// resultado verdadeiro (nunca finge sucesso).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }
    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !ALLOWED_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const result = await sendDiscordNotification(
      tenantId,
      "Mensagem de Teste",
      "Se está a ver isto, a ligação da MOZAI ao seu servidor de Discord está a funcionar corretamente."
    );

    if (!result.sent) {
      return NextResponse.json({ error: result.error === "not_configured" ? "Configure primeiro o webhook do Discord." : result.error }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
