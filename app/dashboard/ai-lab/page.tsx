"use client";

import React, { useEffect, useState } from "react";
import { FlaskConical, Loader2, Send, CheckCircle2, XCircle, BookOpen, Info } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";

interface ProviderStatus {
  id: string;
  label: string;
  vendor: string;
  configured: boolean;
}

interface CompareResult {
  id: string;
  label: string;
  vendor: string;
  configured: boolean;
  text?: string;
  error?: string;
  latencyMs?: number;
}

interface Course {
  _id: string;
  title: string;
}

export default function AiLabPage() {
  const { showToast } = useToast();
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(new Set());

  const [prompt, setPrompt] = useState("");
  const [useRag, setUseRag] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");

  const [comparing, setComparing] = useState(false);
  const [results, setResults] = useState<CompareResult[] | null>(null);
  const [groundedInRag, setGroundedInRag] = useState(false);

  useEffect(() => {
    async function loadProviders() {
      try {
        const res = await fetch("/api/ai-lab/compare");
        const data = await res.json();
        if (res.ok) {
          setProviders(data.providers || []);
          setSelectedProviders(new Set((data.providers || []).filter((p: ProviderStatus) => p.configured).map((p: ProviderStatus) => p.id)));
        }
      } catch {
        showToast("Erro ao carregar os fornecedores de IA.", "error");
      } finally {
        setLoadingProviders(false);
      }
    }
    loadProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!useRag) return;
    async function loadCourses() {
      try {
        const res = await fetch("/api/catalog");
        const data = await res.json();
        if (res.ok) setCourses(data.courses || data || []);
      } catch {
        // silencioso — RAG é opcional
      }
    }
    loadCourses();
  }, [useRag]);

  const toggleProvider = (id: string) => {
    setSelectedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCompare = async () => {
    if (!prompt.trim()) {
      showToast("Escreva um prompt para comparar.", "error");
      return;
    }
    if (selectedProviders.size === 0) {
      showToast("Escolha pelo menos um fornecedor.", "error");
      return;
    }
    setComparing(true);
    setResults(null);
    try {
      const res = await fetch("/api/ai-lab/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          providerIds: Array.from(selectedProviders),
          useRag,
          courseId: useRag ? selectedCourseId : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResults(data.results);
        setGroundedInRag(data.groundedInRag);
      } else {
        showToast(data.error || "Erro ao comparar fornecedores.", "error");
      }
    } catch {
      showToast("Erro de comunicação com o AI Lab.", "error");
    } finally {
      setComparing(false);
    }
  };

  return (
    <div className="space-y-8 workspace-page-container">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-indigo-400" />
          AI Lab
        </h1>
        <p className="text-sm text-slate-400">
          Compare o mesmo prompt em vários fornecedores de IA reais, lado a lado, com grounding RAG opcional.
        </p>
      </div>

      <div className="border border-amber-500/20 bg-amber-500/5 rounded-2xl p-4 flex items-start gap-2.5">
        <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-200 leading-relaxed">
          <strong>Nota de âmbito:</strong> LangChain, CrewAI e AutoGen são frameworks nativos de
          Python e o MCP é um protocolo cliente-servidor — nenhum é compatível com esta stack
          Next.js/TypeScript sem introduzir uma tecnologia não autorizada. Em vez de fingir essa
          integração, este AI Lab implementa o que essas ferramentas oferecem de forma nativa e real
          nesta stack: múltiplos fornecedores de LLM reais (OpenAI, Claude, Gemini, DeepSeek, Llama),
          RAG real (reutilizado do motor do Tutor de IA) e orquestração multi-passo real (ver
          "Agentes IA" no AI Marketplace).
        </p>
      </div>

      <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
        <h3 className="font-bold text-sm text-white">Fornecedores</h3>
        {loadingProviders ? (
          <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
        ) : (
          <div className="grid sm:grid-cols-3 gap-3">
            {providers.map((p) => (
              <label
                key={p.id}
                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                  !p.configured
                    ? "border-slate-900 bg-slate-950/40 opacity-50 cursor-not-allowed"
                    : selectedProviders.has(p.id)
                      ? "border-indigo-500/40 bg-indigo-500/5"
                      : "border-slate-800 bg-slate-950 hover:bg-slate-900"
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!p.configured}
                  checked={selectedProviders.has(p.id)}
                  onChange={() => toggleProvider(p.id)}
                  className="h-4 w-4 accent-indigo-500"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white">{p.label}</div>
                  <div className="text-[10px] text-slate-500">{p.vendor}{!p.configured && " · não configurado"}</div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Escreva o prompt a comparar entre fornecedores..."
          className="w-full h-24 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none"
        />

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={useRag} onChange={(e) => setUseRag(e.target.checked)} className="h-4 w-4 accent-indigo-500" />
          <span className="text-xs text-slate-300 flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Fundamentar em RAG (conteúdo real de um curso)
          </span>
        </label>

        {useRag && (
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
          >
            <option value="">Escolha um curso...</option>
            {courses.map((c) => (
              <option key={c._id} value={c._id}>{c.title}</option>
            ))}
          </select>
        )}

        <button
          onClick={handleCompare}
          disabled={comparing}
          className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-55"
        >
          {comparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {comparing ? "A comparar..." : `Comparar (${selectedProviders.size} Créditos IA)`}
        </button>
      </div>

      {results && (
        <div className="space-y-3">
          {groundedInRag && (
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full inline-block">
              Respostas fundamentadas no conteúdo real do curso escolhido
            </span>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            {results.map((r) => (
              <div key={r.id} className="border border-slate-900 bg-slate-950/60 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{r.label}</span>
                  <span className="text-[10px] text-slate-500">{r.vendor}</span>
                </div>
                {r.error ? (
                  <div className="flex items-start gap-1.5 text-[11px] text-rose-400">
                    <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {r.error}
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{r.text}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> {r.latencyMs}ms
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
