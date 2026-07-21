"use client";

import React, { useState, useRef } from "react";
import { Brain, FileText, Loader2, ArrowRight, Building, Award, Landmark, AlertTriangle, Search, Download, Sparkles } from "lucide-react";
import { exportToCSV, exportToXLSX } from "@/lib/export-utils";
import { useToast } from "@/components/ui/toast-provider";

export default function CareerOSPage() {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [cvText, setCvText] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);

  // --- CURSOS À MEDIDA (STUDENT CUSTOM PATH) STATE ---
  const [goal, setGoal] = useState("");
  const [duration, setDuration] = useState("4 semanas");
  const [generatingCustom, setGeneratingCustom] = useState(false);
  const { showToast } = useToast();

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cvText.trim()) return;

    setAnalyzing(true);
    setResult(null);

    try {
      const res = await fetch("/api/career/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cvText }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setResult(data.analysis);
        } else {
          showToast("Ocorreu um erro no processamento da análise.", "error");
        }
      } else {
        const errData = await res.json();
        showToast(`Erro: ${errData.error || "Não foi possível analisar o perfil."}`, "error");
      }
    } catch (err) {
      console.error("Erro na análise profissional:", err);
      showToast("Erro de comunicação com o servidor de IA.", "error");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCustomCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;

    setGeneratingCustom(true);
    try {
      const res = await fetch("/api/career/custom-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, duration }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          showToast(`Curso "${data.title}" gerado com sucesso! A redirecionar...`, "success", 5000);
          window.location.href = `/dashboard/courses/${data.courseId}/lessons/${data.firstLesson}`;
        } else {
          showToast("Erro ao processar a geração.", "error");
        }
      } else {
        const errData = await res.json();
        showToast(`Erro: ${errData.error || "Falha ao gerar o percurso personalizado."}`, "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Erro ao comunicar com o servidor de IA.", "error");
    } finally {
      setGeneratingCustom(false);
    }
  };

  return (
    <div className="space-y-8 workspace-page-container">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Brain className="h-6 w-6 text-violet-400" />
          AI Career OS: Orientador de Carreira Inteligente
        </h1>
        <p className="text-sm text-slate-400">
          Analise o seu perfil profissional em relação às necessidades reais do mercado. A IA define exatamente o que falta aprender e onde se candidatar.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Coluna Lateral: Formulário de CV & Cursos à Medida */}
        <div className="lg:col-span-1 space-y-6 self-start">
          {/* Card 1: Análise de Perfil */}
          <div className="border border-slate-900 bg-slate-900/10 rounded-3xl p-6 space-y-6">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <FileText className="h-4.5 w-4.5 text-indigo-400" />
              Análise de Perfil
            </h3>

            <form onSubmit={handleAnalyze} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-medium">
                  Cole o seu CV, Resumo ou Link do LinkedIn aqui:
                </label>
                <textarea
                  value={cvText}
                  onChange={(e) => setCvText(e.target.value)}
                  placeholder="Ex: Pedro, Engenheiro Júnior com conhecimento básico em Python e SQL, querendo trabalhar como Engenheiro de IA..."
                  className="w-full h-48 p-4 rounded-2xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none transition-colors resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={analyzing || !cvText.trim()}
                className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-xs font-semibold text-white transition-all disabled:opacity-50"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    A analisar competências...
                  </>
                ) : (
                  <>
                    Executar Orientação Profissional
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Card 2: Cursos à Medida (AI Custom Course Path) */}
          <div className="border border-slate-900 bg-slate-900/10 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-indigo-400" />
              Curso à Medida (Autoestudo)
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Defina o seu objetivo profissional e a IA gerará um percurso de estudos sob medida, mesclando aulas existentes com novas lições para preencher as lacunas do catálogo.
            </p>
            <form onSubmit={handleCustomCourse} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-medium">O seu Objetivo de Estudos:</label>
                <input
                  type="text"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Ex: Aprender Python para análise de dados de criptomoedas em 4 semanas"
                  className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-medium">Tempo de Estudo Disponível:</label>
                <input
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="Ex: 4 semanas ou 15 horas"
                  className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={generatingCustom || !goal.trim()}
                className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all disabled:opacity-50"
              >
                {generatingCustom ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Compilando Percurso...
                  </>
                ) : (
                  <>
                    Criar Curso Customizado
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Resultados da Análise de Gap */}
        <div className="lg:col-span-2 space-y-6">
          {analyzing && (
            <div className="border border-slate-900 bg-slate-900/10 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4 min-h-[300px]">
              <Loader2 className="h-10 w-10 text-violet-400 animate-spin" />
              <div className="space-y-1">
                <span className="block text-sm font-bold text-white">Cruzando dados com o mercado...</span>
                <span className="text-xs text-slate-500">A IA está a mapear competências em falta com base nas lições da MOZAI.</span>
              </div>
            </div>
          )}

          {!analyzing && !result && (
            <div className="border border-slate-900 border-dashed rounded-3xl p-12 text-center text-slate-500 min-h-[300px] flex flex-col items-center justify-center">
              <Brain className="h-12 w-12 text-slate-700 mb-4 animate-pulse" />
              <h4 className="font-semibold text-sm text-slate-350 mb-1">Aguardando dados de perfil</h4>
              <p className="text-xs text-slate-500 max-w-[280px] leading-relaxed">
                Preencha o campo de perfil profissional no menu lateral e ative a orientação baseada em IA.
              </p>
            </div>
          )}

          {!analyzing && result && (
            <div className="space-y-6 animate-fadeIn">
              {/* Painel de Exportação e Controlo */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-900 pb-4 print:hidden gap-4">
                <h2 className="text-lg font-bold text-white">Orientação Gerada</h2>
                <fieldset className="border border-slate-700 rounded-xl px-4 py-2.5 grid grid-cols-2 gap-3 shrink-0">
                  <legend className="text-[10px] uppercase font-extrabold text-slate-400 px-2 tracking-wider">Relatório</legend>
                  <button
                    onClick={() => {
                      reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Search className="h-4 w-4" />
                    Visualizar Relatório
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    Guardar PDF
                  </button>
                  <button
                    onClick={async () => {
                      const headers = ["Tipo de Informação", "Detalhe / Competência / Empresa", "Importância / Localização / Valor", "Vagas"];
                      const rows = [
                        ["Cargo Sugerido", result.targetJob, "", ""],
                        ["Média Salarial", result.marketSalary, "", ""],
                        ["Tempo Recomendado", result.studyTimeNeeded, "", ""],
                        ["Gap de Competências", `${result.gapPercentage}%`, "", ""],
                        ...result.missingSkills.map((s: any) => ["Competência em Falta", s.name, s.importance, ""]),
                        ...result.hiringCompanies.map((c: any) => ["Empresa Contratante", c.name, c.location, `${c.openRoles} vagas`])
                      ];
                      await exportToXLSX(headers, rows, `orientacao_carreira_${new Date().toISOString().split("T")[0]}`);
                    }}
                    className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    Guardar XLSX
                  </button>
                  <button
                    onClick={async () => {
                      const headers = ["Tipo de Informação", "Detalhe / Competência / Empresa", "Importância / Localização / Valor", "Vagas"];
                      const rows = [
                        ["Cargo Sugerido", result.targetJob, "", ""],
                        ["Média Salarial", result.marketSalary, "", ""],
                        ["Tempo Recomendado", result.studyTimeNeeded, "", ""],
                        ["Gap de Competências", `${result.gapPercentage}%`, "", ""],
                        ...result.missingSkills.map((s: any) => ["Competência em Falta", s.name, s.importance, ""]),
                        ...result.hiringCompanies.map((c: any) => ["Empresa Contratante", c.name, c.location, `${c.openRoles} vagas`])
                      ];
                      await exportToCSV(headers, rows, `orientacao_carreira_${new Date().toISOString().split("T")[0]}`);
                    }}
                    className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    Guardar CSV
                  </button>
                </fieldset>
              </div>

              <div ref={reportRef} className="space-y-6">
                {/* Resumo Geral */}
                <div className="border border-slate-900 bg-slate-900/20 rounded-3xl p-6 grid sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-violet-400 tracking-wider">Cargo Alvo Sugerido</span>
                    <h3 className="text-xl font-bold text-white mt-1">{result.targetJob}</h3>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-slate-400">
                    <Landmark className="h-4 w-4 text-emerald-400" />
                    <span>Média Salarial: <strong className="text-white">{result.marketSalary}</strong></span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-slate-400">
                    <ClockIcon className="h-4 w-4 text-cyan-400" />
                    <span>Tempo Recomendado: <strong className="text-white">{result.studyTimeNeeded}</strong></span>
                  </div>
                </div>

                {/* Circular / Radial Progress Gap Indicator */}
                <div className="border border-slate-800 bg-slate-950/40 rounded-2xl p-4 flex flex-col items-center justify-center space-y-2">
                  <span className="text-xs font-semibold text-slate-400">Diferencial de Competências (Gap)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-extrabold text-violet-400">{result.gapPercentage}%</span>
                    <span className="text-[10px] text-slate-500 max-w-[100px] leading-tight">
                      de competências em falta para vagas de topo
                    </span>
                  </div>
                </div>
              </div>

              {/* Skills Gaps & Course Mapping */}
              <div className="border border-slate-900 bg-slate-900/10 rounded-3xl p-6 space-y-4">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <AlertTriangle className="h-4.5 w-4.5 text-yellow-500" />
                  Que Competências me Faltam?
                </h3>

                <div className="space-y-3">
                  {result.missingSkills.map((skill: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-slate-950 border border-slate-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-white">{skill.name}</span>
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                              skill.importance === "Crítica"
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : skill.importance === "Alta"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                            }`}
                          >
                            {skill.importance}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">Mapeado com curso interno da MOZAI.</p>
                      </div>

                      <button
                        onClick={() => (window.location.href = `/dashboard`)}
                        className="inline-flex items-center justify-center gap-1.5 h-8 px-4 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-xs font-semibold text-indigo-400 transition-colors"
                      >
                        Estudar no MOZAI
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recruitment Opportunities */}
              <div className="border border-slate-900 bg-slate-900/10 rounded-3xl p-6 space-y-4">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Building className="h-4.5 w-4.5 text-indigo-400" />
                  Quem Está a Contratar?
                </h3>

                <div className="grid sm:grid-cols-3 gap-6">
                  {result.hiringCompanies.map((company: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-slate-950 border border-slate-900 space-y-3 flex flex-col justify-between"
                    >
                      <div>
                        <h4 className="font-bold text-xs text-white">{company.name}</h4>
                        <span className="text-[10px] text-slate-500">{company.location}</span>
                      </div>
                      <div className="pt-2 border-t border-slate-900/60 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">{company.openRoles} vagas abertas</span>
                        <span className="text-indigo-400 font-semibold hover:underline cursor-pointer">Ver Vagas</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
