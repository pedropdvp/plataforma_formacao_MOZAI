"use client";

import React, { useState, useEffect } from "react";
import { GraduationCap, BookOpen, Clock, Loader2, Brain } from "lucide-react";

interface CourseDefinition {
  id: string;
  courseTitle: string;
  totalLessons: number;
}

// Cursos-demo (não existem no Sanity) — usados como fallback
const DEMO_DEFINITIONS: CourseDefinition[] = [
  { id: "course-1", courseTitle: "Engenharia de IA e RAG Avançado", totalLessons: 3 },
  { id: "course-2", courseTitle: "Next.js 16 e Arquiteturas Composable SaaS", totalLessons: 3 },
  { id: "course-3", courseTitle: "Smart Contracts e Criptografia com Solidity", totalLessons: 3 },
];

interface CourseProgressResult {
  id: string;
  courseTitle: string;
  progress: number;
  completedLessons: number;
  totalLessons: number;
}

export default function ProgressPage() {
  const [progressList, setProgressList] = useState<CourseProgressResult[]>([]);
  const [topTopics, setTopTopics] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadProgress() {
      try {
        const [progressRes, catalogRes] = await Promise.all([
          fetch("/api/progress"),
          fetch("/api/catalog"),
        ]);

        const data = progressRes.ok ? await progressRes.json() : {};
        const userProgressArray = data.progress || [];
        setTopTopics(data.topTopics || []);

        // Definições de curso: cursos reais do Sanity + demos que não existam no Sanity
        let definitions: CourseDefinition[] = DEMO_DEFINITIONS;
        if (catalogRes.ok) {
          const catalog = await catalogRes.json();
          const real: CourseDefinition[] = (catalog.courses || []).map((c: any) => ({
            id: c._id,
            courseTitle: c.title,
            totalLessons: c.lessonsCount || 0,
          }));
          if (real.length > 0) {
            const realIds = new Set(real.map((c) => c.id));
            definitions = [...real, ...DEMO_DEFINITIONS.filter((d) => !realIds.has(d.id))];
          }
        }

        // Calcular progresso por curso com base no total REAL de lições
        const computedProgress = definitions.map((course) => {
          const completedCount = userProgressArray.filter(
            (p: any) => p.courseId === course.id && p.status === "completed"
          ).length;
          const denom = course.totalLessons > 0 ? course.totalLessons : 1;
          const percentage = Math.min(Math.round((completedCount / denom) * 100), 100);

          return {
            id: course.id,
            courseTitle: course.courseTitle,
            progress: percentage,
            completedLessons: completedCount,
            totalLessons: course.totalLessons,
          };
        });

        setProgressList(computedProgress);
      } catch (error) {
        console.error("Erro ao carregar progresso:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadProgress();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <GraduationCap className="h-7 w-7 text-indigo-400" />
          O Meu Progresso
        </h1>
        <p className="text-sm text-slate-400">
          Acompanhe o seu progresso detalhado em cada curso subscrito.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          <span className="text-xs font-medium">A calcular o seu aproveitamento...</span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Progress Cards */}
          <div className="space-y-6">
            {progressList.map((item) => (
              <div
                key={item.id}
                className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4 hover:border-slate-800 transition-colors shadow-xl"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="font-bold text-sm text-white">{item.courseTitle}</h3>
                  <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full self-start sm:self-auto">
                    {item.progress}% Concluído
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="h-2 w-full rounded-full bg-slate-950 border border-slate-900 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>{item.completedLessons} de {item.totalLessons} lições efetuadas</span>
                    <span>{item.progress === 100 ? "Curso Completo!" : "Em progresso"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Perfil Cognitivo / Digital Twin */}
          <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Brain className="h-4.5 w-4.5 text-indigo-400" />
              Perfil Cognitivo (Digital Twin)
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Com base nas perguntas colocada ao Tutor de IA durante as aulas, o nosso motor analisa as suas áreas de maior interesse, conceitos complexos e termos pesquisados.
            </p>

            <div className="flex flex-wrap gap-2 pt-2">
              {topTopics.length === 0 ? (
                <span className="text-[11px] text-slate-500 italic">
                  Ainda sem interações suficientes com a IA para mapear o perfil. Converse com o IA Tutor para começar!
                </span>
              ) : (
                topTopics.map((topic, index) => (
                  <span
                    key={index}
                    className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/5 border border-indigo-500/10 px-3 py-1 rounded-full uppercase tracking-wider"
                  >
                    {topic}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
