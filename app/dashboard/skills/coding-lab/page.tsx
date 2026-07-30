"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Loader2, History, CheckCircle2, XCircle, Sparkles, Code2, KeyRound } from "lucide-react";
import Link from "next/link";
import { CodeLabBlockView } from "@/components/lesson-blocks/CodeLabBlockView";
import { useToast } from "@/components/ui/toast-provider";

interface AttemptHistoryItem {
  _id: string;
  passed: boolean | null;
  timestamp: string;
}

interface Exercise {
  title: string;
  instructions: string;
  starterCode: string;
  testCases: { label: string; stdin: string; expectedOutput: string }[];
}

const EXERCISES: Record<string, Exercise> = {
  python: {
    title: "Soma de Dois Números (via stdin)",
    instructions: "Lê duas linhas da entrada padrão (dois números inteiros) e imprime a soma.",
    starterCode: `a = int(input())\nb = int(input())\n# Escreva o seu código aqui\nprint(a + b)`,
    testCases: [
      { label: "10 + 5", stdin: "10\n5", expectedOutput: "15" },
      { label: "0 + 0", stdin: "0\n0", expectedOutput: "0" },
      { label: "Negativos: -3 + -7", stdin: "-3\n-7", expectedOutput: "-10" },
    ],
  },
  javascript: {
    title: "Soma de Dois Números (via stdin)",
    instructions: "Lê duas linhas da entrada padrão (dois números inteiros) e imprime a soma.",
    starterCode: `const lines = require('fs').readFileSync('/dev/stdin', 'utf8').split('\\n');\nconst a = parseInt(lines[0]);\nconst b = parseInt(lines[1]);\n// Escreva o seu código aqui\nconsole.log(a + b);`,
    testCases: [
      { label: "10 + 5", stdin: "10\n5", expectedOutput: "15" },
      { label: "0 + 0", stdin: "0\n0", expectedOutput: "0" },
      { label: "Negativos: -3 + -7", stdin: "-3\n-7", expectedOutput: "-10" },
    ],
  },
  typescript: {
    title: "Soma de Dois Números (via stdin)",
    instructions: "Lê duas linhas da entrada padrão (dois números inteiros) e imprime a soma.",
    starterCode: `const lines = require('fs').readFileSync('/dev/stdin', 'utf8').split('\\n');\nconst a: number = parseInt(lines[0]);\nconst b: number = parseInt(lines[1]);\n// Escreva o seu código aqui\nconsole.log(a + b);`,
    testCases: [
      { label: "10 + 5", stdin: "10\n5", expectedOutput: "15" },
      { label: "0 + 0", stdin: "0\n0", expectedOutput: "0" },
      { label: "Negativos: -3 + -7", stdin: "-3\n-7", expectedOutput: "-10" },
    ],
  },
};

interface CodeReview {
  overallQuality: string;
  issues: { severity: string; description: string }[];
  suggestions: string[];
}

export default function CodingLabPage() {
  const { showToast } = useToast();
  const [language, setLanguage] = useState("python");
  const [runtimes, setRuntimes] = useState<{ language: string; aliases: string[] }[]>([]);
  const [loadingRuntimes, setLoadingRuntimes] = useState(true);
  const [history, setHistory] = useState<AttemptHistoryItem[]>([]);
  const [currentCode, setCurrentCode] = useState("");

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
    setCurrentCode(EXERCISES[language]?.starterCode || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId]);

  const exercise = EXERCISES[language] || EXERCISES.python;
  const availableLanguages = Object.keys(EXERCISES).filter(
    (lang) => runtimes.length === 0 || runtimes.some((r) => r.language === lang || r.aliases.includes(lang))
  );

  // --- Revisão de Código (IA) ---
  const [reviewLoading, setReviewLoading] = useState(false);
  const [review, setReview] = useState<CodeReview | null>(null);

  const handleReview = async () => {
    setReviewLoading(true);
    setReview(null);
    try {
      const res = await fetch("/api/coding-lab/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: currentCode, language }),
      });
      const data = await res.json();
      if (res.ok) {
        setReview(data.review);
      } else {
        showToast(data.error || "Erro ao rever o código.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao rever o código.", "error");
    } finally {
      setReviewLoading(false);
    }
  };

  // --- GitHub (Gist real) ---
  const [githubConfigured, setGithubConfigured] = useState<boolean | null>(null);
  const [githubTokenInput, setGithubTokenInput] = useState("");
  const [savingToken, setSavingToken] = useState(false);
  const [creatingGist, setCreatingGist] = useState(false);
  const [gistUrl, setGistUrl] = useState<string | null>(null);

  const loadGithubStatus = async () => {
    try {
      const res = await fetch("/api/coding-lab/github/token");
      if (res.ok) {
        const data = await res.json();
        setGithubConfigured(data.configured);
      }
    } catch {
      setGithubConfigured(false);
    }
  };

  useEffect(() => {
    loadGithubStatus();
  }, []);

  const handleSaveToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubTokenInput.trim()) return;
    setSavingToken(true);
    try {
      const res = await fetch("/api/coding-lab/github/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: githubTokenInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Token do GitHub guardado com segurança.", "success");
        setGithubTokenInput("");
        setGithubConfigured(true);
      } else {
        showToast(data.error || "Erro ao guardar o token.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao guardar o token.", "error");
    } finally {
      setSavingToken(false);
    }
  };

  const handleCreateGist = async () => {
    setCreatingGist(true);
    setGistUrl(null);
    try {
      const ext = language === "python" ? "py" : language === "typescript" ? "ts" : "js";
      const res = await fetch("/api/coding-lab/github/gist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: `coding-lab-${language}.${ext}`,
          code: currentCode,
          description: `MOZAI Coding Lab — ${exercise.title}`,
          isPublic: false,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGistUrl(data.gistUrl);
        showToast("Gist criado no GitHub!", "success");
      } else {
        showToast(data.error || "Erro ao criar o Gist.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao criar o Gist.", "error");
    } finally {
      setCreatingGist(false);
    }
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
            <span className="text-[10px] text-slate-500">Execução real e isolada (Piston/Docker) &bull; Testes automáticos &bull; Code Review por IA &bull; GitHub</span>
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
            <h2 className="text-xl font-bold text-white">{exercise.title}</h2>
          </div>

          <div className="space-y-4 text-xs text-slate-400 leading-relaxed">
            <p>{exercise.instructions}</p>
            <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-900 space-y-2">
              <h4 className="font-bold text-white text-[11px] flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Suite de Testes ({exercise.testCases.length})
              </h4>
              {exercise.testCases.map((tc, i) => (
                <pre key={i} className="font-mono text-[10px] text-slate-400 bg-slate-950 p-2.5 rounded-lg">
{`${tc.label}
Entrada: ${tc.stdin.replace("\n", ", ")} → Esperado: ${tc.expectedOutput}`}
                </pre>
              ))}
            </div>
            <p className="text-[10px] text-slate-600">
              O código corre isolado via Piston (que executa cada submissão dentro do seu próprio
              container Docker) — não no nosso servidor.
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

          {/* GitHub */}
          <div className="space-y-2 pt-2 border-t border-slate-900">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Code2 className="h-3.5 w-3.5" /> GitHub
            </span>
            {githubConfigured === null ? (
              <Loader2 className="h-3.5 w-3.5 text-slate-600 animate-spin" />
            ) : githubConfigured ? (
              <div className="space-y-2">
                <button
                  onClick={handleCreateGist}
                  disabled={creatingGist}
                  className="w-full h-8 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-[11px] font-semibold text-indigo-400 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-55"
                >
                  {creatingGist ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Code2 className="h-3.5 w-3.5" />}
                  Criar Gist com este código
                </button>
                {gistUrl && (
                  <a href={gistUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-emerald-400 underline block">
                    {gistUrl}
                  </a>
                )}
              </div>
            ) : (
              <form onSubmit={handleSaveToken} className="space-y-1.5">
                <span className="text-[10px] text-slate-600">Ligue a sua conta GitHub para exportar código como Gist real.</span>
                <div className="flex gap-1.5">
                  <input
                    type="password"
                    value={githubTokenInput}
                    onChange={(e) => setGithubTokenInput(e.target.value)}
                    placeholder="Personal Access Token (ghp_...)"
                    className="flex-1 h-8 px-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-[10px] focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={savingToken}
                    className="h-8 w-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center cursor-pointer disabled:opacity-55 shrink-0"
                  >
                    {savingToken ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right side: Editor executável */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          <CodeLabBlockView
            key={language}
            language={language}
            starterCode={exercise.starterCode}
            testCases={exercise.testCases}
            instructions="Complete a função e execute para correr a suite de testes."
            exerciseId={exerciseId}
            onRunComplete={loadHistory}
            onCodeChange={setCurrentCode}
          />

          {/* Code Review IA */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" /> Code Review (IA)
              </span>
              <button
                onClick={handleReview}
                disabled={reviewLoading}
                className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              >
                {reviewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Rever Código (1 Crédito IA)
              </button>
            </div>
            {review && (
              <div className="p-4 space-y-3">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-block uppercase ${
                    review.overallQuality === "excelente" || review.overallQuality === "boa"
                      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                      : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                  }`}
                >
                  Qualidade: {review.overallQuality}
                </span>
                {review.issues.length > 0 && (
                  <div className="space-y-1.5">
                    {review.issues.map((issue, i) => (
                      <div key={i} className="text-xs text-slate-300 flex items-start gap-2">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${
                            issue.severity === "crítico" ? "bg-rose-500/20 text-rose-400" : issue.severity === "aviso" ? "bg-amber-500/20 text-amber-400" : "bg-slate-700 text-slate-300"
                          }`}
                        >
                          {issue.severity}
                        </span>
                        {issue.description}
                      </div>
                    ))}
                  </div>
                )}
                {review.suggestions.length > 0 && (
                  <ul className="text-xs text-slate-400 list-disc list-inside space-y-1">
                    {review.suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
