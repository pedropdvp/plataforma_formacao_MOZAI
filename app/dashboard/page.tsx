import React from "react";
import { headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { BookOpen, Award, Clock } from "lucide-react";
import CoursesGrid from "@/components/courses-grid";
import { getDb } from "@/lib/mongodb";
import { sanityClient } from "@/lib/sanity";

// Nº de lições por curso: cursos reais do Sanity + fallback dos cursos-demo
const DEMO_LESSON_COUNTS: Record<string, number> = { "course-1": 3, "course-2": 3, "course-3": 3 };
const COURSE_COUNTS_QUERY = `*[_type == "course"]{ _id, "lessonsCount": count(modules[]->lessons[]) }`;

export default async function DashboardPage() {
  const headersList = await headers();
  const tenantId = headersList.get("x-tenant-id") || "root";

  // 1. Obter utilizador Clerk autenticado
  const { userId } = await auth();

  // Valores padrão para o estado vazio/fallback
  let coursesInProgressCount = 0;
  let formattedWatchTime = "0m";
  let completedCoursesCount = 0;

  if (userId) {
    try {
      const db = await getDb();

      // Buscar todos os progressos do estudante no tenant
      const progressList = await db
        .collection("user_progress")
        .find({
          tenant_id: tenantId,
          userId: userId,
        })
        .toArray();

      // Mapa de total de lições por curso: cursos reais do Sanity + fallback demos
      const lessonCounts: Record<string, number> = { ...DEMO_LESSON_COUNTS };
      try {
        const sanityCourses: any[] = await sanityClient.fetch(COURSE_COUNTS_QUERY);
        for (const c of sanityCourses || []) {
          lessonCounts[c._id] = c.lessonsCount || 0;
        }
      } catch (sanityErr) {
        console.warn("Falha ao ler contagem de lições do Sanity, usando fallback:", sanityErr);
      }

      // Denominador de lições de um curso (fallback 3 se desconhecido)
      const totalLessons = (courseId: string) => lessonCounts[courseId] || 3;

      // Lições concluídas por curso
      const completedByCourse = (courseId: string) =>
        progressList.filter((p: any) => p.courseId === courseId && p.status === "completed").length;

      const uniqueCourses = Array.from(new Set(progressList.map((p: any) => p.courseId))) as string[];

      // Curso em progresso: iniciado mas ainda sem todas as lições concluídas
      coursesInProgressCount = uniqueCourses.filter((courseId) => {
        const started = progressList.filter((p: any) => p.courseId === courseId).length > 0;
        return started && completedByCourse(courseId) < totalLessons(courseId);
      }).length;

      // Certificados: cursos com TODAS as lições concluídas (com base no total real)
      completedCoursesCount = uniqueCourses.filter((courseId) => {
        const total = totalLessons(courseId);
        return total > 0 && completedByCourse(courseId) >= total;
      }).length;

      // Tempo assistido (soma do watchTime de todas as lições em segundos)
      const totalWatchTimeSeconds = progressList.reduce(
        (acc: number, curr: any) => acc + (curr.watchTime || 0),
        0
      );
      const watchTimeHours = Math.floor(totalWatchTimeSeconds / 3600);
      const watchTimeMinutes = Math.floor((totalWatchTimeSeconds % 3600) / 60);
      formattedWatchTime = watchTimeHours > 0
        ? `${watchTimeHours}h ${watchTimeMinutes}m`
        : `${watchTimeMinutes}m`;
    } catch (error) {
      console.warn("Falha ao ler estatísticas reais do MongoDB, usando fallback:", error);
    }
  }

  return (
    <div className="space-y-10">
      {/* Welcome Banner */}
      <section className="relative rounded-3xl overflow-hidden border border-slate-900 bg-slate-900/20 p-8 md:p-10">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-transparent to-transparent" />
        <div className="relative z-10 space-y-4 max-w-2xl">
          <h1 className="text-3xl font-extrabold text-white">
            Bem-vindo ao seu dashboard de aprendizagem! (V2)
          </h1>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed">
            Aqui pode continuar os seus cursos técnicos, consultar o seu Grafo de Competências e conversar com o seu Tutor de IA contextual.
          </p>
        </div>
      </section>

      {/* Stats Quick Grid */}
      <section className="flex flex-row gap-4">
        <div className="border border-slate-900 bg-[#070b13] rounded-2xl pl-4 pr-5 py-4 flex items-center gap-3 w-fit flex-shrink-0">
          <div className="h-12 w-12 rounded-xl bg-[#0d1527] border border-indigo-500/10 flex items-center justify-center text-indigo-400 flex-shrink-0">
            <BookOpen className="h-5.5 w-5.5" />
          </div>
          <div className="space-y-0.5">
            <span className="block text-2xl font-extrabold text-white leading-none">
              {coursesInProgressCount}
            </span>
            <span className="block text-xs text-slate-500 font-medium">Cursos em Progresso</span>
          </div>
        </div>

        <div className="border border-slate-900 bg-[#070b13] rounded-2xl pl-4 pr-5 py-4 flex items-center gap-3 w-fit flex-shrink-0">
          <div className="h-12 w-12 rounded-xl bg-[#0d1527] border border-cyan-500/10 flex items-center justify-center text-cyan-400 flex-shrink-0">
            <Clock className="h-5.5 w-5.5" />
          </div>
          <div className="space-y-0.5">
            <span className="block text-2xl font-extrabold text-white leading-none">
              {formattedWatchTime}
            </span>
            <span className="block text-xs text-slate-500 font-medium">Tempo de Estudo Assistido</span>
          </div>
        </div>

        <div className="border border-slate-900 bg-[#070b13] rounded-2xl pl-4 pr-5 py-4 flex items-center gap-3 w-fit flex-shrink-0">
          <div className="h-12 w-12 rounded-xl bg-[#0d1527] border border-emerald-500/10 flex items-center justify-center text-emerald-450 flex-shrink-0">
            <Award className="h-5.5 w-5.5" />
          </div>
          <div className="space-y-0.5">
            <span className="block text-2xl font-extrabold text-white leading-none">
              {completedCoursesCount}
            </span>
            <span className="block text-xs text-slate-500 font-medium">Certificado Emitido</span>
          </div>
        </div>
      </section>

      {/* Courses Grid section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Os Meus Cursos</h2>
          <span className="text-xs text-slate-500">Filtrado por tenant: {tenantId}</span>
        </div>

        <CoursesGrid tenantId={tenantId} />
      </section>
    </div>
  );
}
