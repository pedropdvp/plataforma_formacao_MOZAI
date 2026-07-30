"use client";

import React, { useEffect, useState } from "react";
import { MessageSquareText, Loader2, CheckCircle2, Send, Trash2, Info } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";

interface DiscordStatus {
  configured: boolean;
  maskedUrl: string | null;
}

export default function DiscordAdminPage() {
  const { showToast } = useToast();
  const [status, setStatus] = useState<DiscordStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/discord");
      const data = await res.json();
      if (res.ok) setStatus(data);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/discord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: webhookUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Webhook do Discord guardado.", "success");
        setWebhookUrl("");
        loadStatus();
      } else {
        showToast(data.error || "Erro ao guardar o webhook.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao guardar o webhook.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/discord/test", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast("Mensagem de teste enviada! Verifique o seu canal do Discord.", "success");
      } else {
        showToast(data.error || "Erro ao enviar a mensagem de teste.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao testar o webhook.", "error");
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = async () => {
    try {
      const res = await fetch("/api/admin/discord", { method: "DELETE" });
      if (res.ok) {
        showToast("Ligação ao Discord removida.", "success");
        loadStatus();
      }
    } catch {
      showToast("Erro ao remover a ligação.", "error");
    }
  };

  return (
    <div className="space-y-8 workspace-page-container">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <MessageSquareText className="h-6 w-6 text-indigo-400" />
          Discord
        </h1>
        <p className="text-sm text-slate-400">
          Ligue um Webhook do Discord para receber notificações reais de atividade da Comunidade no seu servidor.
        </p>
      </div>

      <div className="border border-slate-900 bg-slate-950/40 rounded-2xl p-4 flex items-start gap-2.5">
        <Info className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-400 leading-relaxed">
          No seu servidor de Discord: Definições do Canal → Integrações → Webhooks → Novo Webhook →
          Copiar URL do Webhook. Cole esse URL abaixo. A MOZAI publicará mensagens reais nesse canal
          (ex: novas publicações na Comunidade) — nunca faz nada além de enviar mensagens.
        </p>
      </div>

      <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4 max-w-xl">
        {loading ? (
          <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
        ) : status?.configured ? (
          <div className="space-y-3">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Webhook configurado</span>
            <span className="text-[11px] text-slate-500 font-mono block">{status.maskedUrl}</span>
            <div className="flex gap-2">
              <button onClick={handleTest} disabled={testing} className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-55">
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar Mensagem de Teste
              </button>
              <button onClick={handleRemove} className="h-9 px-4 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-xs font-semibold text-rose-400 flex items-center gap-2 cursor-pointer">
                <Trash2 className="h-4 w-4" /> Remover
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-3">
            <input
              type="password"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
            />
            <button type="submit" disabled={saving} className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-55">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ligar Discord"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
