"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Loader2, History, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { CodeLabBlockView } from "@/components/lesson-blocks/CodeLabBlockView";

interface AttemptHistoryItem {
  _id: string;
  passed: boolean | null;
  timestamp: string;
}

const EXERCISES: Record<string, { starterCode: string; expectedOutput: string }> = {
  python: {
    starterCode: `def calculate_sum(a, b):\n    # Escreva o seu código aqui\n    return a + b\n\nprint(calculate_sum(10, 5))`,
    expectedOutput: "15",
  },
  javascript: {
    starterCode: `function calculateSum(a, b) {\n  // Escreva o seu código aqui\n  return a + b;\n}\n\nconsole.log(calculateSum(10, 5));`,
    expectedOutput: "15",
  },
  typescript: {
    starterCode: `function calculateSum(a: number, b: number): number {\n  // Escreva o seu código aqui\n  return a + b;\n}\n\nconsole.log(calculateSum(10, 5));`,
    expectedOutput: "15",
  },
};

export default function CodingLabPage() {
  const [language, setLanguage] = useState("python");
  const [runtimes, setRuntimes] = useState<{ language: string; aliases: string[] }[]>([]);
  const [loadingRuntimes, setLoadingRuntimes] = useState(true);
  const [history, setHistory] = useState<AttemptHistoryItem[]>([]);

  const exerciseId = `standalone:coding-lab:${language}`;

  useEffect(() => {
    async function loadRuntimes() {
      try {
        const res = await fetch("/api/coding-lab/run");
        const data = await res.json();
        if (res.ok) setRuntimes(data.runtimes || []);
      } catch {
        // silencioso — o seletor fica só com as linguagens pré-definidas do exercício
      } finally {
        setLoadingRuntimes(false);
      }
    }
    loadRuntimes();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await fetch(`/api/coding-lab/attempts?exerciseId=${encodeURIComponent(exerciseId)}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.attempts || []);
      }
    } catch {
      // silencioso — o histórico é um extra, não bloqueia o uso do laboratório
    }
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId]);

  const exercise = EXERCISES[language] || EXERCISES.python;
  const availableLanguages = Object.keys(EXERCISES).filter(
    (lang) => runtimes.length === 0 || runtimes.some((r) => r.language === lang || r.aliases.includes(lang))
  );

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
            <span className="text-[10px] text-slate-500">Exercício 1.1 &bull; Execução real e isolada via Piston</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {loadingRuntimes ? (
            <Loader2 className="h-4 w-4 text-slate-500 animate-spin" />
          ) : (
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="h-9 px-3 rounded-xl border border-slate-800 bg-slate-950 text-xs font-semibold text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              {availableLanguages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Main Sandbox Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left side: Instructions */}
        <div className="w-1/3 border-r border-slate-900 p-6 overflow-y-auto space-y-6">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Instruções</span>
            <h2 className="text-xl font-bold text-white">Soma Simples</h2>
          </div>

          <div className="space-y-4 text-xs text-slate-400 leading-relaxed">
            <p>
              Neste exercício, deves escrever o corpo de uma função que soma dois números e imprime o resultado.
            </p>
            <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-900 space-y-2">
              <h4 className="font-bold text-white text-[11px]">Exemplo de Execução:</h4>
              <pre className="font-mono text-[10px] text-slate-400 bg-slate-950 p-2.5 rounded-lg">
{`# Entrada: (10, 5)
# Saída esperada: 15`}
              </pre>
            </div>
            <p className="text-[10px] text-slate-600">
              O código corre isolado na infraestrutura pública do Piston — não no nosso servidor.
            </p>
          </div>

          {/* Histórico de execuções */}
          <div className="space-y-2 pt-2 border-t border-slate-900">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" /> Últimas Execuções
            </span>
            {history.length === 0 ? (
              <span className="text-[10px] text-slate-600 italic">Ainda não executou este exercício.</span>
            ) : (
              <div className="space-y-1.5">
                {history.map((h) => (
                  <div key={h._id} className="flex items-center justify-between text-[10px] text-slate-500 px-2.5 py-1.5 rounded-lg bg-slate-900/40">
                    <span className="flex items-center gap-1.5">
                      {h.passed === true ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      ) : h.passed === false ? (
                        <XCircle className="h-3 w-3 text-rose-400" />
                      ) : null}
                      {new Date(h.timestamp).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side: Editor executável */}
        <div className="flex-1 p-6 overflow-y-auto">
          <CodeLabBlockView
            key={language}
            language={language}
            starterCode={exercise.starterCode}
            expectedOutput={exercise.expectedOutput}
            instructions="Complete a função e execute para validar o resultado."
            exerciseId={exerciseId}
            onRunComplete={loadHistory}
          />
        </div>
      </div>
    </div>
  );
}
