"use client";

import React, { useState, useEffect, useRef } from "react";
import { Bot, Loader2, ShieldAlert, Upload, Trash2, CheckCircle2, XCircle, FileText, BarChart3 } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useAccess } from "@/hooks/use-access";

interface DocStatus {
  tenantId: string;
  configured: boolean;
  fileName: string | null;
  sizeBytes: number | null;
  chunksCount: number | null;
  uploadedAt: string | null;
}

interface CompanyDocStatus extends DocStatus {
  name: string;
}

interface TenantStats {
  conversations: number;
  messages: number;
  userMessages: number;
  assistantMessages: number;
  totalTokens: number;
  conversations7d: number;
  estimatedCostEur: number;
  perDay: { day: string; messages: number }[];
  byLang: { lang: string; count: number }[];
  cacheHits: number;
  topQuestions: { question: string; hits: number; lang: string }[];
  ragChunks: number;
}

interface CompanyStats extends TenantStats {
  tenantId: string;
  name: string;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ChatbotPage() {
  const { showToast } = useToast();
  const confirmDialog = useConfirm();
  const { activeRole, isLoading: loadingRole } = useAccess();
  const isAdmin = activeRole === "ADMIN" || activeRole === "SUPORTE";
  const isCompanyManager = activeRole === "GESTOR_EMPRESA";
  const canAccess = isAdmin || isCompanyManager;

  const [own, setOwn] = useState<DocStatus | null>(null);
  const [companies, setCompanies] = useState<CompanyDocStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [ownStats, setOwnStats] = useState<TenantStats | null>(null);
  const [companyStats, setCompanyStats] = useState<CompanyStats[]>([]);
  /** Preço por milhão de tokens usado nas estimativas, vindo do servidor. */
  const [pricePerMTok, setPricePerMTok] = useState(0.28);

  /** Sugestões da conversa vazia, por idioma. Editadas como texto (uma por linha), que é
   *  mais rápido de rever do que uma lista de campos. */
  const [suggestions, setSuggestions] = useState<Record<string, string>>({ pt: "", en: "", fr: "" });
  const [savingSuggestions, setSavingSuggestions] = useState(false);
  const [suggestionsMsg, setSuggestionsMsg] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/chatbot");
      if (res.ok) {
        const data = await res.json();
        setOwn(data.own || null);
        setCompanies(data.companies || []);
      }
    } catch (err) {
      console.error("Erro ao ler o estado do ChatBot:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch("/api/admin/chatbot/stats");
      if (res.ok) {
        const data = await res.json();
        setOwnStats(data.own || null);
        setCompanyStats(data.companies || []);
        if (typeof data.pricePerMTokEur === "number") setPricePerMTok(data.pricePerMTokEur);
      }
    } catch (err) {
      console.error("Erro ao ler as estatísticas do ChatBot:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  /** Lê as sugestões dos três idiomas para o editor. */
  const fetchSuggestions = async () => {
    const langs = ["pt", "en", "fr"] as const;
    try {
      const resultados = await Promise.all(
        langs.map((lang) =>
          fetch(`/api/chatbot/suggestions?lang=${lang}`)
            .then((res) => (res.ok ? res.json() : null))
            .catch(() => null)
        )
      );
      const proximo: Record<string, string> = {};
      langs.forEach((lang, i) => {
        proximo[lang] = (resultados[i]?.suggestions || []).join("\n");
      });
      setSuggestions(proximo);
    } catch (err) {
      console.error("Erro ao ler as sugestões do ChatBot:", err);
    }
  };

  const saveSuggestions = async () => {
    setSavingSuggestions(true);
    setSuggestionsMsg(null);
    try {
      const payload: Record<string, string[]> = {};
      for (const [lang, texto] of Object.entries(suggestions)) {
        payload[lang] = texto
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
      }
      const res = await fetch("/api/chatbot/suggestions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestions: payload }),
      });
      setSuggestionsMsg(res.ok ? "Sugestões guardadas." : "Erro ao guardar as sugestões.");
      if (res.ok) await fetchSuggestions();
    } catch {
      setSuggestionsMsg("Erro de comunicação ao guardar.");
    } finally {
      setSavingSuggestions(false);
    }
  };

  useEffect(() => {
    if (canAccess) {
      fetchStatus();
      fetchSuggestions();
      fetchStats();
    }
  }, [canAccess]);

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      showToast("Só são aceites ficheiros PDF.", "error");
      return;
    }

    setUploading(true);
    try {
      const { upload } = await import("@vercel/blob/client");
      const blob = await upload(file.name, file, {
        access: "private",
        handleUploadUrl: "/api/admin/courses/generate/upload-token",
      });

      const res = await fetch("/api/admin/chatbot/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blobUrl: blob.url, filename: file.name, size: file.size }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`PDF "${file.name}" processado com sucesso (${data.chunksCount} fragmentos indexados).`, "success");
        await fetchStatus();
      } else {
        showToast(data.error || "Erro ao processar o PDF.", "error", 8000);
      }
    } catch (err: any) {
      showToast(`Erro ao carregar o ficheiro: ${err?.message || err}`, "error", 8000);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    const confirmed = await confirmDialog({
      title: "Remover Base de Conhecimento",
      message: isAdmin
        ? "Isto vai remover o PDF da plataforma. O ChatBot deixa de responder com base nesse conteúdo até ser carregado outro ficheiro."
        : "Isto vai remover o PDF da sua empresa. O ChatBot deixa de responder com base nesse conteúdo até ser carregado outro ficheiro.",
      confirmLabel: "Remover",
      destructive: true,
    });
    if (!confirmed) return;

    setRemoving(true);
    try {
      const res = await fetch("/api/admin/chatbot", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        showToast("Base de conhecimento removida.", "success");
        await fetchStatus();
      } else {
        showToast(data.error || "Erro ao remover.", "error");
      }
    } catch (err) {
      showToast("Erro de comunicação ao remover.", "error");
    } finally {
      setRemoving(false);
    }
  };

  if (loadingRole) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        <span className="text-sm font-semibold">A verificar permissões...</span>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center text-center space-y-4 px-6">
        <div className="p-4 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-white">Acesso Restrito</h1>
        <p className="text-sm text-slate-400 max-w-[420px]">
          Só administradores globais (ADMIN ou SUPORTE) ou Gestores de Empresa podem gerir o ChatBot.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl report-page-container">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2.5">
          <Bot className="h-6 w-6 text-orange-400" />
          ChatBot
        </h1>
        <p className="text-sm text-slate-400">
          {isAdmin
            ? "Carregue um PDF com o conhecimento que o ChatBot deve usar para responder às questões dos utilizadores em toda a plataforma."
            : "Carregue um PDF com conteúdo sobre a sua empresa — o ChatBot passará a responder também a questões sobre a sua empresa, além do conhecimento geral da plataforma."}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          <span className="text-xs font-semibold">A carregar...</span>
        </div>
      ) : (
        <>
          <div className="border border-slate-900 bg-slate-950/40 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-200">
              {isAdmin ? "Base de Conhecimento da Plataforma" : "Base de Conhecimento da Sua Empresa"}
            </h2>

            <div className="flex items-center gap-2.5">
              {own?.configured ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-450 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-rose-450 shrink-0" />
              )}
              <span className="text-xs text-slate-300">
                {own?.configured ? (
                  <>
                    <FileText className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />
                    {own.fileName}
                    <span className="text-slate-500">
                      {" "}
                      ({formatSize(own.sizeBytes)} · {own.chunksCount} fragmentos indexados)
                      {own.uploadedAt && ` · carregado em ${new Date(own.uploadedAt).toLocaleString("pt-PT")}`}
                    </span>
                  </>
                ) : (
                  "Nenhum PDF carregado ainda"
                )}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                hidden
                onChange={(e) => handleFileSelected(e.target.files?.[0])}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {own?.configured ? "Substituir PDF" : "Carregar PDF"}
              </button>
              {own?.configured && (
                <button
                  onClick={handleRemove}
                  disabled={removing}
                  className="h-10 px-4 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-xs font-bold text-rose-450 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Remover
                </button>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-200">Bases de Conhecimento por Empresa</h2>
              <p className="text-xs text-slate-500">
                Estado do PDF carregado por cada empresa (só visualização — cada Gestor de Empresa carrega o seu
                próprio PDF).
              </p>
              {companies.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4">Nenhuma empresa registada ainda.</p>
              ) : (
                <div className="space-y-2.5">
                  {companies.map((c) => (
                    <div
                      key={c.tenantId}
                      className="border border-slate-900 bg-slate-950/40 rounded-2xl p-4 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        {c.configured ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-450 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-rose-450 shrink-0" />
                        )}
                        <span className="text-xs font-bold text-slate-200">{c.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {c.configured ? `${c.fileName} · ${c.chunksCount} fragmentos` : "não configurado"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-orange-400" />
              Utilização &amp; Custos {isAdmin ? "(Plataforma)" : "(Sua Empresa)"}
            </h2>
            {loadingStats ? (
              <div className="flex items-center justify-center py-8 text-slate-500 gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">A carregar estatísticas...</span>
              </div>
            ) : ownStats ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <StatCard label="Conversas" value={ownStats.conversations} />
                  <StatCard label="Mensagens" value={ownStats.messages} />
                  <StatCard label="Tokens Usados" value={ownStats.totalTokens.toLocaleString("pt-PT")} />
                  <StatCard label="Custo Estimado" value={`${ownStats.estimatedCostEur.toFixed(2)} €`} />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <StatCard label="Conversas (7 dias)" value={ownStats.conversations7d} />
                  <StatCard label="Respostas da Cache" value={ownStats.cacheHits} />
                  <StatCard label="Blocos de Conhecimento" value={ownStats.ragChunks} />
                  <StatCard
                    label="Poupança da Cache"
                    value={`${(((ownStats.cacheHits * (ownStats.assistantMessages ? ownStats.totalTokens / ownStats.assistantMessages : 0)) / 1_000_000) * pricePerMTok).toFixed(2)} €`}
                  />
                </div>

                {ownStats.byLang.length > 1 && (
                  <div className="border border-slate-900 bg-slate-950/40 rounded-2xl p-4 space-y-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Conversas por idioma
                    </h3>
                    <div className="space-y-1.5">
                      {ownStats.byLang.map((l) => {
                        const max = Math.max(...ownStats.byLang.map((x) => x.count), 1);
                        return (
                          <div key={l.lang} className="flex items-center gap-2.5">
                            <span className="text-[10px] text-slate-500 w-16 shrink-0 uppercase">{l.lang}</span>
                            <div className="flex-1 h-2 rounded-full bg-slate-900 overflow-hidden">
                              <div className="h-full bg-emerald-500/60 rounded-full" style={{ width: `${(l.count / max) * 100}%` }} />
                            </div>
                            <span className="text-[10px] text-slate-400 w-6 text-right shrink-0">{l.count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {ownStats.topQuestions.length > 0 && (
                  <div className="border border-slate-900 bg-slate-950/40 rounded-2xl p-4 space-y-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Perguntas mais frequentes
                    </h3>
                    <p className="text-[10px] text-slate-500">
                      Perguntas já respondidas que voltaram a ser feitas. Cada repetição foi servida
                      da cache, sem custo — e diz-lhe o que vale a pena esclarecer no material.
                    </p>
                    <div className="space-y-1">
                      {ownStats.topQuestions.map((q) => (
                        <div key={`${q.lang}-${q.question}`} className="flex items-center gap-2.5 text-[11px]">
                          <span className="text-[9px] text-slate-600 uppercase w-6 shrink-0">{q.lang}</span>
                          <span className="flex-1 text-slate-300 truncate" title={q.question}>
                            {q.question}
                          </span>
                          <span className="text-amber-400 font-semibold shrink-0">{q.hits}×</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {ownStats.perDay.length > 0 && (
                  <div className="border border-slate-900 bg-slate-950/40 rounded-2xl p-4 space-y-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Mensagens por dia (últimos 14 dias)
                    </h3>
                    <div className="space-y-1.5">
                      {ownStats.perDay.map((d) => {
                        const max = Math.max(...ownStats.perDay.map((x) => x.messages), 1);
                        return (
                          <div key={d.day} className="flex items-center gap-2.5">
                            <span className="text-[10px] text-slate-500 w-16 shrink-0">{d.day.slice(5)}</span>
                            <div className="flex-1 h-2 rounded-full bg-slate-900 overflow-hidden">
                              <div
                                className="h-full bg-indigo-500/60 rounded-full"
                                style={{ width: `${(d.messages / max) * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-400 w-6 text-right shrink-0">{d.messages}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500 italic py-4">Ainda não há dados de utilização.</p>
            )}

            <SuggestionsEditor
              value={suggestions}
              onChange={(lang, text) => setSuggestions((prev) => ({ ...prev, [lang]: text }))}
              onSave={saveSuggestions}
              saving={savingSuggestions}
              message={suggestionsMsg}
            />

            {isAdmin && companyStats.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Por Empresa</h3>
                {companyStats.map((c) => (
                  <div
                    key={c.tenantId}
                    className="border border-slate-900 bg-slate-950/40 rounded-2xl p-4 flex items-center justify-between gap-3"
                  >
                    <span className="text-xs font-bold text-slate-200">{c.name}</span>
                    <span className="text-[10px] text-slate-500">
                      {c.conversations} conversas · {c.messages} mensagens · {c.totalTokens.toLocaleString("pt-PT")} tokens ·{" "}
                      {c.estimatedCostEur.toFixed(2)} €
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SuggestionsEditor({
  value,
  onChange,
  onSave,
  saving,
  message,
}: {
  value: Record<string, string>;
  onChange: (lang: string, text: string) => void;
  onSave: () => void;
  saving: boolean;
  message: string | null;
}) {
  const LABELS: Record<string, string> = { pt: "Português", en: "English", fr: "Français" };
  return (
    <div className="border border-slate-900 bg-slate-950/40 rounded-2xl p-4 space-y-3">
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Perguntas sugeridas do assistente
        </h3>
        <p className="text-[10px] text-slate-500 mt-1">
          Aparecem quando a conversa está vazia. Uma por linha, no máximo seis por idioma.
          Deixar em branco repõe as de origem.
        </p>
      </div>
      <div className="grid sm:grid-cols-3 gap-2.5">
        {(["pt", "en", "fr"] as const).map((lang) => (
          <div key={lang} className="space-y-1">
            <label htmlFor={`sug-${lang}`} className="text-[10px] font-semibold text-slate-400">
              {LABELS[lang]}
            </label>
            <textarea
              id={`sug-${lang}`}
              value={value[lang] || ""}
              onChange={(e) => onChange(lang, e.target.value)}
              rows={5}
              className="w-full px-2.5 py-2 rounded-xl border border-slate-800 bg-slate-950 text-white text-[11px] focus:border-indigo-500 focus:outline-none resize-none"
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={saving}
          className="h-8 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-[11px] font-semibold text-white cursor-pointer disabled:opacity-55"
        >
          {saving ? "A guardar..." : "Guardar sugestões"}
        </button>
        {message && <span className="text-[10px] text-slate-400">{message}</span>}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-slate-900 bg-slate-950/40 rounded-2xl p-3.5">
      <span className="block text-lg font-extrabold text-white">{value}</span>
      <span className="block text-[10px] text-slate-500 mt-0.5">{label}</span>
    </div>
  );
}
