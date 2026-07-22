"use client";

import React, { useState, useEffect } from "react";
import { Database, Save, Loader2, ShieldAlert } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useAccess } from "@/hooks/use-access";

export default function BackupRestorePage() {
  const { showToast } = useToast();
  const confirmDialog = useConfirm();
  const { activeRole, isLoading: loadingRole } = useAccess();
  const isGlobalAdmin = activeRole === "ADMIN" || activeRole === "SUPORTE";

  const [backups, setBackups] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(true);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const fetchBackups = async () => {
    setLoadingBackups(true);
    try {
      const res = await fetch("/api/admin/backup");
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
      }
    } catch (err) {
      console.error("Erro ao ler backups:", err);
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    if (isGlobalAdmin) fetchBackups();
  }, [isGlobalAdmin]);

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      const res = await fetch("/api/admin/backup", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast(`Backup "${data.backup.id}" criado com sucesso.`, "success");
        await fetchBackups();
      } else {
        showToast(data.error || "Erro ao criar backup.", "error");
      }
    } catch (err) {
      showToast("Erro de comunicação ao criar backup.", "error");
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    const confirmed = await confirmDialog({
      title: "Restaurar Backup",
      message: `Isto vai APAGAR os dados atuais e substituí-los pelo conteúdo do backup "${backupId}". Um backup de segurança do estado atual é criado automaticamente antes, mas esta ação demora a reverter. Tem a certeza?`,
      confirmLabel: "Restaurar",
      destructive: true,
    });
    if (!confirmed) return;

    setRestoringId(backupId);
    try {
      const res = await fetch("/api/admin/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupId }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Backup restaurado. Backup de segurança do estado anterior: "${data.safetyBackupId}".`, "success");
        await fetchBackups();
      } else {
        showToast(data.error || "Erro ao restaurar backup.", "error");
      }
    } catch (err) {
      showToast("Erro de comunicação ao restaurar backup.", "error");
    } finally {
      setRestoringId(null);
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

  if (!isGlobalAdmin) {
    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center text-center space-y-4 px-6">
        <div className="p-4 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-white">Acesso Restrito</h1>
        <p className="text-sm text-slate-400 max-w-[420px]">
          Só administradores globais (ADMIN ou SUPORTE) podem aceder a Backup &amp; Restore.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl report-page-container">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2.5">
          <Database className="h-6 w-6 text-orange-400" />
          Backup &amp; Restore
        </h1>
        <p className="text-sm text-slate-400">
          Um backup diário é criado automaticamente às 03:00 e guardado de forma duradoura. Local e produção
          partilham a mesma base de dados, por isso qualquer backup cobre sempre os dois ambientes.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleCreateBackup}
          disabled={creatingBackup}
          className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          {creatingBackup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Criar Backup Agora
        </button>
      </div>

      {loadingBackups ? (
        <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          <span className="text-xs font-semibold">A carregar backups...</span>
        </div>
      ) : backups.length === 0 ? (
        <p className="text-xs text-slate-500 italic py-6">
          Nenhum backup encontrado ainda. Clica em "Criar Backup Agora" para criar o primeiro.
        </p>
      ) : (
        <div className="space-y-2.5">
          {backups.map((b) => {
            const totalDocs = Object.values(b.collections as Record<string, number>).reduce(
              (acc: number, n: number) => acc + n,
              0
            );
            return (
              <div
                key={b.id}
                className="border border-slate-900 bg-slate-950/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div>
                  <span className="block text-xs font-bold text-slate-200 font-mono">{b.id}</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {new Date(b.createdAt).toLocaleString("pt-PT")} · {totalDocs} documentos ·{" "}
                    {(b.sizeBytes / 1024).toFixed(1)} KB ·{" "}
                    {b.trigger === "manual" ? "manual" : b.trigger === "cron" ? "automático" : "salvaguarda pré-restauro"}
                  </span>
                </div>
                <button
                  onClick={() => handleRestoreBackup(b.id)}
                  disabled={restoringId === b.id}
                  className="shrink-0 h-9 px-3.5 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-[11px] font-bold text-rose-450 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {restoringId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Restaurar
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
