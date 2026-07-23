import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { executeCode, getPistonRuntimes } from "@/lib/coding-lab/piston";

export const runtime = "nodejs";
export const maxDuration = 20;

// GET — Lista as linguagens/versões atualmente suportadas pelo Piston (para o seletor de linguagem no editor).
export async function GET() {
  try {
    const runtimes = await getPistonRuntimes();
    return NextResponse.json({ success: true, runtimes });
  } catch (error: any) {
    console.error("Erro ao listar runtimes do Piston:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Executa código real e isolado via Piston (substitui o antigo stub local sem sandbox).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { language, code, stdin, expectedOutput } = await req.json();
    if (!language || !code) {
      return NextResponse.json({ error: "Os campos 'language' e 'code' são obrigatórios." }, { status: 400 });
    }

    const result = await executeCode(language, code, stdin || "");

    const passed = expectedOutput !== undefined && expectedOutput !== null && expectedOutput !== ""
      ? result.stdout.trim() === String(expectedOutput).trim()
      : undefined;

    return NextResponse.json({
      success: true,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      passed,
    });
  } catch (error: any) {
    console.error("Erro na execução de código (Piston):", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
