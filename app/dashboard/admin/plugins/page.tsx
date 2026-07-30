"use client";

import React, { useState, useEffect } from "react";
import { Puzzle, Loader2, ShieldAlert, Zap, Trash2, PlayCircle, CheckCircle2, XCircle } from "lucide-react";
import { useAccess } from "@/hooks/use-access";
import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";

const REVIEWER_ROLES = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA"];

interface PluginEventDef {
  id: string;
  label: string;
  description: string;
}

interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  events: PluginEventDef[];
}

interface InstalledPlugin {
  _id: string;
  pluginId: string;
  pluginName: string;
  webhookUrl: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt: string | null;
  lastError: string | null;
}

export default function PluginsPage() {
  const { activeRole, isLoading: loadingRole } = useAccess();
  const { showToast } = useToast();
  const confirmDialog = useConfirm();
  const canAccess = !!activeRole && REVIEWER_ROLES.includes(activeRole);

  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [events, setEvents] = useState<PluginEventDef[]>([]);
  const [installed, setInstalled] = useState<InstalledPlugin[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [configuringPluginId, setConfiguringPluginId] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [installing, setInstalling] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const res = await fetch("/api/admin/plugins");
      if (res.ok) {
        const data = await res.json();
        setCatalog(data.catalog || []);
        setEvents(data.events || []);
        setInstalled(data.installed || []);
      }
    } catch (error) {
      console.error("Erro ao carregar plugins:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canAccess) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  const toggleEvent = (eventId: string) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  const handleInstall = async (pluginId: string) => {
    if (!webhookUrl.trim() || selectedEvents.size === 0) {
      showToast("Indique o URL do webhook e escolha pelo menos um evento.", "error");
      return;
    }
    setInstalling(true);
    try {
      const res = await fetch("/api/admin/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pluginId, webhookUrl: webhookUrl.trim(), events: Array.from(selectedEvents) }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        setConfiguringPluginId(null);
        setWebhookUrl("");
        setSelectedEvents(new Set());
        loadData();
      } else {
        showToast(data.error || "Erro ao instalar o plugin.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao instalar o plugin.", "error");
    } finally {
      setInstalling(false);
    }
  };

  const handleToggleActive = async (plugin: InstalledPlugin) => {
    try {
      const res = await fetch(`/api/admin/plugins/${plugin._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !plugin.isActive }),
      });
      if (res.ok) {
        showToast(plugin.isActive ? "Plugin desativado." : "Plugin ativado.", "success");
        loadData();
      }
    } catch {
      showToast("Erro ao atualizar o plugin.", "error");
    }
  };

  const handleUninstall = async (plugin: InstalledPlugin) => {
    const confirmed = await confirmDialog({
      title: `Desinstalar "${plugin.pluginName}"`,
      message: "Isto para de disparar este plugin para os eventos escolhidos. Continuar?",
      confirmLabel: "Desinstalar",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/admin/plugins/${plugin._id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Plugin desinstalado.", "success");
        loadData();
      }
    } catch {
      showToast("Erro ao desinstalar o plugin.", "error");
    }
  };

  const handleTest = async (plugin: InstalledPlugin) => {
    setTestingId(plugin._id);
    try {
      const res = await fetch(`/api/admin/plugins/${plugin._id}/test`, { method: "POST" });
      const data = await res.json();
      showToast(data.message, data.success ? "success" : "error", 6000);
    } catch {
      showToast("Erro de comunicação ao testar o plugin.", "error");
    } finally {
      setTestingId(null);
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
          Só Administradores, Suporte ou o Gestor de Empresa podem gerir plugins.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <Puzzle className="h-7 w-7 text-indigo-400" />
          Plugins
        </h1>
        <p className="text-sm text-slate-400">
          Integrações reais via webhook — a MOZAI envia um POST HTTP real para o seu URL sempre que o evento escolhido acontecer. Não executa código de terceiros na plataforma.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          <span className="text-xs font-medium">A carregar...</span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Plugins instalados */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-white">Plugins Instalados</h3>
            {installed.length === 0 ? (
              <div className="border border-slate-900 border-dashed rounded-2xl p-8 text-center">
                <span className="text-xs text-slate-500">Ainda não instalou nenhum plugin.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {installed.map((plugin) => (
                  <div key={plugin._id} className="border border-slate-900 bg-slate-950/40 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-xs text-white">{plugin.pluginName}</h4>
                        <span className="text-[10px] text-slate-500 font-mono break-all">{plugin.webhookUrl}</span>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${plugin.isActive ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-slate-500 bg-slate-900 border-slate-800"}`}>
                        {plugin.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {plugin.events.map((eventId) => (
                        <span key={eventId} className="text-[9px] font-mono text-indigo-400 bg-indigo-500/5 border border-indigo-500/10 px-2 py-0.5 rounded-full">
                          {events.find((e) => e.id === eventId)?.label || eventId}
                        </span>
                      ))}
                    </div>
                    {plugin.lastError && (
                      <span className="text-[10px] text-rose-400 flex items-center gap-1"><XCircle className="h-3 w-3" /> Último erro: {plugin.lastError}</span>
                    )}
                    {plugin.lastTriggeredAt && !plugin.lastError && (
                      <span className="text-[10px] text-slate-500 flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-400" /> Último disparo: {new Date(plugin.lastTriggeredAt).toLocaleString("pt-PT")}</span>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleTest(plugin)}
                        disabled={testingId === plugin._id}
                        className="h-7 px-3 rounded-lg border border-slate-800 text-[10px] font-semibold text-slate-300 hover:bg-slate-900 cursor-pointer flex items-center gap-1.5 disabled:opacity-55"
                      >
                        {testingId === plugin._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3 w-3" />}
                        Testar
                      </button>
                      <button
                        onClick={() => handleToggleActive(plugin)}
                        className="h-7 px-3 rounded-lg border border-slate-800 text-[10px] font-semibold text-slate-300 hover:bg-slate-900 cursor-pointer"
                      >
                        {plugin.isActive ? "Desativar" : "Ativar"}
                      </button>
                      <button
                        onClick={() => handleUninstall(plugin)}
                        className="h-7 px-3 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-[10px] font-semibold text-rose-400 cursor-pointer flex items-center gap-1.5"
                      >
                        <Trash2 className="h-3 w-3" /> Desinstalar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Catálogo */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-white">Catálogo de Plugins</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {catalog.map((entry) => (
                <div key={entry.id} className="border border-slate-900 bg-slate-950/40 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                      <Zap className="h-4 w-4" />
                    </div>
                    <h4 className="font-bold text-xs text-white">{entry.name}</h4>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{entry.description}</p>

                  {configuringPluginId === entry.id ? (
                    <div className="space-y-2 pt-2 border-t border-slate-900">
                      <input
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        placeholder="https://hooks.slack.com/..."
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-[11px] focus:outline-none focus:border-indigo-500/50"
                      />
                      <div className="space-y-1">
                        {entry.events.map((ev) => (
                          <label key={ev.id} className="flex items-start gap-1.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={selectedEvents.has(ev.id)}
                              onChange={() => toggleEvent(ev.id)}
                              className="h-3.5 w-3.5 mt-0.5 accent-indigo-500"
                            />
                            <span className="text-[10px] text-slate-300">{ev.label}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfiguringPluginId(null)}
                          className="h-7 px-2.5 rounded-lg border border-slate-800 text-[10px] font-semibold text-slate-400 hover:bg-slate-900 cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleInstall(entry.id)}
                          disabled={installing}
                          className="flex-1 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[10px] font-semibold text-white cursor-pointer disabled:opacity-55"
                        >
                          {installing ? "A instalar..." : "Instalar"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setConfiguringPluginId(entry.id);
                        setWebhookUrl("");
                        setSelectedEvents(new Set());
                      }}
                      className="w-full h-8 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-[11px] font-semibold text-indigo-400 cursor-pointer"
                    >
                      Instalar / Configurar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
