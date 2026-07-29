"use client";

import React, { useState, useRef, useEffect } from "react";
import { TerminalSquare, CheckCircle2, Circle, Loader2 } from "lucide-react";

interface TerminalStep {
  id: string;
  description: string;
  command: string;
}

interface TerminalLabBlockViewProps {
  instructions?: string;
  steps: TerminalStep[];
  expectedOutput?: string;
  exerciseId?: string;
  courseId?: string;
  lessonKey?: string;
}

interface HistoryLine {
  type: "input" | "stdout" | "stderr";
  text: string;
}

/**
 * Terminal simulado com execução REAL via Piston (linguagem bash) — reaproveita
 * integralmente o motor do Coding Lab (/api/coding-lab/run): histórico de tentativas,
 * XP na primeira aprovação e limite de cadência partilhado. Sem estado persistente
 * de shell entre pedidos (cada execução corre o script acumulado desde o início).
 */
export function TerminalLabBlockView({ instructions, steps, expectedOutput, exerciseId, courseId, lessonKey }: TerminalLabBlockViewProps) {
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [lines, setLines] = useState<HistoryLine[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [xpAwarded, setXpAwarded] = useState(0);
  const [badgeUnlocked, setBadgeUnlocked] = useState(false);
  const [passed, setPassed] = useState<boolean | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  // Um passo de referência é assinalado como "feito" assim que o aluno já tiver
  // digitado esse comando (comparação exata, apenas indicativa) — não bloqueia nada.
  const doneStepIds = new Set(
    steps.filter((s) => commandHistory.some((c) => c.trim() === s.command.trim())).map((s) => s.id)
  );

  const handleRunCommand = async () => {
    const command = input.trim();
    if (!command || running) return;

    setInput("");
    setError(null);
    setLines((prev) => [...prev, { type: "input", text: command }]);
    setRunning(true);

    const nextHistory = [...commandHistory, command];
    setCommandHistory(nextHistory);

    try {
      const res = await fetch("/api/coding-lab/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: "bash",
          code: nextHistory.join("\n"),
          expectedOutput,
          exerciseId,
          courseId,
          lessonKey,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setLines((prev) => [
          ...prev,
          ...(data.stdout ? [{ type: "stdout" as const, text: data.stdout }] : []),
          ...(data.stderr ? [{ type: "stderr" as const, text: data.stderr }] : []),
        ]);
        setPassed(data.passed);
        if (data.xpAwarded) setXpAwarded(data.xpAwarded);
        if (data.badgeUnlocked) setBadgeUnlocked(true);
      } else {
        setError(data.error || "Erro ao executar o comando.");
      }
    } catch {
      setError("Erro de comunicação com o motor de execução (Piston).");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden no-3d-effect">
      <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900/40 space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <TerminalSquare className="h-3.5 w-3.5" /> Laboratório de Terminal
        </span>
        {instructions && <p className="text-xs text-slate-300">{instructions}</p>}
      </div>

      {steps.length > 0 && (
        <div className="px-4 py-2.5 border-b border-slate-800 flex flex-wrap gap-2">
          {steps.map((s) => (
            <span
              key={s.id}
              className={`text-[10px] font-mono px-2 py-1 rounded-full border flex items-center gap-1.5 ${
                doneStepIds.has(s.id)
                  ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/10"
                  : "text-slate-500 bg-slate-900/40 border-slate-800"
              }`}
            >
              {doneStepIds.has(s.id) ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
              {s.description}
            </span>
          ))}
        </div>
      )}

      <div ref={scrollRef} className="h-56 overflow-y-auto p-3 font-mono text-xs space-y-1 bg-black/60">
        {lines.length === 0 && <span className="text-slate-600">$ Escreva um comando abaixo e prima Enter...</span>}
        {lines.map((line, i) => {
          if (line.type === "input") {
            return (
              <div key={i} className="text-emerald-400">
                <span className="text-slate-500">$ </span>
                {line.text}
              </div>
            );
          }
          return (
            <pre key={i} className={`whitespace-pre-wrap ${line.type === "stderr" ? "text-rose-400" : "text-slate-300"}`}>
              {line.text}
            </pre>
          );
        })}
        {passed !== undefined && (
          <div className={`font-bold ${passed ? "text-emerald-400" : "text-amber-400"}`}>
            {passed ? "✓ Objetivo alcançado!" : "Ainda não chegou ao resultado esperado — continue."}
          </div>
        )}
        {!!xpAwarded && (
          <div className="text-amber-400 font-bold">
            +{xpAwarded} XP{badgeUnlocked ? " · Distintivo \"Code Runner\" desbloqueado!" : ""}
          </div>
        )}
        {error && <div className="text-rose-400">{error}</div>}
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-800">
        <span className="text-emerald-400 font-mono text-xs">$</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRunCommand()}
          disabled={running}
          className="flex-1 bg-transparent border-none outline-none text-xs font-mono text-white placeholder:text-slate-700"
          placeholder="ls -la"
          autoComplete="off"
          spellCheck={false}
        />
        {running && <Loader2 className="h-3.5 w-3.5 text-slate-500 animate-spin" />}
      </div>
    </div>
  );
}
