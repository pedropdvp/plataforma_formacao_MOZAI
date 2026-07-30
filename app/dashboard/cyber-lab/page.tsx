"use client";

import React, { useEffect, useState } from "react";
import { ShieldAlert, Loader2, Search, Flag, Globe, CheckCircle2, XCircle, Sparkles, Trophy } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";

type Tab = "scanner" | "ctf" | "headers";

interface ScanFinding {
  ruleId: string;
  name: string;
  severity: "crítico" | "alto" | "médio" | "baixo";
  description: string;
  line: number;
  snippet: string;
}

interface AiReview {
  riskLevel: string;
  findings: { description: string; recommendation: string }[];
}

interface Challenge {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  points: number;
  prompt: string;
  solved: boolean;
}

const SEVERITY_COLOR: Record<string, string> = {
  "crítico": "text-rose-400 bg-rose-500/10 border-rose-500/20",
  alto: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  "médio": "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  baixo: "text-slate-400 bg-slate-500/10 border-slate-500/20",
};

export default function CyberLabPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("scanner");

  // --- Scanner ---
  const [scanCode, setScanCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [findings, setFindings] = useState<ScanFinding[] | null>(null);
  const [aiReview, setAiReview] = useState<AiReview | null>(null);

  const handleScan = async (includeAiReview: boolean) => {
    if (!scanCode.trim()) {
      showToast("Cole código para analisar.", "error");
      return;
    }
    setScanning(true);
    setFindings(null);
    setAiReview(null);
    try {
      const res = await fetch("/api/cyber-lab/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: scanCode, includeAiReview }),
      });
      const data = await res.json();
      if (res.ok) {
        setFindings(data.findings);
        setAiReview(data.aiReview);
      } else {
        showToast(data.error || "Erro ao analisar o código.", "error");
      }
    } catch {
      showToast("Erro de comunicação com o scanner.", "error");
    } finally {
      setScanning(false);
    }
  };

  // --- CTF ---
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(true);
  const [totalPoints, setTotalPoints] = useState(0);
  const [flagInputs, setFlagInputs] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const loadChallenges = async () => {
    setLoadingChallenges(true);
    try {
      const res = await fetch("/api/cyber-lab/ctf");
      if (res.ok) {
        const data = await res.json();
        setChallenges(data.challenges || []);
        setTotalPoints(data.totalPoints || 0);
      }
    } catch {
      showToast("Erro ao carregar os desafios CTF.", "error");
    } finally {
      setLoadingChallenges(false);
    }
  };

  useEffect(() => {
    if (tab === "ctf") loadChallenges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleSubmitFlag = async (challenge: Challenge) => {
    const flag = flagInputs[challenge.id];
    if (!flag?.trim()) return;
    setSubmittingId(challenge.id);
    try {
      const res = await fetch(`/api/cyber-lab/ctf/${challenge.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.correct) {
          showToast(data.alreadySolved ? "Já tinha resolvido este desafio." : `Correto! +${data.pointsAwarded} pontos`, "success");
          loadChallenges();
        } else {
          showToast("Flag incorreta. Tenta novamente.", "error");
        }
      } else {
        showToast(data.error || "Erro ao submeter a flag.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao submeter a flag.", "error");
    } finally {
      setSubmittingId(null);
    }
  };

  // --- HTTP Headers ---
  const [targetUrl, setTargetUrl] = useState("");
  const [checkingHeaders, setCheckingHeaders] = useState(false);
  const [headerResults, setHeaderResults] = useState<{ key: string; label: string; present: boolean; value: string | null }[] | null>(null);

  const handleCheckHeaders = async () => {
    if (!targetUrl.trim()) return;
    setCheckingHeaders(true);
    setHeaderResults(null);
    try {
      const res = await fetch("/api/cyber-lab/headers-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setHeaderResults(data.results);
      } else {
        showToast(data.error || "Erro ao verificar o URL.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao verificar os cabeçalhos.", "error");
    } finally {
      setCheckingHeaders(false);
    }
  };

  return (
    <div className="space-y-8 workspace-page-container">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-rose-400" />
          Cyber Lab
        </h1>
        <p className="text-sm text-slate-400">
          Scanner de vulnerabilidades, desafios CTF e verificação real de cabeçalhos de segurança HTTP — tudo autocontido e seguro, sem atacar infraestrutura de terceiros.
        </p>
      </div>

      <div className="flex gap-2 p-1 rounded-2xl bg-slate-900 border border-slate-800 w-fit">
        <button onClick={() => setTab("scanner")} className={`h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${tab === "scanner" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
          <Search className="h-3.5 w-3.5" /> Scanner de Código
        </button>
        <button onClick={() => setTab("ctf")} className={`h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${tab === "ctf" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
          <Flag className="h-3.5 w-3.5" /> Desafios CTF
        </button>
        <button onClick={() => setTab("headers")} className={`h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${tab === "headers" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
          <Globe className="h-3.5 w-3.5" /> Cabeçalhos HTTP
        </button>
      </div>

      {tab === "scanner" ? (
        <div className="space-y-4">
          <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-3">
            <textarea
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              placeholder="Cole aqui o código a analisar..."
              className="w-full h-48 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs font-mono focus:border-indigo-500 focus:outline-none resize-none"
            />
            <div className="flex gap-2">
              <button onClick={() => handleScan(false)} disabled={scanning} className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-55">
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Analisar (Padrões, Grátis)
              </button>
              <button onClick={() => handleScan(true)} disabled={scanning} className="h-9 px-4 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-xs font-semibold text-indigo-400 flex items-center gap-2 cursor-pointer disabled:opacity-55">
                <Sparkles className="h-4 w-4" /> + Revisão por IA (1 Crédito)
              </button>
            </div>
          </div>

          {findings && (
            <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-2">
              <h3 className="font-bold text-sm text-white">Padrões Detetados ({findings.length})</h3>
              {findings.length === 0 ? (
                <span className="text-xs text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Nenhum padrão de risco conhecido detetado.</span>
              ) : (
                findings.map((f, i) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-950/60 border border-slate-900 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{f.name}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${SEVERITY_COLOR[f.severity]}`}>{f.severity} · linha {f.line}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{f.description}</p>
                    <code className="text-[10px] text-slate-500 block">{f.snippet}</code>
                  </div>
                ))
              )}
            </div>
          )}

          {aiReview && (
            <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-2">
              <h3 className="font-bold text-sm text-white flex items-center gap-2"><Sparkles className="h-4 w-4 text-indigo-400" /> Revisão por IA — risco {aiReview.riskLevel}</h3>
              {aiReview.findings.map((f, i) => (
                <div key={i} className="text-xs text-slate-300 space-y-0.5">
                  <p><strong className="text-rose-400">Problema:</strong> {f.description}</p>
                  <p><strong className="text-emerald-400">Correção:</strong> {f.recommendation}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : tab === "ctf" ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-400">
            <Trophy className="h-4.5 w-4.5" /> {totalPoints} pontos CTF acumulados
          </div>
          {loadingChallenges ? (
            <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {challenges.map((c) => (
                <div key={c.id} className={`border rounded-2xl p-4 space-y-2 ${c.solved ? "border-emerald-500/20 bg-emerald-500/5" : "border-slate-900 bg-slate-950/60"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">{c.category} · {c.difficulty}</span>
                    <span className="text-[10px] font-bold text-amber-400">{c.points} pts</span>
                  </div>
                  <h4 className="font-bold text-xs text-white">{c.title}</h4>
                  <pre className="text-[11px] text-slate-400 whitespace-pre-wrap font-mono">{c.prompt}</pre>
                  {c.solved ? (
                    <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Resolvido</span>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={flagInputs[c.id] || ""}
                        onChange={(e) => setFlagInputs((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        placeholder="Submeter flag..."
                        className="flex-1 h-8 px-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-[11px] focus:border-indigo-500 focus:outline-none"
                      />
                      <button
                        onClick={() => handleSubmitFlag(c)}
                        disabled={submittingId === c.id}
                        className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[11px] font-semibold text-white cursor-pointer disabled:opacity-55"
                      >
                        {submittingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Submeter"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-3">
            <p className="text-[11px] text-slate-500">Verifica os cabeçalhos de segurança HTTP reais de um site público (equivalente a "curl -I") — apenas leitura, nunca envia payloads.</p>
            <div className="flex gap-2">
              <input
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://exemplo.com"
                className="flex-1 h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
              />
              <button onClick={handleCheckHeaders} disabled={checkingHeaders} className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-55">
                {checkingHeaders ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Verificar
              </button>
            </div>
          </div>

          {headerResults && (
            <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-2">
              {headerResults.map((h) => (
                <div key={h.key} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-900">
                  <span className="text-xs text-slate-300">{h.label}</span>
                  {h.present ? (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Presente</span>
                  ) : (
                    <span className="text-[10px] text-rose-400 flex items-center gap-1"><XCircle className="h-3.5 w-3.5" /> Ausente</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
