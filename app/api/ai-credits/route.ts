import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCreditBalance, addCredits } from "@/lib/ai-credits";

/** Pacotes de recarga disponíveis (mesmos valores já mostrados na página Créditos IA). */
const REFILL_PACKS: Record<string, { amount: number; price: string }> = {
  bronze: { amount: 100, price: "4,90 €" },
  prata: { amount: 500, price: "19,90 €" },
};

/** GET — Saldo real de créditos IA do utilizador autenticado. */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }
    const tenantId = req.headers.get("x-tenant-id") || "root";
    const balance = await getCreditBalance(tenantId, userId);
    return NextResponse.json({ success: true, balance });
  } catch (error: any) {
    console.error("Erro ao consultar créditos IA:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** POST — Recarrega o saldo (simulação de compra, sem gateway de pagamento real, mas persiste). */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const { pack } = await req.json();
    const selected = REFILL_PACKS[pack];
    if (!selected) {
      return NextResponse.json({ error: "Pacote de recarga inválido." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const balance = await addCredits(tenantId, userId, selected.amount);
    return NextResponse.json({ success: true, balance, added: selected.amount, price: selected.price });
  } catch (error: any) {
    console.error("Erro ao recarregar créditos IA:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
