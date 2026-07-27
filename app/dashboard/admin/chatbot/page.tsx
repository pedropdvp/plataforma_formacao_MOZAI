"use client";

import React, { useState, useEffect, useRef } from "react";
import { Bot, Loader2, ShieldAlert, Upload, Trash2, CheckCircle2, XCircle, FileText } from "lucide-react";
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

  useEffect(() => {
    if (canAccess) fetchStatus();
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
        </>
      )}
    </div>
  );
}
