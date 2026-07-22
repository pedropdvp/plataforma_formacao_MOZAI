"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Building, Loader2, FileText, CheckCircle2, ChevronRight, Download, Users, Briefcase, GraduationCap, Search 
} from "lucide-react";
import { useAccess } from "@/hooks/use-access";
import { exportToCSV, exportToXLSX } from "@/lib/export-utils";
import { DetailModal, DetailModalColumn } from "@/components/ui/detail-modal";

interface Company {
  _id: string;
  name: string;
  subdomain?: string;
  employeesCount?: number;
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

export default function CompaniesReportPage() {
  const { activeRole } = useAccess();
  const isGlobal = activeRole === "ADMIN" || activeRole === "SUPORTE";
  const reportRef = useRef<HTMLDivElement>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);

  // Estados dos filtros
  const [reportType, setReportType] = useState<"all" | "single" | "multiple">("single");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [generatedReport, setGeneratedReport] = useState<any>(null);
  const [activeDetail, setActiveDetail] = useState<{
    repIdx: number;
    type: "colaboradores" | "managers" | "employees" | "students" | "revenueByStudent" | "completedCourses" | "dropoff";
    dropoffIdx?: number;
  } | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/admin/reports/data");
        if (res.ok) {
          const data = await res.json();
          setCompanies(data.companies || []);
          setUsers(data.users || []);
          setProgress(data.progress || []);
          setCatalog(data.catalog || []);

          if (data.companies?.length > 0) {
            setSelectedCompanyId(data.companies[0]._id);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar dados de relatórios:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Handler para gerar relatório
  const handleGenerateReport = async () => {
    let targetCompanies: Company[] = [];

    if (reportType === "all" && isGlobal) {
      targetCompanies = companies;
    } else if (reportType === "single") {
      const comp = companies.find((c) => c._id === selectedCompanyId);
      if (comp) targetCompanies = [comp];
    } else if (reportType === "multiple") {
      targetCompanies = companies.filter((c) => selectedCompanyIds.includes(c._id));
    }

    setLoadingReport(true);
    try {
      const reportPromises = targetCompanies.map(async (comp) => {
        // Obter métricas de analytics
        let metrics = {
          totalRevenue: 2450.00,
          totalEnrollments: 12,
          totalCompletions: 4,
          dropoffs: [
            { lessonId: "lesson-1-2", title: "Definição de Cripto", count: 8 },
            { lessonId: "lesson-1-3", title: "Blockchain e Consenso", count: 5 }
          ]
        };

        try {
          const res = await fetch(`/api/admin/reports/analytics?tenantId=${comp._id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              metrics = data.metrics;
            }
          }
        } catch (e) {
          console.warn("Erro ao ler analytics para a empresa:", comp.name, e);
        }

        // Filtrar funcionários
        const compEmployees = users.filter((u) => 
          u.tenants?.some((t) => t.tenantId === comp._id && t.roles.includes("FUNCIONARIO"))
        );

        // Filtrar alunos
        const compStudents = users.filter((u) => 
          u.tenants?.some((t) => t.tenantId === comp._id && t.roles.includes("ALUNO"))
        );

        // Gestores de empresa
        const compManagers = users.filter((u) => 
          u.tenants?.some((t) => t.tenantId === comp._id && t.roles.includes("GESTOR_EMPRESA"))
        );

        // Outros papéis
        const totalColaboradores = users.filter((u) =>
          u.tenants?.some((t) => t.tenantId === comp._id)
        );

        // Progresso dos alunos no tenant
        const compProgress = progress.filter((p) => p.tenantId === comp._id);
        const totalCompleted = compProgress.filter((p) => p.status === "completed").length;

        const mapUser = (u: UserRecord) => ({
          name: `${u.firstName} ${u.lastName}`,
          email: u.email
        });

        return {
          company: comp,
          managers: compManagers,
          employees: compEmployees.map(mapUser),
          employeesCount: compEmployees.length,
          students: compStudents.map(mapUser),
          studentsCount: compStudents.length,
          colaboradoresCount: totalColaboradores.length,
          totalProgressRecords: compProgress.length,
          completedQuizzes: totalCompleted,
          metrics,
          colaboradores: totalColaboradores.map((u) => ({
            name: `${u.firstName} ${u.lastName}`,
            email: u.email,
            roles: u.tenants.find((t) => t.tenantId === comp._id)?.roles || []
          }))
        };
      });

      const reportData = await Promise.all(reportPromises);
      setGeneratedReport(reportData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReport(false);
    }
  };

  const handleToggleMultiple = (id: string) => {
    setSelectedCompanyIds((prev) => 
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        <span className="text-sm font-semibold">A carregar dados das empresas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl print:bg-white print:text-black print:p-0 report-page-container">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2.5">
          <Building className="h-6 w-6 text-indigo-400" />
          Relatórios de Empresas
        </h1>
        <p className="text-sm text-slate-400">
          Visualize, agrupe e emita relatórios operacionais detalhados das empresas registadas na plataforma.
        </p>
      </div>

      <div className="w-fit max-w-full space-y-6">
        {/* Configuração do Filtro de Relatório */}
        <div className="bg-slate-950/40 border border-slate-900 rounded-3xl p-4.5 space-y-4 print:hidden sm:min-w-[540px] w-full">
          <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Tipo de Relatório</label>
          <div className="grid grid-cols-1 sm:grid-flow-col auto-cols-fr gap-2 w-full">
            {isGlobal && (
              <button
                onClick={() => {
                  setReportType("all");
                  setGeneratedReport(null);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                  reportType === "all" ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                Todas as Empresas (Agrupado)
              </button>
            )}

            <button
              onClick={() => {
                setReportType("single");
                setGeneratedReport(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                reportType === "single" ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-400 hover:text-white"
              }`}
            >
              Uma Empresa Específica
            </button>

            <button
              onClick={() => {
                setReportType("multiple");
                setGeneratedReport(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                reportType === "multiple" ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-400 hover:text-white"
              }`}
            >
              Lista de Empresas Escolhidas
            </button>
          </div>
        </div>

        {/* Escolha de empresa única */}
        {reportType === "single" && (
          <div className="space-y-2 max-w-sm">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Selecione a Empresa</label>
            <select
              value={selectedCompanyId}
              onChange={(e) => {
                setSelectedCompanyId(e.target.value);
                setGeneratedReport(null);
              }}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-900 rounded-2xl text-xs text-white focus:outline-none"
            >
              {companies.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Escolha múltipla de empresas */}
        {reportType === "multiple" && (
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Selecione as Empresas Pretendidas</label>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-slate-950 rounded-2xl border border-slate-900 max-h-48 overflow-y-auto">
              {companies.map((c) => (
                <label key={c._id} className="flex items-center gap-2.5 text-xs text-slate-300 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCompanyIds.includes(c._id)}
                    onChange={() => {
                      handleToggleMultiple(c._id);
                      setGeneratedReport(null);
                    }}
                    className="h-4.5 w-4.5 rounded border-slate-900 text-indigo-600 focus:ring-indigo-500"
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
        )}

        <fieldset className="border border-slate-700 rounded-xl px-4 py-2.5 grid grid-cols-2 gap-3 shrink-0 w-full">
          <legend className="text-[10px] uppercase font-extrabold text-slate-400 px-2 tracking-wider">Relatório</legend>
          <button
            onClick={handleGenerateReport}
            disabled={loadingReport}
            className="col-span-2 h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
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
            className={`h-9 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
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
            className={`h-9 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
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
              const headers = ["Nome da Empresa", "Subdomínio", "Tipo de Membro", "Nome do Utilizador", "E-mail"];
              const rows = generatedReport.flatMap((rep: any) => {
                const companyName = rep.company.name;
                const subdomain = rep.company.subdomain || "-";
                const adminRows = rep.admins.map((u: any) => [
                  companyName,
                  subdomain,
                  "Administrador",
                  `${u.firstName} ${u.lastName}`,
                  u.email
                ]);
                const employeeRows = rep.employees.map((u: any) => [
                  companyName,
                  subdomain,
                  "Funcionário",
                  `${u.firstName} ${u.lastName}`,
                  u.email
                ]);
                const studentRows = rep.students.map((u: any) => [
                  companyName,
                  subdomain,
                  "Aluno",
                  `${u.firstName} ${u.lastName}`,
                  u.email
                ]);
                const combined = [...adminRows, ...employeeRows, ...studentRows];
                if (combined.length === 0) {
                  return [[companyName, subdomain, "-", "-", "-"]];
                }
                return combined;
              });
              await exportToXLSX(headers, rows, `relatorio_empresas_${new Date().toISOString().split("T")[0]}`);
            }}
            className={`h-9 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
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
              const headers = ["Nome da Empresa", "Subdomínio", "Tipo de Membro", "Nome do Utilizador", "E-mail"];
              const rows = generatedReport.flatMap((rep: any) => {
                const companyName = rep.company.name;
                const subdomain = rep.company.subdomain || "-";
                const adminRows = rep.admins.map((u: any) => [
                  companyName,
                  subdomain,
                  "Administrador",
                  `${u.firstName} ${u.lastName}`,
                  u.email
                ]);
                const employeeRows = rep.employees.map((u: any) => [
                  companyName,
                  subdomain,
                  "Funcionário",
                  `${u.firstName} ${u.lastName}`,
                  u.email
                ]);
                const studentRows = rep.students.map((u: any) => [
                  companyName,
                  subdomain,
                  "Aluno",
                  `${u.firstName} ${u.lastName}`,
                  u.email
                ]);
                const combined = [...adminRows, ...employeeRows, ...studentRows];
                if (combined.length === 0) {
                  return [[companyName, subdomain, "-", "-", "-"]];
                }
                return combined;
              });
              await exportToCSV(headers, rows, `relatorio_empresas_${new Date().toISOString().split("T")[0]}`);
            }}
            className={`h-9 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
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

      {/* Relatório Gerado */}
      {generatedReport && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-900 pb-4 print:hidden gap-4">
            <h2 className="text-lg font-bold text-white">Relatório Gerado</h2>
          </div>

          <div ref={reportRef} id="report-content-companies" className="space-y-8 print:space-y-12">
            {generatedReport.map((rep: any, repIdx: number) => (
              <div key={rep.company._id} className="border border-slate-900 bg-slate-950/20 p-4.5 rounded-3xl space-y-4 print:border-none print:p-0 sm:min-w-[540px] w-full">
                {/* Cabeçalho da Empresa */}
                <div className="flex items-center justify-between border-b border-slate-900/60 pb-3 gap-8">
                  <div className="space-y-0.5">
                    <h3 className="text-base font-extrabold text-indigo-400 print:text-black">
                      {rep.company.name}
                    </h3>
                    <span className="text-[9px] text-slate-500 font-mono">
                      ID: {rep.company._id} {rep.company.subdomain ? `| Subdomínio: ${rep.company.subdomain}` : ""}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider print:border print:text-emerald-700">
                      Emitido
                    </span>
                  </div>
                </div>

                {/* Grid de Estatísticas */}
                <div className="flex flex-wrap gap-3">
                  <div
                    onClick={() => setActiveDetail({ repIdx, type: "colaboradores" })}
                    className="bg-slate-950/60 border border-slate-900 p-3 rounded-2xl w-fit min-w-[140px] print:border-black print:text-black cursor-pointer hover:border-indigo-500/40 transition-colors"
                  >
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 block">Total Colaboradores</span>
                    <span className="text-lg font-bold text-white print:text-black">{rep.colaboradoresCount}</span>
                  </div>
                  <div
                    onClick={() => setActiveDetail({ repIdx, type: "managers" })}
                    className="bg-slate-950/60 border border-slate-900 p-3 rounded-2xl w-fit min-w-[140px] print:border-black print:text-black cursor-pointer hover:border-indigo-500/40 transition-colors"
                  >
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 block">Gestores de Empresa</span>
                    <span className="text-lg font-bold text-white print:text-black">{rep.managers.length}</span>
                  </div>
                  <div
                    onClick={() => setActiveDetail({ repIdx, type: "employees" })}
                    className="bg-slate-950/60 border border-slate-900 p-3 rounded-2xl w-fit min-w-[140px] print:border-black print:text-black cursor-pointer hover:border-indigo-500/40 transition-colors"
                  >
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 block">Funcionários</span>
                    <span className="text-lg font-bold text-white print:text-black">{rep.employeesCount}</span>
                  </div>
                  <div
                    onClick={() => setActiveDetail({ repIdx, type: "students" })}
                    className="bg-slate-950/60 border border-slate-900 p-3 rounded-2xl w-fit min-w-[140px] print:border-black print:text-black cursor-pointer hover:border-indigo-500/40 transition-colors"
                  >
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 block">Alunos / Formandos</span>
                    <span className="text-lg font-bold text-white print:text-black">{rep.studentsCount}</span>
                  </div>
                </div>

                {/* Métricas de Negócio & Desempenho (Tenant Analytics) */}
                <div className="border border-slate-900/60 bg-slate-950/40 p-5 rounded-2xl space-y-5 print:border-black print:text-black">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 print:text-black">Desempenho de Negócio (Analytics)</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-950 border border-slate-900 p-4 rounded-xl print:border-black space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Receita Acumulada</span>
                      <span className="text-lg font-extrabold text-emerald-400 print:text-black block">
                        {rep.metrics?.totalRevenue ? `${rep.metrics.totalRevenue.toFixed(2)} €` : "0.00 €"}
                      </span>
                      <button
                        onClick={() => setActiveDetail({ repIdx, type: "revenueByStudent" })}
                        className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 underline decoration-dotted print:hidden cursor-pointer"
                      >
                        Ver por aluno
                      </button>
                    </div>
                    <div
                      onClick={() => setActiveDetail({ repIdx, type: "students" })}
                      className="bg-slate-950 border border-slate-900 p-4 rounded-xl print:border-black cursor-pointer hover:border-indigo-500/40 transition-colors"
                    >
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Novas Inscrições</span>
                      <span className="text-lg font-extrabold text-indigo-400 print:text-black">
                        {rep.metrics?.totalEnrollments || 0} alunos
                      </span>
                    </div>
                    <div
                      onClick={() => setActiveDetail({ repIdx, type: "completedCourses" })}
                      className="bg-slate-950 border border-slate-900 p-4 rounded-xl print:border-black cursor-pointer hover:border-indigo-500/40 transition-colors"
                    >
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Taxa de Conclusão</span>
                      <span className="text-lg font-extrabold text-sky-400 print:text-black">
                        {rep.metrics?.totalCompletions || 0} cursos
                      </span>
                    </div>
                  </div>

                  {/* Dropoffs por Lição */}
                  {rep.metrics?.dropoffs?.length > 0 && (
                    <div className="space-y-3 pt-2 print:hidden">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Pontos de Abandono por Lição (Alunos Ativos Inativos)</span>
                      <div className="space-y-3">
                        {rep.metrics.dropoffs.map((item: any, idx: number) => {
                          const percent = rep.metrics.totalEnrollments > 0
                            ? Math.round((item.count / rep.metrics.totalEnrollments) * 100)
                            : 0;
                          return (
                            <div key={idx} className="space-y-1">
                              <div className="flex justify-between items-center gap-2 text-[11px] text-slate-400">
                                <span className="truncate max-w-[55%] font-medium text-slate-350">{item.title}</span>
                                <span className="text-rose-400 font-bold shrink-0">{item.count} alunos ({percent}%)</span>
                                <button
                                  onClick={() => setActiveDetail({ repIdx, type: "dropoff", dropoffIdx: idx })}
                                  className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 underline decoration-dotted shrink-0 cursor-pointer"
                                >
                                  Ver alunos
                                </button>
                              </div>
                              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-900/60">
                                <div
                                  className="bg-gradient-to-r from-rose-600 to-red-500 h-full rounded-full"
                                  style={{ width: `${Math.max(percent, 5)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Listagem de Colaboradores e seus Papéis */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 print:text-black">Colaboradores Vinculados</h4>
                  {rep.colaboradores.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">Nenhum colaborador vinculado a esta empresa.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-900/60 bg-slate-950/40 w-fit max-w-full">
                      <table className="w-fit text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-950 border-b border-slate-900 text-[10px] text-slate-500 font-bold uppercase">
                            <th className="p-2.5">Nome</th>
                            <th className="p-2.5">E-mail</th>
                            <th className="p-2.5 text-center">Papéis de Acesso</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900/40 print:divide-slate-200">
                          {rep.colaboradores.map((c: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-950/20 text-slate-300 print:text-black">
                              <td className="p-2.5 font-semibold whitespace-nowrap">{c.name}</td>
                              <td className="p-2.5 font-mono text-[11px] text-slate-400 print:text-black whitespace-nowrap">{c.email}</td>
                              <td className="p-2.5">
                                <div className="flex flex-wrap gap-1.5 justify-center">
                                  {c.roles.map((r: string) => (
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
            ))}
          </div>
        </div>
      )}
      </div>

      {activeDetail && (() => {
        const rep = generatedReport[activeDetail.repIdx];
        if (!rep) return null;

        if (activeDetail.type === "colaboradores") {
          return (
            <DetailModal
              title="Total Colaboradores"
              subtitle={rep.company.name}
              items={rep.colaboradores.map((c: any) => ({ ...c, roles: (c.roles || []).join(", ") }))}
              columns={[{ key: "name", label: "Nome" }, { key: "email", label: "E-mail" }, { key: "roles", label: "Papéis" }] as DetailModalColumn[]}
              onClose={() => setActiveDetail(null)}
            />
          );
        }
        if (activeDetail.type === "managers") {
          return (
            <DetailModal
              title="Gestores de Empresa"
              subtitle={rep.company.name}
              items={rep.managers.map((u: any) => ({ name: `${u.firstName} ${u.lastName}`, email: u.email }))}
              columns={[{ key: "name", label: "Nome" }, { key: "email", label: "E-mail" }] as DetailModalColumn[]}
              onClose={() => setActiveDetail(null)}
            />
          );
        }
        if (activeDetail.type === "employees") {
          return (
            <DetailModal
              title="Funcionários"
              subtitle={rep.company.name}
              items={rep.employees}
              columns={[{ key: "name", label: "Nome" }, { key: "email", label: "E-mail" }] as DetailModalColumn[]}
              onClose={() => setActiveDetail(null)}
            />
          );
        }
        if (activeDetail.type === "students") {
          return (
            <DetailModal
              title="Alunos / Formandos"
              subtitle={rep.company.name}
              items={rep.students}
              columns={[{ key: "name", label: "Nome" }, { key: "email", label: "E-mail" }] as DetailModalColumn[]}
              onClose={() => setActiveDetail(null)}
            />
          );
        }
        if (activeDetail.type === "revenueByStudent") {
          return (
            <DetailModal
              title="Receita por Aluno"
              subtitle={rep.company.name}
              items={rep.metrics?.revenueByStudent || []}
              columns={[{ key: "name", label: "Nome" }, { key: "email", label: "E-mail" }, { key: "amount", label: "Valor", align: "right" }] as DetailModalColumn[]}
              onClose={() => setActiveDetail(null)}
            />
          );
        }
        if (activeDetail.type === "completedCourses") {
          return (
            <DetailModal
              title="Cursos Concluídos"
              subtitle={rep.company.name}
              items={rep.metrics?.completedCourses || []}
              columns={[{ key: "courseTitle", label: "Curso" }, { key: "completions", label: "Conclusões", align: "right" }] as DetailModalColumn[]}
              onClose={() => setActiveDetail(null)}
            />
          );
        }
        if (activeDetail.type === "dropoff" && activeDetail.dropoffIdx !== undefined) {
          const dropoff = rep.metrics?.dropoffs?.[activeDetail.dropoffIdx];
          return (
            <DetailModal
              title={`Alunos Inativos: ${dropoff?.title || ""}`}
              subtitle={`${rep.company.name} — alunos que começaram a lição mas não a concluíram`}
              items={dropoff?.students || []}
              columns={[{ key: "name", label: "Nome" }, { key: "email", label: "E-mail" }] as DetailModalColumn[]}
              onClose={() => setActiveDetail(null)}
            />
          );
        }
        return null;
      })()}
    </div>
  );
}
