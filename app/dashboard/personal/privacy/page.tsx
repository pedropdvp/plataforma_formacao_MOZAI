"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, Download, Trash2, Loader2, Clock, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface DeletionRequest {
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  reviewedAt: string | null;
}

export default function PrivacyPage() {
  const { showToast } = useToast();
  const confirmDialog = useConfirm();
  const [isExporting, setIsExporting] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [latestRequest, setLatestRequest] = useState<DeletionRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadStatus = async () => {
    try {
      const res = await fetch("/api/compliance/deletion-request");
      if (res.ok) {
        const data = await res.json();
        setLatestRequest(data.latestRequest);
      }
    } catch (error) {
      console.error("Erro ao carregar estado do pedido de eliminação:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/compliance/export");
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || "Erro ao exportar os dados.", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mozai-dados-pessoais-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast("Os seus dados pessoais foram descarregados.", "success");
    } catch {
      showToast("Erro de comunicação ao exportar os dados.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleRequestDeletion = async () => {
    const confirmed = await confirmDialog({
      title: "Pedir Eliminação da Conta",
      message: "Isto envia um pedido de eliminação definitiva da sua conta e dados pessoais à equipa de suporte. A ação real só acontece depois de revista — não é imediata. Tem a certeza?",
      confirmLabel: "Pedir Eliminação",
      destructive: true,
    });
    if (!confirmed) return;

    setIsRequesting(true);
    try {
      const res = await fetch("/api/compliance/deletion-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        loadStatus();
      } else {
        showToast(data.error || "Erro ao registar o pedido.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao registar o pedido.", "error");
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <ShieldCheck className="h-7 w-7 text-indigo-400" />
          Privacidade & Dados
        </h1>
        <p className="text-sm text-slate-400">
          Aceda, exporte ou peça a eliminação dos seus dados pessoais, tal como garantido pelo RGPD/GDPR.
        </p>
      </div>

      <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
        <h3 className="font-bold text-sm text-white flex items-center gap-2">
          <Download className="h-4.5 w-4.5 text-indigo-400" />
          Exportar os Meus Dados
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Descarregue um ficheiro com todos os seus dados pessoais reais na plataforma: perfil, progresso, tentativas de quiz,
          submissões de projetos, interações com o Tutor de IA e publicações na Comunidade.
        </p>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all flex items-center gap-2 cursor-pointer disabled:opacity-55"
        >
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Descarregar os Meus Dados (JSON)
        </button>
      </div>

      <div className="border border-rose-500/10 bg-rose-500/5 rounded-3xl p-6 space-y-4">
        <h3 className="font-bold text-sm text-white flex items-center gap-2">
          <Trash2 className="h-4.5 w-4.5 text-rose-400" />
          Eliminar a Minha Conta
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Pede a eliminação definitiva da sua conta e dos seus dados pessoais. O pedido é revisto pela equipa de suporte antes
          de ser executado — não é uma ação instantânea.
        </p>

        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
        ) : latestRequest?.status === "pending" ? (
          <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold">
            <Clock className="h-4 w-4" />
            Pedido pendente, submetido em {new Date(latestRequest.requestedAt).toLocaleDateString("pt-PT")} — aguarda revisão.
          </div>
        ) : latestRequest?.status === "rejected" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <XCircle className="h-4 w-4 text-slate-500" />
              O seu último pedido foi rejeitado em {latestRequest.reviewedAt ? new Date(latestRequest.reviewedAt).toLocaleDateString("pt-PT") : "—"}.
            </div>
            <button
              onClick={handleRequestDeletion}
              disabled={isRequesting}
              className="h-10 px-4 rounded-xl border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 text-xs font-semibold text-rose-400 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-55"
            >
              {isRequesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Pedir Novamente
            </button>
          </div>
        ) : (
          <button
            onClick={handleRequestDeletion}
            disabled={isRequesting}
            className="h-10 px-4 rounded-xl border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 text-xs font-semibold text-rose-400 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-55"
          >
            {isRequesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Pedir Eliminação da Conta
          </button>
        )}
      </div>
    </div>
  );
}
