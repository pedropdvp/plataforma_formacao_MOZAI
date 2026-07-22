"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  GraduationCap, Loader2, FileText, CheckCircle2, Download, Search, User 
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

export default function StudentsReportPage() {
  const { activeRole } = useAccess();
  const isGlobal = activeRole === "ADMIN" || activeRole === "SUPORTE";
  const reportRef = useRef<HTMLDivElement>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados dos filtros
  const [reportType, setReportType] = useState<"all" | "by_company" | "single_student" | "multiple_students" | "individual">("by_company");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [generatedReport, setGeneratedReport] = useState<any>(null);

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
        console.error("Erro ao carregar dados:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Obter lista de estudantes com base na empresa selecionada
  const getStudentsForCompany = (compId: string) => {
    return users.filter((u) => 
      u.tenants?.some((t) => t.tenantId === compId && t.roles.includes("ALUNO"))
    );
  };

  const getIndividualStudents = () => {
    // Alunos individuais: apenas associados ao root, sem pertencer a nenhuma empresa B2B
    return users.filter((u) => 
      u.tenants?.length === 1 && 
      u.tenants[0].tenantId === "root" && 
      u.tenants[0].roles.includes("ALUNO")
    );
  };

  const getAllStudents = () => {
    return users.filter((u) => 
      u.tenants?.some((t) => t.roles.includes("ALUNO"))
    );
  };

  // Handler para gerar relatório
  const handleGenerateReport = () => {
    let targetStudents: UserRecord[] = [];

    if (reportType === "all" && isGlobal) {
      targetStudents = getAllStudents();
    } else if (reportType === "by_company") {
      targetStudents = getStudentsForCompany(selectedCompanyId);
    } else if (reportType === "single_student") {
      const stu = users.find((u) => u._id === selectedStudentId);
      if (stu) targetStudents = [stu];
    } else if (reportType === "multiple_students") {
      targetStudents = users.filter((u) => selectedStudentIds.includes(u._id));
    } else if (reportType === "individual") {
      targetStudents = getIndividualStudents();
    }

    const reportData = targetStudents.map((student) => {
      // Obter progresso do estudante
      const studentProgress = progress.filter((p) => p.userId === student._id);
      const completedCoursesCount = studentProgress.filter((p) => p.status === "completed").length;

      // Empresa principal do estudante
      const primaryTenant = student.tenants?.find((t) => t.roles.includes("ALUNO")) || student.tenants?.[0];
      const companyName = primaryTenant?.companyName || "Nenhuma (Individual)";

      return {
        student,
        companyName,
        progressCount: studentProgress.length,
        completedCount: completedCoursesCount,
        progressItems: studentProgress.map((p) => {
          const course = catalog.find((c) => c._id === p.courseId);
          return {
            courseTitle: course?.title || p.courseId,
            status: p.status === "completed" ? "Concluído" : "Em Progresso",
            updatedAt: p.updatedAt ? new Date(p.updatedAt).toLocaleDateString("pt-PT") : "N/D"
          };
        })
      };
    });

    setGeneratedReport(reportData);
  };

  const handleToggleMultiple = (id: string) => {
    setSelectedStudentIds((prev) => 
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const studentsForSelectedCompany = getStudentsForCompany(selectedCompanyId);
  const allAvailableStudents = getAllStudents();

  // Se o Gestor de Empresa só tem 1 empresa, assumimos por defeito
  useEffect(() => {
    if (!isGlobal && companies.length === 1 && !selectedCompanyId) {
      setSelectedCompanyId(companies[0]._id);
    }
  }, [companies, isGlobal]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        <span className="text-sm font-semibold">A carregar dados pedagógicos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl print:bg-white print:text-black print:p-0 report-page-container">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2.5">
          <GraduationCap className="h-7 w-7 text-indigo-400" />
          Relatórios de Alunos
        </h1>
        <p className="text-sm text-slate-400">
          Visualize, analise o progresso e emita relatórios dos alunos vinculados a empresas ou individuais.
        </p>
      </div>

      {/* Configuração do Filtro */}
      <div className="bg-slate-950/40 border border-slate-900 rounded-3xl p-6 space-y-6 print:hidden">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Tipo de Relatório</label>
          <div className="flex flex-wrap gap-3">
            {isGlobal && (
              <button
                onClick={() => {
                  setReportType("all");
                  setGeneratedReport(null);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  reportType === "all" ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:border-indigo-500/40"
                }`}
              >
                Todos os Alunos (Global)
              </button>
            )}

            <button
              onClick={() => {
                setReportType("by_company");
                setGeneratedReport(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                reportType === "by_company" ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:border-indigo-500/40"
              }`}
            >
              Alunos da Empresa
            </button>

            <button
              onClick={() => {
                setReportType("single_student");
                setGeneratedReport(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                reportType === "single_student" ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:border-indigo-500/40"
              }`}
            >
              Aluno Específico
            </button>

            <button
              onClick={() => {
                setReportType("multiple_students");
                setGeneratedReport(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                reportType === "multiple_students" ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:border-indigo-500/40"
              }`}
            >
              Escolhe vários Alunos
            </button>

            <button
              onClick={() => {
                setReportType("individual");
                setGeneratedReport(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                reportType === "individual" ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:border-indigo-500/40"
              }`}
            >
              Alunos Individuais
            </button>
          </div>
        </div>

        {/* Escolha de empresa */}
        {reportType === "by_company" && (
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
              <option value="">Selecione...</option>
              {companies.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Escolha de Aluno Único */}
        {reportType === "single_student" && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">1. Escolha a Empresa</label>
              <select
                value={selectedCompanyId}
                onChange={(e) => {
                  setSelectedCompanyId(e.target.value);
                  setSelectedStudentId("");
                  setGeneratedReport(null);
                }}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-900 rounded-2xl text-xs text-white focus:outline-none"
              >
                <option value="">Selecione...</option>
                {companies.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">2. Escolha o Aluno</label>
              <select
                value={selectedStudentId}
                disabled={!selectedCompanyId}
                onChange={(e) => {
                  setSelectedStudentId(e.target.value);
                  setGeneratedReport(null);
                }}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-900 rounded-2xl text-xs text-white focus:outline-none disabled:opacity-40"
              >
                <option value="">Selecione...</option>
                {studentsForSelectedCompany.map((s) => (
                  <option key={s._id} value={s._id}>{s.firstName} {s.lastName} ({s.email})</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Escolha múltipla de alunos */}
        {reportType === "multiple_students" && (
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Selecione os Alunos Pretendidos</label>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-slate-950 rounded-2xl border border-slate-900 max-h-48 overflow-y-auto">
              {allAvailableStudents.map((s) => (
                <label key={s._id} className="flex items-center gap-2.5 text-xs text-slate-300 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.includes(s._id)}
                    onChange={() => {
                      handleToggleMultiple(s._id);
                      setGeneratedReport(null);
                    }}
                    className="h-4.5 w-4.5 rounded border-slate-900 text-indigo-600 focus:ring-indigo-500"
                  />
                  {s.firstName} {s.lastName}
                </label>
              ))}
            </div>
          </div>
        )}

        <fieldset className="border border-slate-700 rounded-xl px-4 py-2.5 grid grid-cols-2 gap-3 shrink-0 max-w-md">
          <legend className="text-[10px] uppercase font-extrabold text-slate-400 px-2 tracking-wider">Relatório</legend>
          <button
            onClick={handleGenerateReport}
            className="col-span-2 h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <FileText className="h-4 w-4" />
            Gerar
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
              const headers = ["Nome", "E-mail", "Empresa", "Curso", "Progresso", "Nota", "Estado"];
              const rows = generatedReport.flatMap((rep: any) => {
                if (!rep.courses || rep.courses.length === 0) {
                  return [[
                    `${rep.student.firstName} ${rep.student.lastName}`,
                    rep.student.email,
                    rep.companyName,
                    "-",
                    "0%",
                    "-",
                    "Não Iniciado"
                  ]];
                }
                return rep.courses.map((c: any) => [
                  `${rep.student.firstName} ${rep.student.lastName}`,
                  rep.student.email,
                  rep.companyName,
                  c.title,
                  `${c.progress}%`,
                  c.grade ? `${c.grade}%` : "-",
                  c.status === "completed" ? "Concluído" : "Em Progresso"
                ]);
              });
              await exportToXLSX(headers, rows, `relatorio_alunos_${new Date().toISOString().split("T")[0]}`);
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
              const headers = ["Nome", "E-mail", "Empresa", "Curso", "Progresso", "Nota", "Estado"];
              const rows = generatedReport.flatMap((rep: any) => {
                if (!rep.courses || rep.courses.length === 0) {
                  return [[
                    `${rep.student.firstName} ${rep.student.lastName}`,
                    rep.student.email,
                    rep.companyName,
                    "-",
                    "0%",
                    "-",
                    "Não Iniciado"
                  ]];
                }
                return rep.courses.map((c: any) => [
                  `${rep.student.firstName} ${rep.student.lastName}`,
                  rep.student.email,
                  rep.companyName,
                  c.title,
                  `${c.progress}%`,
                  c.grade ? `${c.grade}%` : "-",
                  c.status === "completed" ? "Concluído" : "Em Progresso"
                ]);
              });
              await exportToCSV(headers, rows, `relatorio_alunos_${new Date().toISOString().split("T")[0]}`);
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
            <h2 className="text-lg font-bold text-white">Relatório Gerado ({generatedReport.length} Alunos)</h2>
          </div>

          <div ref={reportRef} id="report-content-students" className="space-y-6">
            {generatedReport.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Nenhum aluno encontrado para este filtro.</p>
            ) : (
              generatedReport.map((rep: any) => (
                <div key={rep.student._id} className="border border-slate-900 bg-slate-950/20 p-4.5 rounded-3xl space-y-4 print:border-none print:p-0 w-fit max-w-full">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-900/60 pb-3 gap-8">
                    <div>
                      <h3 className="text-base font-extrabold text-white flex items-center gap-2 print:text-black">
                        <User className="h-4.5 w-4.5 text-indigo-400" />
                        {rep.student.firstName} {rep.student.lastName}
                      </h3>
                      <span className="text-[9px] text-slate-500 font-mono">
                        E-mail: {rep.student.email} | Empresa: <span className="font-semibold text-slate-350">{rep.companyName}</span>
                      </span>
                    </div>
                    <div className="text-left sm:text-right">
                      <span className="text-[9px] text-slate-500 block">Cursos Concluídos</span>
                      <span className="text-sm font-bold text-emerald-400">{rep.completedCount}</span>
                    </div>
                  </div>

                  {/* Listagem de Progresso */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Histórico de Cursos no Portal</h4>
                    {rep.progressItems.length === 0 ? (
                      <p className="text-xs text-slate-600 italic">O aluno ainda não iniciou nenhuma lição.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-900/60 bg-slate-950/40 w-fit max-w-full">
                        <table className="w-fit text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-950 border-b border-slate-900 text-[9px] text-slate-500 font-bold uppercase">
                              <th className="p-2.5">Curso</th>
                              <th className="p-2.5">Status</th>
                              <th className="p-2.5">Último Acesso</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900/40">
                            {rep.progressItems.map((item: any, idx: number) => (
                              <tr key={idx} className="text-slate-300 print:text-black">
                                <td className="p-2.5 font-semibold whitespace-nowrap">{item.courseTitle}</td>
                                <td className="p-2.5 whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                    item.status === "Concluído" ? "bg-emerald-500/10 text-emerald-400" : "bg-indigo-500/10 text-indigo-400"
                                  }`}>
                                    {item.status}
                                  </span>
                                </td>
                                <td className="p-2.5 font-mono text-[10px] text-slate-500 print:text-black whitespace-nowrap">{item.updatedAt}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
