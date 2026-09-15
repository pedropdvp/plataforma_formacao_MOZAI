"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  GraduationCap, Loader2, FileText, Download, User, Search, BookOpen, AlertTriangle 
} from "lucide-react";
import { useAccess } from "@/hooks/use-access";
import { exportToCSV, exportToXLSX } from "@/lib/export-utils";
import { DetailModal, DetailModalColumn } from "@/components/ui/detail-modal";
import { TEACHING_ROLE_LABELS as ROLE_LABELS, isTeachingRole } from "@/lib/academic-roles";

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
  const [activeDetail, setActiveDetail] = useState<"activeStudents" | "erroredQuestions" | null>(null);

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
          // hasData distingue "não há registos" de "os registos dão zero" — sem isso, um
          // painel todo a zeros parece avaria e não ausência de atividade.
          setTeacherMetrics({ ...data.metrics, hasData: data.hasData });
        }
      }
    } catch (e) {
      console.warn("Erro ao obter métricas acadêmicas do professor:", e);
    }

    // Corpo docente: os quatro perfis que podem ter alunos à responsabilidade. Contar apenas
    // PROFESSOR devolvia zero em plataformas onde a docência está atribuída como FORMADOR ou
    // TUTOR — que é o caso mais comum.
    const isDocente = (roles: string[]) => roles.some(isTeachingRole);

    const teachers = users.filter((u) =>
      u.tenants?.some(
        (t) =>
          (selectedCompanyId === "all" ? true : t.tenantId === selectedCompanyId) &&
          isDocente(t.roles)
      )
    );

    // Cursos e alunos à responsabilidade de cada docente. Só numa empresa de cada vez: somar
    // responsabilidades de empresas diferentes daria um número sem significado, porque o mesmo
    // docente pode dar o mesmo curso em duas empresas a alunos distintos.
    let responsibility: Record<string, { courses: number; students: number }> = {};
    if (selectedCompanyId !== "all" && teachers.length > 0) {
      try {
        const ids = teachers.map((t) => t._id).join(",");
        const res = await fetch(
          `/api/admin/academics/responsibility?tenantId=${selectedCompanyId}&staffIds=${encodeURIComponent(ids)}`
        );
        if (res.ok) {
          const data = await res.json();
          responsibility = data.counts || {};
        }
      } catch (e) {
        console.warn("Erro ao obter as responsabilidades do corpo docente:", e);
      }
    }

    const reportData = teachers.map((teacher) => {
      // O vínculo a mostrar é o da empresa filtrada; em modo global, o primeiro onde a pessoa
      // é docente (e não um qualquer, que podia ser o de aluno noutra empresa).
      const tenantAssoc =
        selectedCompanyId === "all"
          ? teacher.tenants.find((t) => isDocente(t.roles))
          : teacher.tenants.find((t) => t.tenantId === selectedCompanyId);

      const perfisDocentes = (tenantAssoc?.roles || []).filter(isTeachingRole);

      return {
        _id: teacher._id,
        name: `${teacher.firstName} ${teacher.lastName}`,
        email: teacher.email,
        companyName: tenantAssoc?.companyName || "MOZAI",
        roles: perfisDocentes.length > 0 ? perfisDocentes : tenantAssoc?.roles || [],
        responsibility: responsibility[teacher._id] || null,
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
              // rep.name/rep.email: o relatório nunca teve um campo `user`, e lê-lo rebentava
              // a exportação com um TypeError assim que se carregava no botão.
              const headers = ["Docente", "E-mail", "Empresa Associada", "Perfil Docente", "Cursos", "Alunos"];
              const rows = generatedReport.map((rep: any) => [
                rep.name,
                rep.email,
                rep.companyName,
                rep.roles.map((r: string) => ROLE_LABELS[r] || r).join(", "),
                rep.responsibility ? String(rep.responsibility.courses) : "—",
                rep.responsibility ? String(rep.responsibility.students) : "—",
              ]);
              await exportToXLSX(headers, rows, `relatorio_professores_${new Date().toISOString().split("T")[0]}`);
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
              // rep.name/rep.email: o relatório nunca teve um campo `user`, e lê-lo rebentava
              // a exportação com um TypeError assim que se carregava no botão.
              const headers = ["Docente", "E-mail", "Empresa Associada", "Perfil Docente", "Cursos", "Alunos"];
              const rows = generatedReport.map((rep: any) => [
                rep.name,
                rep.email,
                rep.companyName,
                rep.roles.map((r: string) => ROLE_LABELS[r] || r).join(", "),
                rep.responsibility ? String(rep.responsibility.courses) : "—",
                rep.responsibility ? String(rep.responsibility.students) : "—",
              ]);
              await exportToCSV(headers, rows, `relatorio_professores_${new Date().toISOString().split("T")[0]}`);
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

                {!teacherMetrics.hasData && (
                  <p className="text-[11px] text-amber-400/90 bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2 print:text-black print:border-black">
                    Ainda não há tentativas de quiz nem progresso registado nesta empresa. Os valores
                    abaixo estão a zero porque não existem dados — não por falha do relatório.
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-950 border border-slate-900 p-4 rounded-xl print:border-black">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Média Geral nos Quizzes</span>
                    <span className="text-lg font-extrabold text-emerald-400 print:text-black">{teacherMetrics.averageQuizScore}%</span>
                  </div>
                  <div
                    onClick={() => setActiveDetail("activeStudents")}
                    className="bg-slate-950 border border-slate-900 p-4 rounded-xl print:border-black cursor-pointer hover:border-indigo-500/40 transition-colors"
                  >
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
                  <div
                    onClick={() => setActiveDetail("erroredQuestions")}
                    className="space-y-3 pt-2 print:hidden cursor-pointer hover:opacity-90 transition-opacity rounded-2xl"
                  >
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
                       <th className="p-2.5 text-center">Perfil Docente</th>
                       <th className="p-2.5 text-center">À responsabilidade</th>
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
                                 {ROLE_LABELS[r] || r}
                               </span>
                             ))}
                           </div>
                         </td>
                        <td className="p-2.5 text-center whitespace-nowrap text-slate-400 print:text-black">
                          {t.responsibility ? (
                            <>
                              {t.responsibility.courses} curso(s)
                              <span className="text-slate-600"> · </span>
                              {t.responsibility.students} aluno(s)
                            </>
                          ) : (
                            <span className="text-slate-600" title="Escolha uma empresa para ver a responsabilidade de cada docente">
                              —
                            </span>
                          )}
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

      {activeDetail === "activeStudents" && (
        <DetailModal
          title="Alunos Ativos no Período"
          subtitle={`${teacherMetrics?.activeStudentsCount || 0} alunos com atividade registada (tentativas de quiz)`}
          items={teacherMetrics?.activeStudents || []}
          columns={[
            { key: "name", label: "Nome" },
            { key: "email", label: "E-mail" },
          ] as DetailModalColumn[]}
          onClose={() => setActiveDetail(null)}
        />
      )}

      {activeDetail === "erroredQuestions" && (
        <DetailModal
          title="Questões Críticas (Mais Erros de Alunos)"
          subtitle="Perguntas com maior número de respostas incorretas"
          items={teacherMetrics?.erroredQuestions || []}
          renderItem={(q: any, idx: number) => (
            <div key={idx} className="p-3 bg-slate-950/60 rounded-xl border border-slate-900 space-y-1 no-3d-effect">
              <div className="flex justify-between text-[11px] gap-3">
                <span className="font-semibold text-slate-300">{q.questionText}</span>
                <span className="text-rose-400 font-bold shrink-0">{q.count} erros</span>
              </div>
              <p className="text-[10px] text-slate-500">
                <span className="text-emerald-500 font-medium">Resposta Correta:</span> {q.correctOption}
              </p>
            </div>
          )}
          onClose={() => setActiveDetail(null)}
        />
      )}
    </div>
  );
}
