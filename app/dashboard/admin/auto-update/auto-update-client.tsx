"use client";

import React, { useEffect, useState } from "react";
import { RefreshCw, Loader2, Sparkles, CheckCircle2, ExternalLink, Send } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { AUTO_UPDATE_SOURCES } from "@/lib/auto-update-sources";

interface FeedItem {
  id: string;
  sourceLabel: string;
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  status: "pending" | "draft_pending_review" | "published";
  draftContent: string | null;
}

export default function AutoUpdatePage() {
  const { showToast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const loadFeed = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auto-update/feed");
      const data = await res.json();
      if (res.ok) setItems(data.items || []);
    } catch {
      showToast("Erro ao carregar o feed.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/admin/auto-update/scan", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast(`Scan real concluído: ${data.newItemsCount} itens novos.`, "success");
        if (data.errors?.length) showToast(`Falhas: ${data.errors.join("; ")}`, "error");
        loadFeed();
      } else {
        showToast(data.error || "Erro ao fazer scan.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao fazer scan.", "error");
    } finally {
      setScanning(false);
    }
  };

  const handleGenerate = async (item: FeedItem) => {
    setGeneratingId(item.id);
    try {
      const res = await fetch(`/api/admin/auto-update/${item.id}/generate`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast("Rascunho gerado — reveja antes de publicar.", "success");
        loadFeed();
      } else {
        showToast(data.error || "Erro ao gerar rascunho.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao gerar rascunho.", "error");
    } finally {
      setGeneratingId(null);
    }
  };

  const handlePublish = async (item: FeedItem) => {
    setPublishingId(item.id);
    try {
      const res = await fetch(`/api/admin/auto-update/${item.id}/publish`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast("Publicado!", "success");
        loadFeed();
      } else {
        showToast(data.error || "Erro ao publicar.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao publicar.", "error");
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <div className="space-y-8 workspace-page-container">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-indigo-400" />
            Atualização Automática
          </h1>
          <p className="text-sm text-slate-400">Monitorização real de GitHub Releases e arXiv — scan diário automático (cron) + botão manual.</p>
        </div>
        <button onClick={handleScan} disabled={scanning} className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-55">
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {scanning ? "A verificar fontes reais..." : "Verificar Agora"}
        </button>
      </div>

      <div className="border border-slate-900 bg-slate-950/40 rounded-2xl p-4 space-y-1.5">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fontes monitorizadas (APIs públicas reais)</span>
        {AUTO_UPDATE_SOURCES.map((s) => (
          <div key={s.id} className="text-[11px] text-slate-400">{s.label}</div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 text-indigo-500 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-12 text-center">
          <span className="text-sm text-slate-500 italic">Ainda sem itens — clique "Verificar Agora" para o primeiro scan real.</span>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">{item.sourceLabel}</span>
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                    item.status === "published"
                      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                      : item.status === "draft_pending_review"
                        ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                        : "text-slate-400 bg-slate-500/10 border-slate-500/20"
                  }`}
                >
                  {item.status === "published" ? "Publicado" : item.status === "draft_pending_review" ? "Rascunho — aguarda revisão" : "Detetado"}
                </span>
              </div>
              <h3 className="text-sm font-bold text-white">{item.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{item.description}</p>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-400 underline flex items-center gap-1 w-fit">
                Fonte original <ExternalLink className="h-3 w-3" />
              </a>

              {item.draftContent && (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-900 mt-2">
                  <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{item.draftContent}</p>
                </div>
              )}

              {item.status === "pending" && (
                <button onClick={() => handleGenerate(item)} disabled={generatingId === item.id} className="h-8 px-3 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-[11px] font-semibold text-indigo-400 flex items-center gap-1.5 cursor-pointer disabled:opacity-55">
                  {generatingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Gerar Rascunho (1 Crédito IA)
                </button>
              )}
              {item.status === "draft_pending_review" && (
                <button onClick={() => handlePublish(item)} disabled={publishingId === item.id} className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[11px] font-semibold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-55">
                  {publishingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Aprovar e Publicar
                </button>
              )}
              {item.status === "published" && (
                <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Publicado</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
