"use client";

import React, { useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { javascript } from "@codemirror/lang-javascript";
import { Play, Loader2, CheckCircle2, XCircle } from "lucide-react";

const LANGUAGE_EXTENSIONS: Record<string, any> = {
  python: python(),
  python3: python(),
  javascript: javascript(),
  typescript: javascript({ typescript: true }),
  node: javascript(),
};

interface TestCase {
  label?: string;
  stdin: string;
  expectedOutput: string;
}

interface TestResult extends TestCase {
  stdout: string;
  stderr: string;
  passed: boolean;
}

interface CodeLabBlockViewProps {
  language: string;
  starterCode: string;
  expectedOutput?: string;
  /** Quando definido, corre uma suite de testes (uma execução Piston real por caso) em vez de
   * uma única execução com "expectedOutput" — tipo pipeline de CI/testes automáticos. */
  testCases?: TestCase[];
  instructions?: string;
  /** Identificador estável do exercício (ex: "<courseId>:<lessonKey>:<blockId>"), usado
   * para histórico de tentativas e para XP de gamificação contar só na primeira aprovação. */
  exerciseId?: string;
  courseId?: string;
  lessonKey?: string;
  /** Chamado depois de cada execução (com sucesso ou erro), para quem estiver a mostrar
   * um histórico de tentativas o poder recarregar sem sondar em intervalos. */
  onRunComplete?: () => void;
  /** Chamado sempre que o código no editor muda — permite ao ecrã pai (ex: Coding Lab) usar
   * o código atual para outras ações (Code Review IA, exportar para GitHub). */
  onCodeChange?: (code: string) => void;
}

/**
 * Bloco de código executável embutido numa lição — o MVP honesto de "ambiente tipo
 * Jupyter": execução real e isolada via Piston, mas sem kernels persistentes nem
 * estado partilhado entre blocos (isso seria um Jupyter real, fora de âmbito).
 */
export function CodeLabBlockView({ language, starterCode, expectedOutput, testCases, instructions, exerciseId, courseId, lessonKey, onRunComplete, onCodeChange }: CodeLabBlockViewProps) {
  const [code, setCode] = useState(starterCode);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<{ stdout: string; stderr: string; passed?: boolean; testResults?: TestResult[]; xpAwarded?: number; badgeUnlocked?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/coding-lab/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code, expectedOutput, testCases, exerciseId, courseId, lessonKey }),
      });
      const data = await res.json();
      if (res.ok) {
        setOutput({
          stdout: data.stdout,
          stderr: data.stderr,
          passed: data.passed,
          testResults: data.testResults,
          xpAwarded: data.xpAwarded,
          badgeUnlocked: data.badgeUnlocked,
        });
      } else {
        setError(data.error || "Erro ao executar o código.");
      }
    } catch {
      setError("Erro de comunicação com o motor de execução (Piston).");
    } finally {
      setRunning(false);
      onRunComplete?.();
    }
  };

  const extension = LANGUAGE_EXTENSIONS[language] || LANGUAGE_EXTENSIONS.python;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden no-3d-effect">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/40">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Laboratório de Código — {language}</span>
          {instructions && <p className="text-xs text-slate-300 mt-1">{instructions}</p>}
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Executar
        </button>
      </div>

      <CodeMirror
        value={code}
        height="220px"
        theme="dark"
        extensions={[extension]}
        onChange={(value) => {
          setCode(value);
          onCodeChange?.(value);
        }}
        basicSetup={{ lineNumbers: true, foldGutter: true }}
      />

      {(output || error) && (
        <div className="border-t border-slate-800 p-3 space-y-2 bg-black/40">
          {error ? (
            <p className="text-xs text-rose-400 font-mono">{error}</p>
          ) : output?.testResults ? (
            <>
              <div className={`flex items-center gap-1.5 text-xs font-bold ${output.passed ? "text-emerald-400" : "text-rose-400"}`}>
                {output.passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                {output.testResults.filter((t) => t.passed).length} / {output.testResults.length} testes passaram
              </div>
              <div className="space-y-1.5">
                {output.testResults.map((t, i) => (
                  <div key={i} className={`text-[11px] font-mono px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 ${t.passed ? "bg-emerald-500/5 text-emerald-400" : "bg-rose-500/5 text-rose-400"}`}>
                    <span className="flex items-center gap-1.5 truncate">
                      {t.passed ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <XCircle className="h-3 w-3 shrink-0" />}
                      {t.label || `Teste ${i + 1}`}
                    </span>
                    {!t.passed && <span className="text-slate-500 truncate">obtido: {t.stdout.trim() || "(vazio)"}</span>}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {output?.passed !== undefined && (
                <div className={`flex items-center gap-1.5 text-xs font-bold ${output.passed ? "text-emerald-400" : "text-rose-400"}`}>
                  {output.passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {output.passed ? "Resultado correto!" : "Resultado diferente do esperado."}
                </div>
              )}
              {output?.stdout && <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap">{output.stdout}</pre>}
              {output?.stderr && <pre className="text-xs text-rose-400 font-mono whitespace-pre-wrap">{output.stderr}</pre>}
            </>
          )}
          {!!output?.xpAwarded && (
            <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
              +{output.xpAwarded} XP{output.badgeUnlocked ? " · Distintivo \"Code Runner\" desbloqueado!" : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
