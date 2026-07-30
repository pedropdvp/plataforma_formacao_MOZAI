import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { sanityClient } from "@/lib/sanity";
import { computeSkillNodes, ScoredSkillNode } from "@/lib/skills-os";
import { computeLearningSignals } from "@/lib/adaptive-learning";

const CURATED_COURSE_IDS = new Set(["course-1", "course-2", "course-3", "course-4", "course-criptomoedas-n1"]);
const COURSE_COUNTS_QUERY = `*[_type == "course"]{ _id, title, "lessonsCount": count(modules[]->lessons[]) }`;

// GET — Grafo de Competências com pontuação contínua real: os nós curados (cursos-demo)
// derivam a pontuação da média real de quiz da lição associada, com decaimento por
// inatividade; os nós dinâmicos (qualquer outro curso real do catálogo) usam a mesma
// lógica de decaimento, a partir da média de quiz do curso ou, na sua falta, da
// percentagem de lições concluídas.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const [progressList, quizAttempts, signals] = await Promise.all([
      db.collection("user_progress").find({ tenant_id: tenantId, userId }).toArray(),
      db.collection("quiz_attempts").find({ tenant_id: tenantId, userId }).toArray(),
      computeLearningSignals(tenantId, userId),
    ]);

    const nodes: ScoredSkillNode[] = computeSkillNodes(progressList, quizAttempts);

    // Cobertura dinâmica: qualquer curso real fora da lista curada gera o seu próprio nó,
    // com a mesma lógica de pontuação contínua (quiz real > % de lições > decaimento).
    try {
      const catalog: Record<string, { title: string; lessonsCount: number }> = {};
      try {
        const sanityCourses: any[] = await sanityClient.fetch(COURSE_COUNTS_QUERY);
        for (const c of sanityCourses || []) catalog[c._id] = { title: c.title, lessonsCount: c.lessonsCount || 0 };
      } catch (e) {
        console.warn("Falha ao ler catálogo do Sanity para o Skills OS:", e);
      }
      try {
        const aiCourses = await db.collection("courses").find({ tenant_id: tenantId }).toArray();
        for (const c of aiCourses) {
          const lessonsCount = (c.modules || []).reduce((acc: number, m: any) => acc + (m.lessons || []).length, 0);
          catalog[c._id.toString()] = { title: c.title, lessonsCount };
        }
      } catch (e) {
        console.warn("Falha ao ler cursos IA para o Skills OS:", e);
      }

      const now = Date.now();
      Object.entries(catalog)
        .filter(([courseId]) => !CURATED_COURSE_IDS.has(courseId))
        .forEach(([courseId, course]) => {
          const courseQuizAttempts = quizAttempts.filter((a: any) => a.courseId === courseId);
          const completedCount = progressList.filter((p: any) => p.courseId === courseId && p.status === "completed").length;
          const denom = course.lessonsCount > 0 ? course.lessonsCount : 1;

          let baseScore: number;
          let lastActivityMs: number | null = null;

          if (courseQuizAttempts.length > 0) {
            const avg = courseQuizAttempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / courseQuizAttempts.length;
            baseScore = Math.round(avg * 100);
            lastActivityMs = Math.max(...courseQuizAttempts.map((a: any) => new Date(a.timestamp).getTime()));
          } else {
            baseScore = Math.min(Math.round((completedCount / denom) * 100), 100);
            const courseProgress = progressList.filter((p: any) => p.courseId === courseId);
            if (courseProgress.length > 0) {
              lastActivityMs = Math.max(...courseProgress.map((p: any) => new Date(p.updatedAt || p.completedAt || now).getTime()));
            }
          }

          const daysSinceActivity = lastActivityMs ? Math.floor((now - lastActivityMs) / (24 * 60 * 60 * 1000)) : null;
          const decay = daysSinceActivity !== null && daysSinceActivity > 30 ? Math.min(30, daysSinceActivity - 30) : 0;
          const score = Math.max(0, Math.min(100, baseScore - decay));
          const level = score === 0 ? "Bloqueado" : score < 40 ? "Iniciado" : score < 70 ? "Básico" : score < 90 ? "Intermédio" : "Avançado";

          nodes.push({
            id: courseId,
            label: course.title,
            score,
            type: "Curso",
            level,
            connections: [],
            daysSinceActivity,
          });
        });
    } catch (e) {
      console.warn("Falha ao gerar nós dinâmicos do Skills OS:", e);
    }

    return NextResponse.json({
      success: true,
      nodes,
      retentionPct: signals.retentionPct,
      velocityPct: signals.velocityPct,
    });
  } catch (error: any) {
    console.error("Erro ao calcular o Grafo de Competências:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
