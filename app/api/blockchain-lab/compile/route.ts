import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { compileSolidity } from "@/lib/blockchain/compiler";
import { logAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 20;

// POST — Compila código Solidity real (solc), devolvendo ABI/bytecode reais ou os erros de
// compilação genuínos do compilador — nunca uma simulação.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { code } = await req.json();
    if (!code?.trim()) {
      return NextResponse.json({ error: "Não há código Solidity para compilar." }, { status: 400 });
    }

    const result = compileSolidity(code);

    await logAuditEvent(userId, "BLOCKCHAIN_LAB_COMPILE", { success: result.success });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Erro ao compilar Solidity:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
