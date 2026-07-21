"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  GraduationCap, Loader2, FileText, Download, User, Search, BookOpen, AlertTriangle 
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

export default function TeachersReportPage() {
  const { activeRole } = useAccess();
  const isGlobal = activeRole === "ADMIN" || activeRole === "SUPORTE";
  const reportRef = useRef<HTMLDivElement>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);

  // Filtros & Métricas
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [generatedReport, setGeneratedReport] = useState<any[] | null>(null);
  const [teacherMetrics, setTeacherMetrics] = useState<any>(null);

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

  const handleGenerateReport = async () => {
    setLoadingReport(true);
    setTeacherMetrics(null);
    try {
      // Obter métricas de docentes e quizzes
      const res = await fetch(`/api/admin/reports/teacher-dashboard?tenantId=${selectedCompanyId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setTeacherMetrics(data.metrics);
        }
      }
    } catch (e) {
      console.warn("Erro ao obter métricas acadêmicas do professor:", e);
    }

    // Obter professores
    const teachers = users.filter((u) => 
      u.tenants?.some((t) => 
        (selectedCompanyId === "all" ? true : t.tenantId === selectedCompanyId) && 
        t.roles.includes("PROFESSOR")
      )
    );

    const reportData = teachers.map((teacher) => {
      const tenantAssoc = teacher.tenants.find((t) => 
        selectedCompanyId === "all" ? t.roles.includes("PROFESSOR") : t.tenantId === selectedCompanyId
      );

      return {
        _id: teacher._id,
        name: `${teacher.firstName} ${teacher.lastName}`,
        email: teacher.email,
        companyName: tenantAssoc?.companyName || "MOZAI",
        roles: tenantAssoc?.roles || []
      };
    });

    setGeneratedReport(reportData);
    setLoadingReport(false);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        <span className="text-sm font-semibold">A carregar dados de docentes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl print:bg-white print:text-black print:p-0 report-page-container">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2.5">
          <GraduationCap className="h-6 w-6 text-indigo-400" />
          Relatórios de Professores
        </h1>
        <p className="text-sm text-slate-400">
          Acompanhe o corpo docente, disciplinas associadas e listagem de professores por inquilino corporativo.
        </p>
      </div>

      <div className="w-fit max-w-full space-y-6">
        {/* Filtros */}
        <div className="bg-slate-950/40 border border-slate-900 rounded-3xl p-4.5 space-y-4 print:hidden sm:min-w-[540px] w-full">
          <div className="space-y-2 w-full">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Empresa de Afiliação</label>
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
            disabled={loadingReport}
            className="col-span-2 h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            {loadingReport ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Gerar
              </>
            )}
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
              const headers = ["Professor", "E-mail", "Empresa Associada", "Papéis Atribuídos"];
              const rows = generatedReport.map((rep: any) => [
                `${rep.user.firstName} ${rep.user.lastName}`,
                rep.user.email,
                rep.companyName,
                rep.roles.join(", ")
              ]);
              await exportToXLSX(headers, rows, `relatorio_professores_${new Date().toISOString().split("T")[0]}`);
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
              const headers = ["Professor", "E-mail", "Empresa Associada", "Papéis Atribuídos"];
              const rows = generatedReport.map((rep: any) => [
                `${rep.user.firstName} ${rep.user.lastName}`,
                rep.user.email,
                rep.companyName,
                rep.roles.join(", ")
              ]);
              await exportToCSV(headers, rows, `relatorio_professores_${new Date().toISOString().split("T")[0]}`);
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
            <h2 className="text-lg font-bold text-white">Relatório Gerado ({generatedReport.length} Professores)</h2>
          </div>

          <div ref={reportRef} id="report-content-teachers" className="border border-slate-900 bg-slate-950/20 p-4.5 rounded-3xl space-y-6 print:border-none print:p-0 sm:min-w-[540px] w-full">
            {/* Métricas Académicas (Teacher Analytics) */}
            {teacherMetrics && (
              <div className="border border-slate-900/60 bg-slate-950/45 p-5 rounded-2xl space-y-4 print:border-black print:text-black">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5 print:text-black">
                  <BookOpen className="h-4 w-4 text-indigo-400 print:text-black" />
                  Métricas de Desempenho dos Alunos
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-950 border border-slate-900 p-4 rounded-xl print:border-black">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Média Geral nos Quizzes</span>
                    <span className="text-lg font-extrabold text-emerald-400 print:text-black">{teacherMetrics.averageQuizScore}%</span>
                  </div>
                  <div className="bg-slate-950 border border-slate-900 p-4 rounded-xl print:border-black">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Alunos Ativos no Período</span>
                    <span className="text-lg font-extrabold text-indigo-400 print:text-black">{teacherMetrics.activeStudentsCount} alunos</span>
                  </div>
                  <div className="bg-slate-950 border border-slate-900 p-4 rounded-xl print:border-black">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Labs e Desafios Concluídos</span>
                    <span className="text-lg font-extrabold text-sky-400 print:text-black">{teacherMetrics.completedLabsCount} resolvidos</span>
                  </div>
                </div>

                {/* Questões com Mais Erros */}
                {teacherMetrics.erroredQuestions?.length > 0 && (
                  <div className="space-y-3 pt-2 print:hidden">
                    <span className="text-[10px] uppercase font-bold text-rose-400 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Questões Críticas (Mais Erros de Alunos)
                    </span>
                    <div className="space-y-2">
                      {teacherMetrics.erroredQuestions.map((q: any, idx: number) => (
                        <div key={idx} className="p-3 bg-slate-950/60 rounded-xl border border-slate-900 space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="font-semibold text-slate-300 truncate max-w-[80%]">{q.questionText}</span>
                            <span className="text-rose-400 font-bold shrink-0">{q.count} erros</span>
                          </div>
                          <p className="text-[10px] text-slate-500">
                            <span className="text-emerald-500 font-medium">Resposta Correta:</span> {q.correctOption}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 print:text-black pt-2">Professores Vinculados</h4>

            {generatedReport.length === 0 ? (
               <p className="text-xs text-slate-500 italic">Nenhum docente associado a esta empresa.</p>
             ) : (
               <div className="overflow-x-auto rounded-2xl border border-slate-900/60 bg-slate-950/40 w-fit max-w-full">
                <table className="w-fit text-left text-xs border-collapse">
                   <thead>
                     <tr className="bg-slate-950 border-b border-slate-900 text-[10px] text-slate-500 font-bold uppercase">
                       <th className="p-2.5">Professor</th>
                       <th className="p-2.5">E-mail</th>
                       <th className="p-2.5">Empresa Associada</th>
                       <th className="p-2.5 text-center">Papéis Atribuídos</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-900/40 print:divide-slate-200 text-slate-300 print:text-black">
                     {generatedReport.map((t) => (
                       <tr key={t._id} className="hover:bg-slate-950/20">
                        <td className="p-2.5 font-semibold flex items-center gap-2 whitespace-nowrap">
                           <User className="h-4 w-4 text-indigo-400" />
                           {t.name}
                         </td>
                        <td className="p-2.5 font-mono text-[11px] text-slate-400 print:text-black whitespace-nowrap">{t.email}</td>
                        <td className="p-2.5 font-semibold text-slate-350 whitespace-nowrap">{t.companyName}</td>
                        <td className="p-2.5">
                          <div className="flex flex-wrap gap-1.5 justify-center">
                             {t.roles.map((r: string) => (
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
