"use client";

import React, { useState, useEffect, useRef } from "react";
import { Loader2, FileText, Download, Search, Users2, GraduationCap } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { exportToCSV, exportToXLSX } from "@/lib/export-utils";

interface StudentRow {
  id: string;
  name: string;
  email: string | null;
  via: "curso" | "tutela" | "curso+tutela";
  assignedCoursesCount: number;
  sharedCoursesCount: number;
  lessonsCompleted: number;
  lessonsStarted: number;
  quizAttempts: number;
  averageQuizScore: number | null;
  lastActivityAt: string | null;
}

const VIA_LABELS: Record<StudentRow["via"], string> = {
  curso: "Curso",
  tutela: "Tutela direta",
  "curso+tutela": "Curso e tutela",
};

const formatarData = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-PT") : "Sem atividade";

export default function MyStudentsReportPage() {
  const { showToast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState("all");
  const [generatedReport, setGeneratedReport] = useState<StudentRow[] | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/reports/my-students");
        if (res.ok) {
          const data = await res.json();
          setStudents(data.students || []);
        } else {
          showToast("Não foi possível carregar os seus alunos.", "error");
        }
      } catch {
        showToast("Erro de comunicação ao carregar os seus alunos.", "error");
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerateReport = () => {
    setGeneratedReport(
      selectedStudentId === "all" ? students : students.filter((s) => s.id === selectedStudentId)
    );
  };

  const linhasParaExportar = (lista: StudentRow[]) =>
    lista.map((s) => [
      s.name,
      s.email || "—",
      VIA_LABELS[s.via],
      String(s.lessonsCompleted),
      String(s.quizAttempts),
      s.averageQuizScore === null ? "Sem tentativas" : `${s.averageQuizScore}%`,
      formatarData(s.lastActivityAt),
    ]);

  const CABECALHOS = [
    "Aluno",
    "E-mail",
    "Responsabilidade",
    "Lições concluídas",
    "Tentativas de quiz",
    "Média nos quizzes",
    "Última atividade",
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        <span className="text-sm font-semibold">A carregar os seus alunos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl print:bg-white print:text-black print:p-0 report-page-container">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2.5">
          <Users2 className="h-6 w-6 text-indigo-400" />
          Os Meus Alunos
        </h1>
        <p className="text-sm text-slate-400 max-w-[70ch]">
          Os alunos pelos quais é responsável — os que frequentam os cursos que lhe estão atribuídos,
          mais os que acompanha em tutela direta. Pode gerar o relatório de todos ou de um aluno.
        </p>
      </div>

      {students.length === 0 ? (
        <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-8 text-center space-y-2 print:hidden">
          <GraduationCap className="h-8 w-8 text-slate-700 mx-auto" />
          <p className="text-sm text-slate-400">Ainda não tem alunos à sua responsabilidade.</p>
          <p className="text-xs text-slate-600 max-w-[52ch] mx-auto">
            A responsabilidade é atribuída no ecrã <strong className="text-slate-500">Corpo Docente</strong>,
            pelo Gestor Académico, pelo Gestor da Empresa ou pela administração da plataforma.
          </p>
        </div>
      ) : (
        <div className="w-fit max-w-full space-y-6">
          <div className="bg-slate-950/40 border border-slate-900 rounded-3xl p-4.5 space-y-4 print:hidden sm:min-w-[540px] w-full">
            <div className="space-y-2 w-full">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Âmbito</label>
              <select
                value={selectedStudentId}
                onChange={(e) => {
                  setSelectedStudentId(e.target.value);
                  setGeneratedReport(null);
                }}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-900 rounded-2xl text-xs text-white focus:outline-none cursor-pointer"
              >
                <option value="all">Todos os meus alunos ({students.length})</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="border border-slate-700 rounded-xl px-4 py-2.5 grid grid-cols-2 gap-3 shrink-0 w-full">
              <legend className="text-[10px] uppercase font-extrabold text-slate-400 px-2 tracking-wider">
                Relatório
              </legend>
              <button
                onClick={handleGenerateReport}
                className="col-span-2 h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileText className="h-4 w-4" />
                Gerar
              </button>
              <button
                disabled={!generatedReport}
                onClick={() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
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
                onClick={() => window.print()}
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
                  await exportToXLSX(
                    CABECALHOS,
                    linhasParaExportar(generatedReport),
                    `meus_alunos_${new Date().toISOString().split("T")[0]}`
                  );
                }}
                className={`h-9 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                  generatedReport
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                    : "bg-slate-800/50 text-slate-500 border border-slate-850 cursor-not-allowed opacity-40"
                }`}
              >
                <Download className="h-4 w-4" />
                Excel
              </button>
              <button
                disabled={!generatedReport}
                onClick={async () => {
                  if (!generatedReport) return;
                  await exportToCSV(
                    CABECALHOS,
                    linhasParaExportar(generatedReport),
                    `meus_alunos_${new Date().toISOString().split("T")[0]}`
                  );
                }}
                className={`col-span-2 h-9 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                  generatedReport
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                    : "bg-slate-800/50 text-slate-500 border border-slate-850 cursor-not-allowed opacity-40"
                }`}
              >
                <Download className="h-4 w-4" />
                CSV
              </button>
            </fieldset>
          </div>

          {generatedReport && (
            <div
              ref={reportRef}
              className="border border-slate-900 bg-slate-950/20 p-4.5 rounded-3xl space-y-4 print:border-none print:p-0 sm:min-w-[540px] w-full"
            >
              <h2 className="text-sm font-bold text-white print:text-black">
                Relatório Gerado ({generatedReport.length}{" "}
                {generatedReport.length === 1 ? "Aluno" : "Alunos"})
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="text-slate-500 uppercase tracking-wider print:text-black">
                      <th className="py-2 pr-3 font-bold">Aluno</th>
                      <th className="py-2 pr-3 font-bold">Responsabilidade</th>
                      <th className="py-2 pr-3 font-bold">Lições</th>
                      <th className="py-2 pr-3 font-bold">Quizzes</th>
                      <th className="py-2 pr-3 font-bold">Média</th>
                      <th className="py-2 font-bold">Última atividade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generatedReport.map((s) => (
                      <tr key={s.id} className="border-t border-slate-900 print:border-black">
                        <td className="py-2.5 pr-3">
                          <span className="text-slate-200 font-semibold block print:text-black">{s.name}</span>
                          <span className="text-slate-600 text-[10px]">{s.email}</span>
                        </td>
                        <td className="py-2.5 pr-3 text-slate-400 print:text-black">
                          {VIA_LABELS[s.via]}
                          {s.sharedCoursesCount > 0 && (
                            <span className="text-slate-600 block text-[10px]">
                              {s.sharedCoursesCount} curso(s) em comum
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-300 print:text-black">
                          {s.lessonsCompleted}/{s.lessonsStarted}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-300 print:text-black">{s.quizAttempts}</td>
                        <td className="py-2.5 pr-3 print:text-black">
                          {s.averageQuizScore === null ? (
                            <span className="text-slate-600">Sem tentativas</span>
                          ) : (
                            <span className="text-emerald-400 font-bold print:text-black">
                              {s.averageQuizScore}%
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-slate-400 print:text-black">
                          {formatarData(s.lastActivityAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
