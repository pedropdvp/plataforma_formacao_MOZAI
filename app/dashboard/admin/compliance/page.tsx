"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, Loader2, ShieldAlert, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useAccess } from "@/hooks/use-access";
import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";

const REVIEWER_ROLES = ["ADMIN", "SUPORTE"];

interface DeletionRequest {
  _id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

const STATUS_CONFIG: Record<DeletionRequest["status"], { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Pendente", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: Clock },
  approved: { label: "Aprovado e Eliminado", color: "text-rose-400 bg-rose-500/10 border-rose-500/20", icon: CheckCircle2 },
  rejected: { label: "Rejeitado", color: "text-slate-400 bg-slate-500/10 border-slate-500/20", icon: XCircle },
};

export default function CompliancePage() {
  const { activeRole, isLoading: loadingRole } = useAccess();
  const { showToast } = useToast();
  const confirmDialog = useConfirm();
  const canAccess = !!activeRole && REVIEWER_ROLES.includes(activeRole);

  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const loadRequests = async () => {
    try {
      const res = await fetch("/api/admin/compliance/deletion-requests");
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error("Erro ao carregar pedidos de eliminação:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canAccess) loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  const handleProcess = async (request: DeletionRequest, action: "approve" | "reject") => {
    const confirmed = await confirmDialog({
      title: action === "approve" ? "Aprovar Eliminação de Conta" : "Rejeitar Pedido",
      message:
        action === "approve"
          ? `Isto elimina definitivamente a conta de "${request.userName || request.userEmail}" e os seus dados pessoais (progresso, quizzes, logs do Tutor de IA). Publicações e projetos ficam anonimizados, não eliminados. Esta ação não pode ser revertida.`
          : `Rejeitar o pedido de eliminação de "${request.userName || request.userEmail}"? A conta mantém-se ativa.`,
      confirmLabel: action === "approve" ? "Eliminar Definitivamente" : "Rejeitar Pedido",
      destructive: true,
    });
    if (!confirmed) return;

    setProcessingId(request._id);
    try {
      const res = await fetch(`/api/admin/compliance/deletion-requests/${request._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        loadRequests();
      } else {
        showToast(data.error || "Erro ao processar o pedido.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao processar o pedido.", "error");
    } finally {
      setProcessingId(null);
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
          Só Administradores ou Suporte podem rever pedidos de eliminação de dados (RGPD/GDPR).
        </p>
      </div>
    );
  }

  const filtered = filter === "pending" ? requests.filter((r) => r.status === "pending") : requests;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <ShieldCheck className="h-7 w-7 text-indigo-400" />
          Compliance — Pedidos de Eliminação de Dados
        </h1>
        <p className="text-sm text-slate-400">
          Reveja e processe pedidos de eliminação de conta (RGPD/GDPR, direito ao esquecimento).
        </p>
      </div>

      <div className="flex gap-2">
        {(["pending", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-8 px-3.5 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
              filter === f ? "bg-indigo-600/10 border-indigo-500/30 text-white" : "border-slate-900 text-slate-400 hover:border-slate-800"
            }`}
          >
            {f === "pending" ? "Pendentes" : "Todos"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          <span className="text-xs font-medium">A carregar pedidos...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-slate-900 border-dashed rounded-3xl p-10 text-center">
          <span className="text-xs text-slate-500">Nenhum pedido encontrado para este filtro.</span>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((request) => {
            const cfg = STATUS_CONFIG[request.status];
            const StatusIcon = cfg.icon;
            return (
              <div key={request._id} className="border border-slate-900 bg-slate-950/40 rounded-2xl p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-white">{request.userName || "Utilizador"}</h4>
                    <span className="text-[11px] text-slate-500">{request.userEmail}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border self-start sm:self-auto flex items-center gap-1.5 ${cfg.color}`}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {cfg.label}
                  </span>
                </div>
                <span className="text-[11px] text-slate-600 block">
                  Pedido em {new Date(request.requestedAt).toLocaleDateString("pt-PT")}
                  {request.reviewedBy && ` · Revisto por ${request.reviewedBy}`}
                </span>

                {request.status === "pending" && (
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => handleProcess(request, "reject")}
                      disabled={processingId === request._id}
                      className="h-9 px-4 rounded-xl border border-slate-800 hover:bg-slate-900 text-xs font-semibold text-slate-300 transition-colors cursor-pointer disabled:opacity-55"
                    >
                      Rejeitar
                    </button>
                    <button
                      onClick={() => handleProcess(request, "approve")}
                      disabled={processingId === request._id}
                      className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-all flex items-center gap-2 cursor-pointer disabled:opacity-55"
                    >
                      {processingId === request._id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Aprovar e Eliminar Definitivamente
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
