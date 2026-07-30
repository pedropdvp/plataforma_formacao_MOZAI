import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { EC2_REFERENCE_PRICING_USD_PER_HOUR, estimateMonthlyCostUsd } from "@/lib/cloud-lab/pricing";

// GET — Devolve a tabela de preços de referência (para o seletor no cliente).
export async function GET() {
  return NextResponse.json({ success: true, pricing: EC2_REFERENCE_PRICING_USD_PER_HOUR });
}

// POST — Calcula uma estimativa REAL (aritmética real sobre preços de referência publicados),
// nunca uma cotação ao vivo da AWS — isso é dito explicitamente na resposta.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { instanceType, quantity } = await req.json();
    const qty = Math.max(1, Math.min(1000, parseInt(quantity) || 1));

    const monthlyUsd = estimateMonthlyCostUsd(instanceType, qty);
    if (monthlyUsd === null) {
      return NextResponse.json({ error: "Tipo de instância desconhecido nesta tabela de referência." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      instanceType,
      quantity: qty,
      monthlyUsd: Math.round(monthlyUsd * 100) / 100,
      note: "Estimativa baseada em preços de referência on-demand (Linux, us-east-1) publicados pela AWS — não é uma cotação em tempo real; os preços reais podem variar.",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
