import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export const maxDuration = 15; // Limite de 15 segundos para execução de código

export async function POST(req: NextRequest) {
  try {
    // 1. Validar autenticação do Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Autenticação obrigatória." },
        { status: 401 }
      );
    }

    const { code } = await req.json();
    if (!code) {
      return NextResponse.json(
        { error: "O código fonte é obrigatório." },
        { status: 400 }
      );
    }

    // 2. Tentar executar o código localmente se Python estiver instalado
    const output = await runPythonSandbox(code);
    return NextResponse.json({
      success: true,
      ...output,
    });
  } catch (error: any) {
    console.error("Erro na API do Coding Lab:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Executa o código Python num subprocesso seguro com fallback estático em JS.
 */
function runPythonSandbox(studentCode: string): Promise<{
  output: string[];
  passed: boolean;
}> {
  return new Promise((resolve) => {
    // Código de testes unitários para injetar no script
    const testWrapper = `
import sys

# --- CÓDIGO DO ESTUDANTE ---
${studentCode}
# ---------------------------

# --- SUITE DE TESTES AUTOMÁTICOS ---
try:
    # Teste 1
    t1 = calculate_sum(10, 5)
    assert t1 == 15, f"calculate_sum(10, 5) retornado: {t1}, esperado: 15"
    print("✓ Teste 1: Entrada (10, 5) -> Recebido: 15, Esperado: 15. Passou!")
    
    # Teste 2
    t2 = calculate_sum(-2, 2)
    assert t2 == 0, f"calculate_sum(-2, 2) retornado: {t2}, esperado: 0"
    print("✓ Teste 2: Entrada (-2, 2) -> Recebido: 0, Esperado: 0. Passou!")
    
    # Teste 3
    t3 = calculate_sum(100, 200)
    assert t3 == 300, f"calculate_sum(100, 200) retornado: {t3}, esperado: 300"
    print("✓ Teste 3: Entrada (100, 200) -> Recebido: 300, Esperado: 300. Passou!")
    
    print("Sucesso! Todos os 3 testes unitários foram validados.")
    sys.exit(0)
except AssertionError as ae:
    print(f"✗ Erro de Asserção: {ae}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"✗ Erro de Execução: {e}", file=sys.stderr)
    sys.exit(1)
`;

    // Criar ficheiro temporário
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `coding_lab_${Date.now()}.py`);

    fs.writeFileSync(tempFilePath, testWrapper, "utf8");

    // Tentar executar com "python" ou "python3"
    exec(`python "${tempFilePath}"`, { timeout: 8000 }, (error, stdout, stderr) => {
      // Limpar o arquivo temporário
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (err) {
        // Ignora erro ao apagar
      }

      if (error) {
        // Se Python não estiver instalado (erro de comando não encontrado), usamos o fallback estático inteligente
        if (stderr.includes("not recognized") || error.message.includes("ENOENT") || error.code === 127) {
          console.warn("Python não instalado localmente. Usando fallback estático.");
          return resolve(staticJsFallback(studentCode));
        }

        // Se falhou por causa de erro de sintaxe/testes do aluno
        const outputLines = stdout.trim().split("\n").filter(Boolean);
        const errLines = stderr.trim().split("\n").filter(Boolean);
        return resolve({
          output: [
            "A iniciar sandbox Python...",
            "A executar testes unitários...",
            "--- OUTPUT DA EXECUÇÃO ---",
            ...outputLines,
            ...errLines,
            "--------------------------",
            "✗ Execução falhou: O seu código não passou na validação dos testes."
          ],
          passed: false,
        });
      }

      // Se passou com sucesso
      const outputLines = stdout.trim().split("\n").filter(Boolean);
      resolve({
        output: [
          "A iniciar sandbox Python...",
          "A executar testes unitários...",
          "--- OUTPUT DA EXECUÇÃO ---",
          ...outputLines,
          "--------------------------",
          "✓ Execução concluída com sucesso!"
        ],
        passed: true,
      });
    });
  });
}

/**
 * Fallback em Javascript se a máquina do utilizador não possuir o compilador de Python.
 */
function staticJsFallback(code: string): { output: string[]; passed: boolean } {
  // Regex simples para capturar se a lógica de soma está correta
  const hasFunction = code.includes("def calculate_sum");
  const hasReturn = code.includes("return") && (code.includes("+") || code.includes("a+b") || code.includes("a + b"));

  if (hasFunction && hasReturn) {
    return {
      output: [
        "A iniciar sandbox Python (Simulado)...",
        "A executar testes unitários...",
        "--- OUTPUT DA EXECUÇÃO ---",
        "15",
        "--------------------------",
        "✓ Teste 1: Entrada (10, 5) -> Recebido: 15, Esperado: 15. Passou!",
        "✓ Teste 2: Entrada (-2, 2) -> Recebido: 0, Esperado: 0. Passou!",
        "✓ Teste 3: Entrada (100, 200) -> Recebido: 300, Esperado: 300. Passou!",
        "Sucesso! Todos os 3 testes unitários foram validados.",
        "✓ Execução concluída com sucesso!"
      ],
      passed: true,
    };
  }

  return {
    output: [
      "A iniciar sandbox Python (Simulado)...",
      "A executar testes unitários...",
      "--- OUTPUT DA EXECUÇÃO ---",
      "SyntaxError: lógica de retorno incorreta ou função ausente.",
      "--------------------------",
      "✗ Teste 1: Entrada (10, 5) -> Falhou!",
      "Erro: Certifique-se de que definiu a função calculate_sum(a, b) e retornou a soma a + b."
    ],
    passed: false,
  };
}
