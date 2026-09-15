"use client";

import { useToast } from "@/components/ui/toast-provider";

import React, { useRef, useState } from "react";
import { Activity, Download, Search, FileText, Loader2 } from "lucide-react";
import { AuditViewer } from "@/components/audit-viewer";
import { exportToCSV, exportToXLSX } from "@/lib/export-utils";

export default function AuditReportPage() {
  const { showToast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setGenerated(true);
    }, 600);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 max-w-5xl print:bg-white print:text-black print:p-0 report-page-container">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-900/40 pb-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2.5">
            <Activity className="h-6 w-6 text-indigo-400" />
            Relatório de Auditoria
          </h1>
          <p className="text-sm text-slate-400">
            Acompanhe todos os acessos, operações administrativas e alterações de segurança em toda a plataforma.
          </p>
        </div>

        <fieldset className="border border-slate-700 rounded-xl px-4 py-2.5 grid grid-cols-2 gap-3 shrink-0 max-w-md">
          <legend className="text-[10px] uppercase font-extrabold text-slate-400 px-2 tracking-wider">Relatório</legend>
          <button
            disabled={generating}
            onClick={handleGenerate}
            className="col-span-2 h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {generating ? "A gerar..." : "Gerar"}
          </button>
          
          <button
            disabled={!generated}
            onClick={() => {
              reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={`h-9 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              generated
                ? "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                : "bg-slate-800/50 text-slate-500 border border-slate-850 cursor-not-allowed opacity-40"
            }`}
          >
            <Search className="h-4 w-4" />
            Visualizar
          </button>
          <button
            disabled={!generated}
            onClick={handlePrint}
            className={`h-9 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              generated
                ? "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                : "bg-slate-800/50 text-slate-500 border border-slate-850 cursor-not-allowed opacity-40"
            }`}
          >
            <Download className="h-4 w-4" />
            Guardar PDF
          </button>
          <button
            disabled={!generated}
            onClick={async () => {
              if (!generated) return;
              const res = await fetch("/api/admin/audit?limit=2000");
              if (!res.ok) {
                showToast("Erro ao obter logs de auditoria.", "error");
                return;
              }
              const data = await res.json();
              const logs = data.logs || [];
              const headers = ["Data e Hora", "Utilizador", "E-mail", "Empresa", "Ação", "Descrição"];
              const rows = logs.map((log: any) => [
                new Date(log.timestamp).toLocaleString("pt-PT"),
                log.userName,
                log.userEmail,
                log.companyName,
                log.action,
                log.description
              ]);
              await exportToXLSX(headers, rows, `relatorio_auditoria_${new Date().toISOString().split("T")[0]}`);
            }}
            className={`h-9 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              generated
                ? "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                : "bg-slate-800/50 text-slate-500 border border-slate-850 cursor-not-allowed opacity-40"
            }`}
          >
            <Download className="h-4 w-4" />
            Guardar XLSX
          </button>
          <button
            disabled={!generated}
            onClick={async () => {
              if (!generated) return;
              const res = await fetch("/api/admin/audit?limit=2000");
              if (!res.ok) {
                showToast("Erro ao obter logs de auditoria.", "error");
                return;
              }
              const data = await res.json();
              const logs = data.logs || [];
              const headers = ["Data e Hora", "Utilizador", "E-mail", "Empresa", "Ação", "Descrição"];
              const rows = logs.map((log: any) => [
                new Date(log.timestamp).toLocaleString("pt-PT"),
                log.userName,
                log.userEmail,
                log.companyName,
                log.action,
                log.description
              ]);
              await exportToCSV(headers, rows, `relatorio_auditoria_${new Date().toISOString().split("T")[0]}`);
            }}
            className={`h-9 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              generated
                ? "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                : "bg-slate-800/50 text-slate-500 border border-slate-850 cursor-not-allowed opacity-40"
            }`}
          >
            <Download className="h-4 w-4" />
            Guardar CSV
          </button>
        </fieldset>
      </div>

      <div ref={reportRef} id="report-content-audit" className="bg-slate-950/40 border border-slate-900 rounded-3xl p-6 print:border-none print:bg-transparent print:p-0">
        {!generated ? (
          <div className="border border-slate-900 border-dashed rounded-3xl p-12 text-center text-slate-500 min-h-[300px] flex flex-col items-center justify-center">
            <Activity className="h-12 w-12 text-slate-700 mb-4 animate-pulse" />
            <h4 className="font-semibold text-sm text-slate-350 mb-1">Aguardando geração do relatório</h4>
            <p className="text-xs text-slate-500 max-w-[280px] leading-relaxed">
              Clique no botão Gerar para carregar o histórico de auditoria.
            </p>
          </div>
        ) : (
          <AuditViewer />
        )}
      </div>
    </div>
  );
}
