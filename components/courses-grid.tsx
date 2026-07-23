"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Play, Clock, ArrowRight, Award, Compass, LayoutGrid, Loader2 } from "lucide-react";

interface Course {
  _id: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  lessonsCount: number;
  progress: number;
  gradient: string;
  firstLesson?: string;
}

// Gradientes atribuídos ciclicamente aos cursos vindos do Sanity
const GRADIENTS = [
  "from-violet-500 to-indigo-500",
  "from-purple-500 to-pink-500",
  "from-indigo-500 to-cyan-500",
  "from-cyan-500 to-emerald-500",
  "from-amber-500 to-rose-500",
  "from-emerald-500 to-teal-500",
];

const ALL_COURSES: Course[] = [
  {
    _id: "course-1",
    title: "Engenharia de IA e RAG Avançado",
    description: "Domine a integração de LLMs, chunking semântico, embeddings vetoriais e orquestração de agentes com LangChain e Vercel AI SDK.",
    category: "Inteligência Artificial",
    duration: "24h de conteúdo",
    lessonsCount: 18,
    progress: 0, // Carregado dinamicamente
    gradient: "from-violet-500 to-indigo-500",
  },
  {
    _id: "course-2",
    title: "Next.js 16 e Arquiteturas Composable SaaS",
    description: "Construa aplicações SaaS escaláveis utilizando Next.js 16 App Router, Clerk auth, WorkOS SSO, Sanity CMS e Stripe Connect.",
    category: "Programação / Frontend",
    duration: "18h de conteúdo",
    lessonsCount: 14,
    progress: 0, // Carregado dinamicamente
    gradient: "from-indigo-500 to-cyan-500",
  },
  {
    _id: "course-3",
    title: "Smart Contracts e Criptografia com Solidity",
    description: "Crie tokens ERC-20, NFTs dinâmicos, contratos seguros de DeFi e explore o desenvolvimento na blockchain Ethereum e Polygon.",
    category: "Crypto & Blockchain",
    duration: "30h de conteúdo",
    lessonsCount: 22,
    progress: 0, // Carregado dinamicamente
    gradient: "from-cyan-500 to-emerald-500",
  },
];

// Converte um curso do Sanity num card do grid
function mapSanityCourse(c: any, i: number): Course {
  const mins = typeof c.minutes === "number" ? c.minutes : 0;
  const duration = mins >= 60 ? `${Math.round(mins / 60)}h de conteúdo` : mins > 0 ? `${mins}m de conteúdo` : "Conteúdo estruturado";
  return {
    _id: c._id,
    title: c.title,
    description: c.description || "",
    category: c.category || "Formação",
    duration,
    lessonsCount: c.lessonsCount || 0,
    progress: 0,
    gradient: GRADIENTS[i % GRADIENTS.length],
    firstLesson: c.firstLesson || undefined,
  };
}

export default function CoursesGrid({ tenantId }: { tenantId: string }) {
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [courses, setCourses] = useState<Course[]>(ALL_COURSES);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar cursos reais do Sanity + progresso e fundir com os demos
  useEffect(() => {
    async function loadCourses() {
      try {
        const [catalogRes, progressRes] = await Promise.all([
          fetch("/api/catalog"),
          fetch("/api/progress"),
        ]);

        // Cursos reais do Sanity (primeiro) + demos que não existam no Sanity
        let merged: Course[] = ALL_COURSES;
        if (catalogRes.ok) {
          const data = await catalogRes.json();
          const real: Course[] = (data.courses || []).map(mapSanityCourse);
          if (real.length > 0) {
            const realIds = new Set(real.map((c) => c._id));
            merged = [...real, ...ALL_COURSES.filter((c) => !realIds.has(c._id))];
          }
        }

        // Aplicar progresso real (lições concluídas / total de lições do curso)
        let progressList: any[] = [];
        if (progressRes.ok) {
          const pdata = await progressRes.json();
          progressList = pdata.progress || [];
        }

        const withProgress = merged.map((course) => {
          const completedCount = progressList.filter(
            (p: any) => p.courseId === course._id && p.status === "completed"
          ).length;
          const denom = course.lessonsCount > 0 ? course.lessonsCount : 3;
          const pct = Math.round((completedCount / denom) * 100);
          return { ...course, progress: Math.min(pct, 100) };
        });

        setCourses(withProgress);
      } catch (err) {
        console.error("Erro ao carregar cursos no grid:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadCourses();
  }, []);

  // Categorias derivadas dinamicamente dos cursos disponíveis
  const categories = ["Todos", ...Array.from(new Set(courses.map((c) => c.category)))];

  // Filtrar cursos por categoria selecionada
  const filteredCourses = courses.filter(
    (c) => selectedCategory === "Todos" || c.category === selectedCategory
  );

  // Separar os cursos filtrados por estado de progresso
  const inProgressCourses = filteredCourses.filter((c) => c.progress > 0 && c.progress < 100);
  const completedCourses = filteredCourses.filter((c) => c.progress === 100);
  const toStartCourses = filteredCourses.filter((c) => c.progress === 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
        <span className="text-xs font-semibold">A sincronizar a sua sala de aula...</span>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-900">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 h-9 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              selectedCategory === cat
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                : "bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-900"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 1. Cursos em Progresso */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Compass className="h-5 w-5 text-indigo-400" />
            Cursos em Progresso ({inProgressCourses.length})
          </h2>
          {selectedCategory !== "Todos" && (
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">
              Categoria: {selectedCategory}
            </span>
          )}
        </div>

        {inProgressCourses.length === 0 ? (
          <div className="p-8 text-center border border-slate-900 border-dashed rounded-3xl text-xs text-slate-500">
            Nenhum curso em progresso nesta categoria.
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            {inProgressCourses.map((course) => (
              <CourseCard key={course._id} course={course} onCategoryClick={setSelectedCategory} />
            ))}
          </div>
        )}
      </section>

      {/* 2. Cursos Concluídos */}
      <section className="space-y-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Award className="h-5 w-5 text-emerald-400" />
          Cursos Concluídos ({completedCourses.length})
        </h2>

        {completedCourses.length === 0 ? (
          <div className="p-8 text-center border border-slate-900 border-dashed rounded-3xl text-xs text-slate-500">
            Nenhum curso concluído nesta categoria.
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            {completedCourses.map((course) => (
              <CourseCard key={course._id} course={course} onCategoryClick={setSelectedCategory} />
            ))}
          </div>
        )}
      </section>

      {/* 3. Cursos a Efetuar */}
      <section className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-cyan-400" />
            Cursos a Efetuar
          </h2>
          <span className="text-xs text-slate-500 mt-1 block">
            Subscrição Ativa: <span className="font-semibold text-indigo-400">MOZAI – Basic</span>
          </span>
        </div>

        {toStartCourses.length === 0 ? (
          <div className="p-8 text-center border border-slate-900 border-dashed rounded-3xl text-xs text-slate-500">
            Nenhum curso a efetuar nesta categoria sob a subscrição Basic.
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            {toStartCourses.map((course) => (
              <CourseCard key={course._id} course={course} onCategoryClick={setSelectedCategory} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CourseCard({ course, onCategoryClick }: { course: Course; onCategoryClick: (cat: string) => void }) {
  const courseUrl = `/dashboard/courses/${course._id}/lessons/${course.firstLesson || "lesson-1-1"}`;
  
  return (
    <div className="border border-slate-900 bg-slate-950/40 rounded-3xl overflow-hidden hover:border-slate-800 transition-all flex flex-col justify-between group shadow-xl">
      {/* Clicar em qualquer parte superior do card redireciona para o curso */}
      <Link href={courseUrl} className="flex-1 flex flex-col cursor-pointer">
        {/* Cover Graphic */}
        <div className={`h-40 bg-gradient-to-br ${course.gradient} p-6 flex flex-col justify-between relative`}>
          <div className="absolute inset-0 bg-black/10" />
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation(); // Evitar navegação ao clicar na tag da categoria
              onCategoryClick(course.category);
            }}
            className="relative z-10 self-start text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-600 text-white border border-white/10 hover:bg-slate-200 hover:text-indigo-700 transition-colors cursor-pointer"
          >
            {course.category}
          </button>
          
          {/* Triângulo de play sempre visível em hover, ou fixo se em progresso */}
          <div className={`relative z-10 self-end p-2.5 rounded-full bg-white/20 backdrop-blur-md text-white transition-all group-hover:scale-110 group-hover:bg-indigo-600 shadow-lg shadow-indigo-500/20`}>
            <Play className="h-4.5 w-4.5 fill-white text-white" />
          </div>
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

          <div className="space-y-4 pt-4 border-t border-slate-900/60 w-full">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {course.duration}
              </span>
              <span>{course.lessonsCount} lições</span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500">Progresso</span>
                <span className="text-slate-350">{course.progress}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${course.progress}%` }}
                />
              </div>
            </div>

            <div className="w-full inline-flex items-center justify-center h-10 rounded-xl bg-indigo-600 text-xs font-semibold text-white transition-all group-hover:bg-slate-200 group-hover:text-indigo-700">
              {course.progress === 100
                ? "Rever Conteúdo"
                : course.progress > 0
                ? "Continuar Estudo"
                : "Começar Curso"}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
