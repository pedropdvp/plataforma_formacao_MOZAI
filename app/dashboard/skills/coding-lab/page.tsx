"use client";

import React, { useState } from "react";
import { Terminal as TerminalIcon, Play, CheckCircle2, AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function CodingLabPage() {
  const [code, setCode] = useState(
    `def calculate_sum(a, b):\n    # Escreva o seu código aqui\n    return a + b\n\n# Testando a função\nprint(calculate_sum(10, 5))`
  );
  const [running, setRunning] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [testsPassed, setTestsPassed] = useState<boolean | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setTerminalOutput([
      "A iniciar sandbox Python...",
      "A carregar dependências do compilador...",
      "A enviar código para o servidor..."
    ]);
    setTestsPassed(null);

    try {
      const res = await fetch("/api/coding-lab/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });

      if (res.ok) {
        const data = await res.json();
        setTerminalOutput(data.output);
        setTestsPassed(data.passed);
      } else {
        const errData = await res.json();
        setTerminalOutput([
          "Erro na execução da Sandbox:",
          errData.error || "Ocorreu um erro interno do servidor."
        ]);
        setTestsPassed(false);
      }
    } catch (err) {
      console.error(err);
      setTerminalOutput([
        "Erro de rede:",
        "Não foi possível estabelecer ligação ao compilador da sandbox."
      ]);
      setTestsPassed(false);
    } finally {
      setRunning(false);
    }
  };

  const handleReset = () => {
    setCode(`def calculate_sum(a, b):\n    # Escreva o seu código aqui\n    return a + b\n\n# Testando a função\nprint(calculate_sum(10, 5))`);
    setTerminalOutput([]);
    setTestsPassed(null);
  };

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-4rem)] overflow-hidden -m-8 workspace-page-container">
      {/* Header bar */}
      <div className="p-6 border-b border-slate-900 bg-slate-950 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/skills" className="p-2 rounded-lg border border-slate-800 hover:bg-slate-900 text-slate-400">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">MOZAI Coding Lab</h1>
            <span className="text-[10px] text-slate-500">Exercício 1.1 &bull; Sandbox Python Isolado</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleReset}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl border border-slate-800 text-xs font-semibold text-slate-400 hover:bg-slate-900 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reiniciar Código
          </button>
          <button
            onClick={handleRun}
            disabled={running}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all disabled:opacity-50"
          >
            {running ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                A Executar...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-white" />
                Executar Código
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Sandbox Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left side: Instructions */}
        <div className="w-1/3 border-r border-slate-900 p-6 overflow-y-auto space-y-6">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Instruções</span>
            <h2 className="text-xl font-bold text-white">Soma Simples em Python</h2>
          </div>

          <div className="space-y-4 text-xs text-slate-400 leading-relaxed">
            <p>
              Neste exercício prático, deves escrever o corpo de uma função em Python chamada <code className="px-1.5 py-0.5 rounded bg-slate-900 font-mono text-indigo-400">calculate_sum</code>.
            </p>
            <p>
              A função recebe dois parâmetros numéricos (<code className="px-1 py-0.5 rounded bg-slate-900 text-slate-350">a</code> e <code className="px-1 py-0.5 rounded bg-slate-900 text-slate-350">b</code>) e deve retornar a soma matemática exata das duas variáveis.
            </p>
            <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-900 space-y-2">
              <h4 className="font-bold text-white text-[11px]">Exemplo de Execução:</h4>
              <pre className="font-mono text-[10px] text-slate-400 bg-slate-950 p-2.5 rounded-lg">
{`# Entrada:
calculate_sum(10, 5)

# Saída:
15`}
              </pre>
            </div>
          </div>
        </div>

        {/* Right side: Editor and Terminal */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Editor area */}
          <div className="flex-1 p-6 relative overflow-hidden bg-slate-950/40">
            <span className="absolute top-2 right-4 text-[9px] text-slate-600 font-mono">calculate_sum.py</span>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-full bg-transparent border-0 resize-none font-mono text-xs focus:outline-none focus:ring-0 text-slate-300 leading-relaxed"
              style={{ tabSize: 4 }}
              spellCheck={false}
            />
          </div>

          {/* Terminal output area */}
          <div className="coding-lab-console h-64 border-t border-slate-900 bg-slate-950 p-6 flex flex-col justify-between flex-shrink-0">
            <div className="space-y-2 flex-1 overflow-y-auto">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-2">
                <TerminalIcon className="h-4 w-4 text-cyan-400" />
                Consola do Compilador
              </div>

              <div className="space-y-1 font-mono text-[11px] text-slate-400">
                {terminalOutput.length === 0 ? (
                  <span className="text-slate-600 italic">Prima &quot;Executar Código&quot; para rodar os testes unitários.</span>
                ) : (
                  terminalOutput.map((line, idx) => (
                    <div
                      key={idx}
                      className={
                        line.startsWith("✓")
                          ? "text-emerald-400"
                          : line.startsWith("✗")
                          ? "text-rose-400"
                          : line.startsWith("Erro")
                          ? "text-rose-500 font-bold"
                          : "text-slate-400"
                      }
                    >
                      {line}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Test result banner */}
            {testsPassed !== null && (
              <div
                className={`p-3 rounded-xl border flex items-center gap-2 mt-4 text-xs font-bold ${
                  testsPassed
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                    : "border-rose-500/20 bg-rose-500/10 text-rose-400"
                }`}
              >
                {testsPassed ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Exercício Concluído! Habilidade em Python atualizada no Grafo.
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4" />
                    Houve falhas na execução. Verifique a consola do compilador e tente de novo.
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Loader2(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
