"use client";

import React, { useState, useEffect } from "react";
import { Key, Loader2, ShieldAlert, Save, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useAccess } from "@/hooks/use-access";

interface TenantApiKeyStatus {
  tenantId: string;
  configured: boolean;
  maskedKey: string | null;
  updatedAt: string | null;
}

interface CompanyApiKeyStatus extends TenantApiKeyStatus {
  name: string;
}

export default function ApiKeysPage() {
  const { showToast } = useToast();
  const confirmDialog = useConfirm();
  const { activeRole, isLoading: loadingRole } = useAccess();
  const isAdmin = activeRole === "ADMIN";
  const isCompanyManager = activeRole === "GESTOR_EMPRESA";
  const canAccess = isAdmin || isCompanyManager;

  const [loading, setLoading] = useState(true);
  const [own, setOwn] = useState<TenantApiKeyStatus | null>(null);
  const [companies, setCompanies] = useState<CompanyApiKeyStatus[]>([]);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/api-keys");
      if (res.ok) {
        const data = await res.json();
        setOwn(data.own || null);
        setCompanies(data.companies || []);
      }
    } catch (err) {
      console.error("Erro ao ler o estado das chaves de API:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canAccess) fetchStatus();
  }, [canAccess]);

  const handleSave = async () => {
    if (!apiKeyInput.trim()) {
      showToast("Introduza uma chave de API válida.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKeyInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Chave de API guardada com sucesso.", "success");
        setApiKeyInput("");
        await fetchStatus();
      } else {
        showToast(data.error || "Erro ao guardar a chave de API.", "error");
      }
    } catch (err) {
      showToast("Erro de comunicação ao guardar a chave de API.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    const confirmed = await confirmDialog({
      title: "Remover Chave de API",
      message: isAdmin
        ? "Isto vai remover a chave configurada para a plataforma. A Fábrica de Cursos volta a usar a chave definida nas variáveis de ambiente do servidor, se existir. Tem a certeza?"
        : "Isto vai remover a chave da sua empresa. A criação de novos cursos na Fábrica de Cursos ficará bloqueada até configurar uma nova chave. Tem a certeza?",
      confirmLabel: "Remover",
      destructive: true,
    });
    if (!confirmed) return;

    setRemoving(true);
    try {
      const res = await fetch("/api/admin/api-keys", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        showToast("Chave de API removida.", "success");
        await fetchStatus();
      } else {
        showToast(data.error || "Erro ao remover a chave de API.", "error");
      }
    } catch (err) {
      showToast("Erro de comunicação ao remover a chave de API.", "error");
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
          Só administradores globais (ADMIN) ou Gestores de Empresa podem aceder à Configuração de API's.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl report-page-container">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2.5">
          <Key className="h-6 w-6 text-orange-400" />
          API&apos;s
        </h1>
        <p className="text-sm text-slate-400">
          {isAdmin
            ? "Configure a chave da API OpenAI usada na Fábrica de Cursos para toda a plataforma. Os custos de geração de cursos são suportados pelo administrador da plataforma."
            : "Configure a chave da API OpenAI usada na Fábrica de Cursos da sua empresa. Os custos de geração de cursos são suportados pela sua empresa, tal como a própria chave de API."}
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
              {isAdmin ? "Chave da Plataforma (OpenAI)" : "Chave da Sua Empresa (OpenAI)"}
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
                    Configurada <span className="font-mono text-slate-500">({own.maskedKey})</span>
                    {own.updatedAt && (
                      <span className="text-slate-500"> · atualizada em {new Date(own.updatedAt).toLocaleString("pt-PT")}</span>
                    )}
                  </>
                ) : (
                  "Nenhuma chave configurada"
                )}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="sk-..."
                className="flex-1 h-10 px-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar
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
              <h2 className="text-sm font-bold text-slate-200">Chaves de API por Empresa</h2>
              <p className="text-xs text-slate-500">
                Estado das chaves configuradas por cada empresa (só visualização — cada Gestor de Empresa configura a
                sua própria chave).
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
                      <span className="text-[10px] text-slate-500 font-mono">
                        {c.configured ? c.maskedKey : "não configurada"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
