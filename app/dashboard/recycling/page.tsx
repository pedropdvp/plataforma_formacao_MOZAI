"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { RefreshCw, Clock, Award, Info, Play, ShieldAlert, Loader2 } from "lucide-react";

interface CompletedCourse {
  _id: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  lessonsCount: number;
  gradient: string;
}

// Fallback estático dos cursos demos
const ALL_COURSES = [
  {
    _id: "course-1",
    title: "Engenharia de IA e RAG Avançado",
    description: "Domine a integração de LLMs, chunking semântico, embeddings vetoriais e orquestração de agentes com LangChain e Vercel AI SDK.",
    category: "Inteligência Artificial",
    duration: "24h de conteúdo",
    lessonsCount: 18,
    gradient: "from-violet-500 to-indigo-500",
  },
  {
    _id: "course-2",
    title: "Next.js 16 e Arquiteturas Composable SaaS",
    description: "Construa aplicações SaaS escaláveis utilizando Next.js 16 App Router, Clerk auth, WorkOS SSO, Sanity CMS e Stripe Connect.",
    category: "Programação / Frontend",
    duration: "18h de conteúdo",
    lessonsCount: 14,
    gradient: "from-indigo-500 to-cyan-500",
  },
  {
    _id: "course-3",
    title: "Smart Contracts e Criptografia com Solidity",
    description: "Crie tokens ERC-20, NFTs dinâmicos, contratos seguros de DeFi e explore o desenvolvimento na blockchain Ethereum e Polygon.",
    category: "Crypto & Blockchain",
    duration: "30h de conteúdo",
    lessonsCount: 22,
    gradient: "from-cyan-500 to-emerald-500",
  },
];

const GRADIENTS = [
  "from-violet-500 to-indigo-500",
  "from-purple-500 to-pink-500",
  "from-indigo-500 to-cyan-500",
  "from-cyan-500 to-emerald-500",
  "from-amber-500 to-rose-500",
  "from-emerald-500 to-teal-500",
];

function mapSanityCourse(c: any, i: number) {
  const mins = typeof c.minutes === "number" ? c.minutes : 0;
  const duration = mins >= 60 ? `${Math.round(mins / 60)}h de conteúdo` : mins > 0 ? `${mins}m de conteúdo` : "Conteúdo estruturado";
  return {
    _id: c._id,
    title: c.title,
    description: c.description || "",
    category: c.category || "Formação",
    duration,
    lessonsCount: c.lessonsCount || 0,
    gradient: GRADIENTS[i % GRADIENTS.length],
  };
}

export default function RecyclingPage() {
  const [completedCourses, setCompletedCourses] = useState<CompletedCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadRecyclingData() {
      try {
        const [catalogRes, progressRes] = await Promise.all([
          fetch("/api/catalog"),
          fetch("/api/progress"),
        ]);

        let allAvailableCourses: any[] = ALL_COURSES;
        if (catalogRes.ok) {
          const data = await catalogRes.json();
          const real = (data.courses || []).map(mapSanityCourse);
          if (real.length > 0) {
            const realIds = new Set(real.map((c: any) => c._id));
            allAvailableCourses = [...real, ...ALL_COURSES.filter((c) => !realIds.has(c._id))];
          }
        }

        let progressList: any[] = [];
        if (progressRes.ok) {
          const pdata = await progressRes.json();
          progressList = pdata.progress || [];
        }

        // Filtrar apenas cursos concluídos (progresso >= 100%)
        const completed = allAvailableCourses.filter((course) => {
          const completedCount = progressList.filter(
            (p: any) => p.courseId === course._id && p.status === "completed"
          ).length;
          const denom = course.lessonsCount > 0 ? course.lessonsCount : 3;
          return completedCount >= denom;
        });

        setCompletedCourses(completed);
      } catch (err) {
        console.error("Erro ao ler dados de reciclagem:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadRecyclingData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
        <span className="text-sm font-semibold">A carregar registos de reciclagem...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <RefreshCw className="h-7 w-7 text-emerald-400" />
          Reciclagem de Cursos
        </h1>
        <p className="text-sm text-slate-400">
          Permite ver os cursos que já foram efetuados por este utilizador.
        </p>
      </div>

      {/* Explanatory Info Box */}
      <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-3xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
          <Info className="h-5 w-5" />
          Como funciona a Reciclagem na MOZAI?
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Como aluno da Mozai, podes assistir gratuitamente a novas edições dos cursos que já concluíste. 
          A reciclagem permite-te rever conteúdos e acompanhar actualizações, sem custos adicionais.
        </p>
        <div className="flex items-center gap-2 text-amber-500 text-xs font-semibold pt-2 border-t border-emerald-500/10">
          <ShieldAlert className="h-4 w-4" />
          Nota: As inscrições de reciclagem não incluem nova emissão de diploma.
        </div>
      </div>

      {/* Completed Courses List */}
      <section className="space-y-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Award className="h-5 w-5 text-indigo-400" />
          Os Meus Cursos Concluídos Disponíveis ({completedCourses.length})
        </h2>

        {completedCourses.length === 0 ? (
          <div className="border border-slate-900 border-dashed rounded-3xl p-12 text-center text-slate-500 text-xs">
            Ainda não concluíste nenhum curso a 100%. Conclui um dos teus cursos ativos para o disponibilizar para reciclagem gratuita.
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            {completedCourses.map((course) => (
              <div
                key={course._id}
                className="border border-slate-900 bg-slate-950/40 rounded-3xl overflow-hidden hover:border-slate-800 transition-all flex flex-col justify-between group shadow-xl"
              >
                {/* Cover Gradient */}
                <div className={`h-40 bg-gradient-to-br ${course.gradient} p-6 flex flex-col justify-between relative`}>
                  <div className="absolute inset-0 bg-black/10" />
                  <span className="relative z-10 self-start text-[10px] font-semibold px-2.5 py-1 rounded-full bg-black/30 backdrop-blur-md text-white border border-white/10">
                    {course.category}
                  </span>
                  
                  <span className="relative z-10 self-end text-[10px] font-bold px-3 py-1 rounded-lg bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 text-emerald-400">
                    Reciclagem Disponível
                  </span>
                </div>

                {/* Details */}
                <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <h3 className="font-bold text-base text-white group-hover:text-indigo-400 transition-colors line-clamp-1">
                      {course.title}
                    </h3>
                    <p className="text-slate-400 text-xs leading-relaxed line-clamp-3">
                      {course.description}
                    </p>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-900/60">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{course.duration}</span>
                      <span>{course.lessonsCount} lições</span>
                    </div>

                    <Link
                      href={`/dashboard/courses/${course._id}/lessons/lesson-1-1`}
                      className="w-full inline-flex items-center justify-center h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white transition-all gap-1.5 cursor-pointer hover:bg-emerald-600 hover:text-white"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Refazer Lições (Reciclar)
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
