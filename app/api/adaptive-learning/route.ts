import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { sanityClient } from "@/lib/sanity";
import { computeLearningSignals, getWeakAreas, buildAdaptiveRecommendations, CourseProgressSummary } from "@/lib/adaptive-learning";

export const runtime = "nodejs";

const DEMO_COURSES: Record<string, { title: string; lessonsCount: number }> = {
  "course-1": { title: "Engenharia de IA e RAG Avançado", lessonsCount: 3 },
  "course-2": { title: "Next.js 16 e Arquiteturas Composable SaaS", lessonsCount: 3 },
  "course-3": { title: "Smart Contracts e Criptografia com Solidity", lessonsCount: 3 },
};
const COURSE_COUNTS_QUERY = `*[_type == "course"]{ _id, title, "lessonsCount": count(modules[]->lessons[]) }`;

// GET — Recomendações de Percurso Adaptativo: combina sinais globais (retenção,
// velocidade, tópicos do Digital Twin) com áreas fracas por lição (quiz), para sugerir
// ao aluno o que rever ou reforçar antes de avançar — Passo 1 + Passo 2 do roadmap de
// Adaptive Learning (o Passo 3, um modelo de recomendação real, fica para quando houver
// volume de dados de utilização suficiente).
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const [signals, weakAreas, progressList] = await Promise.all([
      computeLearningSignals(tenantId, userId),
      getWeakAreas(tenantId, userId),
      db.collection("user_progress").find({ tenant_id: tenantId, userId }).toArray(),
    ]);

    // Catálogo (Sanity + cursos IA + fallback demos) para saber título/total de lições
    // de cada curso em progresso — mesma abordagem já usada no dashboard.
    const courseCatalog: Record<string, { title: string; lessonsCount: number }> = { ...DEMO_COURSES };
    try {
      const sanityCourses: any[] = await sanityClient.fetch(COURSE_COUNTS_QUERY);
      for (const c of sanityCourses || []) {
        courseCatalog[c._id] = { title: c.title, lessonsCount: c.lessonsCount || 0 };
      }
    } catch (e) {
      console.warn("Falha ao ler catálogo do Sanity para recomendações adaptativas:", e);
    }
    try {
      const aiCourses = await db.collection("courses").find({ tenant_id: tenantId }).toArray();
      for (const c of aiCourses) {
        const lessonsCount = (c.modules || []).reduce((acc: number, m: any) => acc + (m.lessons || []).length, 0);
        courseCatalog[c._id.toString()] = { title: c.title, lessonsCount };
      }
    } catch (e) {
      console.warn("Falha ao ler cursos IA para recomendações adaptativas:", e);
    }

    const completedByCourse = (courseId: string) =>
      progressList.filter((p: any) => p.courseId === courseId && p.status === "completed").length;

    const uniqueCourseIds = Array.from(new Set(progressList.map((p: any) => p.courseId))) as string[];
    const coursesInProgress: CourseProgressSummary[] = uniqueCourseIds
      .map((courseId) => {
        const totalLessons = courseCatalog[courseId]?.lessonsCount || 3;
        const completedCount = completedByCourse(courseId);
        return {
          courseId,
          courseTitle: courseCatalog[courseId]?.title || courseId,
          completedCount,
          totalLessons,
        };
      })
      .filter((c) => c.completedCount < c.totalLessons);

    const recommendations = buildAdaptiveRecommendations(signals, weakAreas, coursesInProgress);

    return NextResponse.json({ success: true, recommendations, signals });
  } catch (error: any) {
    console.error("Erro ao gerar recomendações de percurso adaptativo:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
