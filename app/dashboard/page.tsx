import React from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import {
  Star,
  Zap,
  Trophy,
  Medal,
  Award,
  GraduationCap,
  Compass,
  LayoutGrid,
  BookOpen,
  CheckCircle2,
  Flame,
} from "lucide-react";
import { getDb } from "@/lib/mongodb";
import { sanityClient } from "@/lib/sanity";
import GreetingText from "@/components/greeting-text";
import DashboardCharts from "@/components/dashboard-charts";
import { getGamificationLevels, computeLevelInfo } from "@/lib/gamification-levels";

// Nº de lições + título por curso: cursos reais do Sanity + fallback dos cursos-demo
const DEMO_COURSES: Record<string, { title: string; lessonsCount: number }> = {
  "course-1": { title: "Engenharia de IA e RAG Avançado", lessonsCount: 3 },
  "course-2": { title: "Next.js 16 e Arquiteturas Composable SaaS", lessonsCount: 3 },
  "course-3": { title: "Smart Contracts e Criptografia com Solidity", lessonsCount: 3 },
};
const COURSE_COUNTS_QUERY = `*[_type == "course"]{ _id, title, "lessonsCount": count(modules[]->lessons[]) }`;

export default async function DashboardPage() {
  const headersList = await headers();
  const tenantId = headersList.get("x-tenant-id") || "root";

  const { userId } = await auth();

  // Valores padrão para o estado vazio/fallback
  let studentName = "Aluno";
  let xp = 0;
  let streak = 0;
  let badgesCount = 0;
  let rank = 0;
  let totalRankedStudents = 0;
  let coursesInProgressCount = 0;
  let completedCoursesCount = 0;
  let suggestedCoursesCount = 0;
  let aulasEfetuadas = 0;
  let aulasConcluidas = 0;
  let courseProgressData: { name: string; progresso: number }[] = [];

  if (userId) {
    try {
      const db = await getDb();

      // 1. Nome do aluno
      const userRecord = await db.collection("users").findOne({ _id: userId });
      if (userRecord) {
        studentName = `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || "Aluno";
      }

      // 2. Perfil de gamificação (XP, nível, streak, badges) + ranking no tenant
      const profile = await db.collection("gamification_profiles").findOne({ _id: userId });
      xp = profile?.xp || 0;
      streak = profile?.streak || 0;
      badgesCount = profile?.badges?.length || 0;

      const rankedProfiles = await db
        .collection("gamification_profiles")
        .find({ tenant_id: tenantId })
        .sort({ xp: -1 })
        .toArray();
      totalRankedStudents = rankedProfiles.length;
      const rankIndex = rankedProfiles.findIndex((p: any) => p._id === userId);
      rank = rankIndex >= 0 ? rankIndex + 1 : totalRankedStudents + 1;

      // 3. Progresso de cursos e lições
      const progressList = await db
        .collection("user_progress")
        .find({ tenant_id: tenantId, userId })
        .toArray();

      // Catálogo real (Sanity) + cursos gerados por IA (Mongo) + fallback demos, para saber
      // título/total de lições de cada curso — sem isto, o gráfico de progresso mostrava o
      // ObjectId em bruto como nome de um curso gerado por IA (não estava no Sanity nem nos demos).
      const courseCatalog: Record<string, { title: string; lessonsCount: number }> = { ...DEMO_COURSES };
      try {
        const sanityCourses: any[] = await sanityClient.fetch(COURSE_COUNTS_QUERY);
        for (const c of sanityCourses || []) {
          courseCatalog[c._id] = { title: c.title, lessonsCount: c.lessonsCount || 0 };
        }
      } catch (sanityErr) {
        console.warn("Falha ao ler catálogo do Sanity, usando fallback:", sanityErr);
      }
      try {
        const aiCourses = await db.collection("courses").find({ tenant_id: tenantId }).toArray();
        for (const c of aiCourses) {
          const lessonsCount = (c.modules || []).reduce((acc: number, m: any) => acc + (m.lessons || []).length, 0);
          courseCatalog[c._id.toString()] = { title: c.title, lessonsCount };
        }
      } catch (aiErr) {
        console.warn("Falha ao ler cursos gerados por IA para o catálogo do dashboard:", aiErr);
      }

      const totalLessons = (courseId: string) => courseCatalog[courseId]?.lessonsCount || 3;
      const completedByCourse = (courseId: string) =>
        progressList.filter((p: any) => p.courseId === courseId && p.status === "completed").length;

      const uniqueCourses = Array.from(new Set(progressList.map((p: any) => p.courseId))) as string[];

      coursesInProgressCount = uniqueCourses.filter((courseId) => {
        const started = progressList.filter((p: any) => p.courseId === courseId).length > 0;
        return started && completedByCourse(courseId) < totalLessons(courseId);
      }).length;

      completedCoursesCount = uniqueCourses.filter((courseId) => {
        const total = totalLessons(courseId);
        return total > 0 && completedByCourse(courseId) >= total;
      }).length;

      const totalCoursesCount = Object.keys(courseCatalog).length;
      suggestedCoursesCount = Math.max(totalCoursesCount - coursesInProgressCount - completedCoursesCount, 0);

      aulasEfetuadas = progressList.length;
      aulasConcluidas = progressList.filter((p: any) => p.status === "completed").length;

      // Gráfico de progresso: só cursos que o aluno já começou
      courseProgressData = uniqueCourses.map((courseId) => {
        const total = totalLessons(courseId);
        const pct = total > 0 ? Math.round((completedByCourse(courseId) / total) * 100) : 0;
        const title = courseCatalog[courseId]?.title || courseId;
        return {
          name: title.length > 22 ? `${title.slice(0, 22)}…` : title,
          progresso: Math.min(pct, 100),
        };
      });
    } catch (error) {
      console.warn("Falha ao ler estatísticas reais do MongoDB, usando fallback:", error);
    }
  }

  const levels = await getGamificationLevels();
  const levelInfo = computeLevelInfo(xp, levels);
  const tierName = levelInfo.name;
  const xpRemaining = levelInfo.pointsRemaining;
  const levelProgressPct = Math.round(levelInfo.progressPct);

  const statusChartData = [
    { name: "Concluídos", valor: completedCoursesCount },
    { name: "Em Progresso", valor: coursesInProgressCount },
    { name: "Certificados", valor: completedCoursesCount },
    { name: "Diplomas", valor: completedCoursesCount },
  ];

  const activityButtons = [
    {
      href: "/dashboard/my-courses#cursos-em-progresso",
      label: "Cursos Ativos",
      count: coursesInProgressCount,
      icon: Compass,
      color: "text-indigo-400 border-indigo-500/10 bg-[#0d1527]",
    },
    {
      href: "/dashboard/my-courses#cursos-concluidos",
      label: "Cursos Concluídos",
      count: completedCoursesCount,
      icon: Award,
      color: "text-emerald-400 border-emerald-500/10 bg-[#0d1527]",
    },
    {
      href: "/dashboard/my-courses#cursos-a-efetuar",
      label: "Cursos Sugeridos",
      count: suggestedCoursesCount,
      icon: LayoutGrid,
      color: "text-cyan-400 border-cyan-500/10 bg-[#0d1527]",
    },
    {
      href: "/dashboard/personal/progress",
      label: "Aulas Efetuadas",
      count: aulasEfetuadas,
      icon: BookOpen,
      color: "text-violet-400 border-violet-500/10 bg-[#0d1527]",
    },
    {
      href: "/dashboard/personal/progress",
      label: "Aulas Concluídas",
      count: aulasConcluidas,
      icon: CheckCircle2,
      color: "text-emerald-400 border-emerald-500/10 bg-[#0d1527]",
    },
    {
      href: "/dashboard/gamification",
      label: "Ranking",
      count: `#${rank}`,
      icon: Trophy,
      color: "text-amber-400 border-amber-500/10 bg-[#0d1527]",
    },
    {
      href: "/dashboard/gamification",
      label: "Streak",
      count: streak,
      icon: Flame,
      color: "text-orange-400 border-orange-500/10 bg-[#0d1527]",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Card do Aluno */}
      <section className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 md:p-8 space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">
            <GreetingText />, {studentName}
          </h1>
          <p className="text-xs text-slate-500 mt-1">Aqui está o resumo da sua evolução na MOZAI.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatTile icon={Star} label="Nível" value={tierName} color="text-indigo-400 border-indigo-500/10" />
          <StatTile icon={Zap} label="MZ Total" value={xp} color="text-amber-400 border-amber-500/10" />
          <StatTile icon={Trophy} label="Ranking" value={`#${rank}`} color="text-amber-400 border-amber-500/10" />
          <StatTile icon={Medal} label="Badges" value={badgesCount} color="text-violet-400 border-violet-500/10" />
          <StatTile icon={Award} label="Certificados" value={completedCoursesCount} color="text-emerald-400 border-emerald-500/10" />
          <StatTile icon={GraduationCap} label="Diplomas" value={completedCoursesCount} color="text-cyan-400 border-cyan-500/10" />
        </div>

        <div className="space-y-2 pt-2 border-t border-slate-900">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-300">{tierName}</span>
            <span className="text-slate-500">
              {levelInfo.isMaxLevel ? "Nível máximo atingido" : `${xpRemaining} MZ restantes para o próximo nível`}
            </span>
          </div>
          <div className="h-2 w-full bg-slate-900 rounded-full border border-slate-800 overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${levelProgressPct}%` }}
            />
          </div>
        </div>
      </section>

      {/* Card de Atividade — botões com contadores */}
      <section className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 md:p-8 space-y-4">
        <h2 className="text-sm font-bold text-white">A Minha Atividade</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {activityButtons.map((btn) => (
            <Link
              key={btn.label}
              href={btn.href}
              className={`flex items-center gap-3 border rounded-2xl px-4 py-3.5 hover:border-slate-700 transition-colors ${btn.color}`}
            >
              <btn.icon className="h-5 w-5 flex-shrink-0" />
              <div className="min-w-0">
                <span className="block text-lg font-extrabold text-white leading-none">{btn.count}</span>
                <span className="block text-[11px] text-slate-400 font-medium mt-1 truncate">{btn.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Card de Gráficos */}
      <section className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 md:p-8 space-y-6">
        <h2 className="text-sm font-bold text-white">Progresso e Estado Geral</h2>
        <DashboardCharts courseProgressData={courseProgressData} statusChartData={statusChartData} />
      </section>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className={`border rounded-2xl p-3.5 bg-[#070b13] ${color}`}>
      <Icon className="h-4 w-4 mb-2" />
      <span className="block text-lg font-extrabold text-white leading-none truncate">{value}</span>
      <span className="block text-[10px] text-slate-500 font-medium mt-1 uppercase tracking-wide">{label}</span>
    </div>
  );
}
