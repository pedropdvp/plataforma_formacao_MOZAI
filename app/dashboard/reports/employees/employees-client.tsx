"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Users, Loader2, FileText, Download, Briefcase, Mail, Search 
} from "lucide-react";
import { useAccess } from "@/hooks/use-access";
import { exportToCSV, exportToXLSX } from "@/lib/export-utils";

interface Company {
  _id: string;
  name: string;
}

interface UserRecord {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenants: Array<{
    tenantId: string;
    roles: string[];
    companyName: string;
  }>;
}

export default function EmployeesReportPage() {
  const { activeRole } = useAccess();
  const isGlobal = activeRole === "ADMIN" || activeRole === "SUPORTE";
  const reportRef = useRef<HTMLDivElement>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [generatedReport, setGeneratedReport] = useState<any[] | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/admin/reports/data");
        if (res.ok) {
          const data = await res.json();
          setCompanies(data.companies || []);
          setUsers(data.users || []);
          if (data.companies?.length > 0) {
            setSelectedCompanyId(data.companies[0]._id);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleGenerateReport = () => {
    // Obter funcionários da empresa selecionada (excluindo ADMINs)
    const employees = users.filter((u) => 
      u.tenants?.some((t) => 
        (selectedCompanyId === "all" ? true : t.tenantId === selectedCompanyId) && 
        t.roles.includes("FUNCIONARIO") &&
        !t.roles.includes("ADMIN")
      )
    );

    const reportData = employees.map((emp) => {
      const tenantAssoc = emp.tenants.find((t) => 
        selectedCompanyId === "all" ? t.roles.includes("FUNCIONARIO") : t.tenantId === selectedCompanyId
      );

      return {
        _id: emp._id,
        name: `${emp.firstName} ${emp.lastName}`,
        email: emp.email,
        companyName: tenantAssoc?.companyName || "MOZAI",
        roles: tenantAssoc?.roles || []
      };
    });

    setGeneratedReport(reportData);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        <span className="text-sm font-semibold">A carregar dados de pessoal...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl print:bg-white print:text-black print:p-0 report-page-container">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2.5">
          <Briefcase className="h-6 w-6 text-indigo-400" />
          Relatórios de Funcionários
        </h1>
        <p className="text-sm text-slate-400">
          Gere relatórios detalhados com informações e papéis organizacionais dos funcionários operacionais.
        </p>
      </div>

      <div className="w-fit max-w-full space-y-6">
        {/* Filtros */}
        <div className="bg-slate-950/40 border border-slate-900 rounded-3xl p-4.5 space-y-4 print:hidden sm:min-w-[540px] w-full">
          <div className="space-y-2 w-full">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Empresa Destinatária</label>
          <select
            value={selectedCompanyId}
            onChange={(e) => {
              setSelectedCompanyId(e.target.value);
              setGeneratedReport(null);
            }}
            className="w-full px-4 py-3 bg-slate-950 border border-slate-900 rounded-2xl text-xs text-white focus:outline-none"
          >
            {isGlobal && <option value="all">Todas as Empresas (Global)</option>}
            {companies.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>

        <fieldset className="border border-slate-700 rounded-xl px-4 py-2.5 grid grid-cols-2 gap-3 shrink-0 w-full">
          <legend className="text-[10px] uppercase font-extrabold text-slate-400 px-2 tracking-wider">Relatório</legend>
          <button
            onClick={handleGenerateReport}
            className="col-span-2 h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileText className="h-4 w-4" />
            Gerar
          </button>
          <button
            disabled={!generatedReport}
            onClick={() => {
              reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={`h-9 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              generatedReport
                ? "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                : "bg-slate-800/50 text-slate-500 border border-slate-850 cursor-not-allowed opacity-40"
            }`}
          >
            <Search className="h-4 w-4" />
            Visualizar
          </button>
          <button
            disabled={!generatedReport}
            onClick={handlePrint}
            className={`h-9 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              generatedReport
                ? "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                : "bg-slate-800/50 text-slate-500 border border-slate-850 cursor-not-allowed opacity-40"
            }`}
          >
            <Download className="h-4 w-4" />
            Guardar PDF
          </button>
          <button
            disabled={!generatedReport}
            onClick={async () => {
              if (!generatedReport) return;
              const headers = ["Nome Completo", "E-mail Corporativo", "Empresa Associada", "Papel Operacional"];
              const rows = generatedReport.map((rep: any) => [
                `${rep.user.firstName} ${rep.user.lastName}`,
                rep.user.email,
                rep.companyName,
                rep.role
              ]);
              await exportToXLSX(headers, rows, `relatorio_funcionarios_${new Date().toISOString().split("T")[0]}`);
            }}
            className={`h-9 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              generatedReport
                ? "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                : "bg-slate-800/50 text-slate-500 border border-slate-850 cursor-not-allowed opacity-40"
            }`}
          >
            <Download className="h-4 w-4" />
            Guardar XLSX
          </button>
          <button
            disabled={!generatedReport}
            onClick={async () => {
              if (!generatedReport) return;
              const headers = ["Nome Completo", "E-mail Corporativo", "Empresa Associada", "Papel Operacional"];
              const rows = generatedReport.map((rep: any) => [
                `${rep.user.firstName} ${rep.user.lastName}`,
                rep.user.email,
                rep.companyName,
                rep.role
              ]);
              await exportToCSV(headers, rows, `relatorio_funcionarios_${new Date().toISOString().split("T")[0]}`);
            }}
            className={`h-9 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              generatedReport
                ? "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                : "bg-slate-800/50 text-slate-500 border border-slate-850 cursor-not-allowed opacity-40"
            }`}
          >
            <Download className="h-4 w-4" />
            Guardar CSV
          </button>
        </fieldset>
      </div>

      {/* Relatório */}
      {generatedReport && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-900 pb-4 print:hidden gap-4">
            <h2 className="text-lg font-bold text-white">Relatório Gerado ({generatedReport.length} Funcionários)</h2>
          </div>

          <div ref={reportRef} id="report-content-employees" className="border border-slate-900 bg-slate-950/20 p-4.5 rounded-3xl space-y-4 print:border-none print:p-0 sm:min-w-[540px] w-full">
            {generatedReport.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Nenhum funcionário operacional encontrado para esta empresa.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-900/60 bg-slate-950/40 w-fit max-w-full">
                <table className="w-fit text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-900 text-[10px] text-slate-500 font-bold uppercase">
                      <th className="p-2.5">Nome Completo</th>
                      <th className="p-2.5">E-mail Corporativo</th>
                      <th className="p-2.5">Empresa Associada</th>
                      <th className="p-2.5 text-center">Sub-cargos / Acessos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/40 print:divide-slate-200 text-slate-300 print:text-black">
                    {generatedReport.map((emp) => (
                      <tr key={emp._id} className="hover:bg-slate-950/20">
                        <td className="p-2.5 font-semibold flex items-center gap-2 whitespace-nowrap">
                          <Users className="h-4 w-4 text-indigo-400" />
                          {emp.name}
                        </td>
                        <td className="p-2.5 font-mono text-[11px] text-slate-400 print:text-black whitespace-nowrap">{emp.email}</td>
                        <td className="p-2.5 font-semibold text-slate-350 whitespace-nowrap">{emp.companyName}</td>
                        <td className="p-2.5">
                          <div className="flex flex-wrap gap-1.5 justify-center">
                            {emp.roles.map((r: string) => (
                              <span key={r} className="text-[9px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 print:text-black print:border-black whitespace-nowrap">
                                {r}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
