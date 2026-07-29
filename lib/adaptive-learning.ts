import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/**
 * Dificuldade adaptativa ao nível da lição/tópico (não por pergunta individual).
 *
 * As perguntas de quiz são identificadas hoje só pelo texto (sem questionId estável)
 * e não têm campo de dificuldade — construir um motor adaptativo por pergunta exigiria
 * reescrever o modelo de dados do quiz. Em vez disso, esta função usa o que já existe
 * e é fiável: `quiz_attempts.score` (0..1) por tentativa, agregado por lição, para
 * identificar em que lições o aluno tem tido pior desempenho real.
 */

export interface WeakArea {
  courseId: string;
  lessonId: string;
  courseTitle: string;
  lessonTitle: string;
  lessonSlug: string;
  avgScore: number;
  attemptsCount: number;
}

const WEAK_SCORE_THRESHOLD = 0.7;

export async function getWeakAreas(tenantId: string, userId: string, limit = 3): Promise<WeakArea[]> {
  const db = await getDb();

  const attempts = await db
    .collection("quiz_attempts")
    .find({ tenant_id: tenantId, userId })
    .toArray();

  if (attempts.length === 0) return [];

  const byLesson = new Map<string, { courseId: string; lessonId: string; scoreSum: number; count: number }>();
  for (const att of attempts) {
    if (!att.courseId || !att.lessonId) continue;
    const key = `${att.courseId}::${att.lessonId}`;
    const entry = byLesson.get(key) || { courseId: att.courseId, lessonId: att.lessonId, scoreSum: 0, count: 0 };
    entry.scoreSum += att.score || 0;
    entry.count += 1;
    byLesson.set(key, entry);
  }

  const weak = Array.from(byLesson.values())
    .map((e) => ({ ...e, avgScore: e.scoreSum / e.count }))
    .filter((e) => e.avgScore < WEAK_SCORE_THRESHOLD)
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, limit);

  if (weak.length === 0) return [];

  // Resolver título/slug reais da lição a partir dos cursos gerados por IA (MongoDB).
  const objectIds = Array.from(new Set(weak.map((w) => w.courseId)))
    .map((id) => {
      try {
        return new ObjectId(id);
      } catch {
        return null;
      }
    })
    .filter((id): id is ObjectId => id !== null);

  const courses = objectIds.length > 0 ? await db.collection("courses").find({ _id: { $in: objectIds } }).toArray() : [];
  const courseById = new Map<string, any>(courses.map((c: any) => [c._id.toString(), c]));

  return weak.map((w) => {
    const course = courseById.get(w.courseId);
    let lessonTitle = "Lição";
    let lessonSlug = w.lessonId;

    if (course) {
      for (const mod of course.modules || []) {
        const found = (mod.lessons || []).find((l: any) => l.id === w.lessonId || l.slug === w.lessonId);
        if (found) {
          lessonTitle = found.title;
          lessonSlug = found.slug || found.id;
          break;
        }
      }
    }

    return {
      courseId: w.courseId,
      lessonId: w.lessonId,
      courseTitle: course?.title || "Curso",
      lessonTitle,
      lessonSlug,
      avgScore: Math.round(w.avgScore * 100) / 100,
      attemptsCount: w.count,
    };
  });
}

/**
 * Sinais globais de aprendizagem (retenção, velocidade, tópicos de interesse/dificuldade
 * do Digital Twin) — a mesma computação usada em /api/progress, extraída para aqui para
 * ser partilhada com o motor de recomendações abaixo, sem duplicar lógica.
 */
export interface LearningSignals {
  retentionPct: number;
  velocityPct: number;
  topTopics: string[];
  difficultTopics: string[];
  complexityBreakdown: { baixa: number; media: number; alta: number };
}

export async function computeLearningSignals(tenantId: string, userId: string): Promise<LearningSignals> {
  const db = await getDb();

  // Retenção Pedagógica real: média de acerto (%) em todas as tentativas de quiz do utilizador
  let retentionPct = 0;
  try {
    const attempts = await db.collection("quiz_attempts").find({ tenant_id: tenantId, userId }).toArray();
    if (attempts.length > 0) {
      const avgScore = attempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / attempts.length;
      retentionPct = Math.round(avgScore * 100);
    }
  } catch (e) {
    console.warn("Erro ao calcular retenção pedagógica:", e);
  }

  // Velocidade de Execução real: ritmo de lições concluídas nos últimos 7 dias
  let velocityPct = 0;
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentCompletions = await db.collection("study_history").countDocuments({
      tenant_id: tenantId,
      userId,
      action: "completed_lesson",
      timestamp: { $gte: sevenDaysAgo },
    });
    // 5 lições concluídas numa semana = 100% (ritmo de referência)
    velocityPct = Math.min(100, Math.round((recentCompletions / 5) * 100));
  } catch (e) {
    console.warn("Erro ao calcular velocidade de execução:", e);
  }

  // Análise Cognitiva do Digital Twin: tópicos de interesse, complexidade e conceitos
  // onde o aluno revela mais dificuldade, com base na classificação feita pela IA
  // sobre cada pergunta colocada ao Tutor (ver app/api/chat/route.ts).
  let topTopics: string[] = [];
  let difficultTopics: string[] = [];
  const complexityBreakdown = { baixa: 0, media: 0, alta: 0 };
  try {
    const cognitiveLogs = await db.collection("cognitive_logs").find({ tenant_id: tenantId, userId }).toArray();

    const topicCounts: Record<string, number> = {};
    const confusionCounts: Record<string, number> = {};

    cognitiveLogs.forEach((log: any) => {
      // Formato atual: log.topic (string) + log.complexity + log.isConfusion.
      // Formato legado (antes da classificação por IA): log.topics (array de palavras-chave).
      if (log.topic) {
        topicCounts[log.topic] = (topicCounts[log.topic] || 0) + 1;
        if (log.complexity && log.complexity in complexityBreakdown) {
          complexityBreakdown[log.complexity as keyof typeof complexityBreakdown]++;
        }
        if (log.isConfusion) {
          confusionCounts[log.topic] = (confusionCounts[log.topic] || 0) + 1;
        }
      } else if (Array.isArray(log.topics)) {
        log.topics.forEach((topic: string) => {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        });
      }
    });

    topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([topic]) => topic)
      .slice(0, 5);

    difficultTopics = Object.entries(confusionCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([topic]) => topic)
      .slice(0, 5);
  } catch (e) {
    console.warn("Erro ao ler logs cognitivos para os sinais de aprendizagem:", e);
  }

  return { retentionPct, velocityPct, topTopics, difficultTopics, complexityBreakdown };
}

export interface AdaptiveRecommendation {
  id: string;
  type: "review" | "reinforce" | "pace" | "healthy";
  priority: "alta" | "media" | "baixa";
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}

export interface CourseProgressSummary {
  courseId: string;
  courseTitle: string;
  completedCount: number;
  totalLessons: number;
}

/**
 * Motor de recomendações de Adaptive Learning — Passo 1 (regras sobre retenção/
 * velocidade) + Passo 2 (áreas fracas por lição + tópicos de dificuldade do Digital
 * Twin). Sem modelo de recomendação real (Passo 3): só faz sentido com volume de dados
 * de utilização suficiente, por decisão de roadmap. Regras simples e explicáveis —
 * cada recomendação tem uma razão direta e auditável nos dados reais do aluno.
 */
export function buildAdaptiveRecommendations(
  signals: LearningSignals,
  weakAreas: WeakArea[],
  coursesInProgress: CourseProgressSummary[]
): AdaptiveRecommendation[] {
  const recommendations: AdaptiveRecommendation[] = [];
  const { retentionPct, velocityPct, difficultTopics } = signals;

  // Passo 2a (mais preciso) — áreas fracas por LIÇÃO real, calculadas a partir da nota
  // média de quiz de cada lição (getWeakAreas). Aponta diretamente para a lição em causa.
  weakAreas.slice(0, 2).forEach((w, i) => {
    recommendations.push({
      id: `review-weak-${i}`,
      type: "review",
      priority: "alta",
      title: `Reveja: ${w.lessonTitle}`,
      description: `Nota média de ${Math.round(w.avgScore * 100)}% nos quizzes desta lição de "${w.courseTitle}" (${w.attemptsCount} tentativa${w.attemptsCount > 1 ? "s" : ""}). Reveja o material antes de avançar para lições que dependem deste conceito.`,
      actionLabel: "Rever lição",
      actionHref: `/dashboard/courses/${w.courseId}/lessons/${w.lessonSlug}`,
    });
  });

  // Passo 1a (fallback) — retenção global baixa mas sem áreas fracas específicas
  // identificadas (ex: poucas tentativas, dispersas por muitas lições diferentes).
  if (recommendations.length === 0 && retentionPct > 0 && retentionPct < 60 && coursesInProgress.length > 0) {
    const target = [...coursesInProgress].sort((a, b) => b.completedCount - a.completedCount)[0];
    recommendations.push({
      id: "review-low-retention",
      type: "review",
      priority: "alta",
      title: "Reveja antes de avançar",
      description: `A sua retenção pedagógica está em ${retentionPct}% (média de acerto nos quizzes). Recomendamos rever as últimas lições de "${target.courseTitle}" antes de continuar para não acumular lacunas.`,
      actionLabel: "Rever curso",
      actionHref: `/dashboard/my-courses`,
    });
  }

  // Passo 2b — tópicos de dificuldade detetados pelo Digital Twin (perguntas ao Tutor de IA)
  difficultTopics.slice(0, 2).forEach((topic, i) => {
    recommendations.push({
      id: `reinforce-${i}-${topic}`,
      type: "reinforce",
      priority: "media",
      title: `Reforce: ${topic}`,
      description: `As suas perguntas ao Tutor de IA sobre "${topic}" indicam dificuldade neste conceito. Volte a perguntar ou reveja o material relacionado antes de avançar.`,
      actionLabel: "Perguntar ao Tutor",
      actionHref: `/dashboard/my-courses`,
    });
  });

  // Passo 1b — ritmo baixo mas com curso(s) em progresso: nudge suave, não bloqueante
  if (velocityPct < 20 && coursesInProgress.length > 0 && recommendations.length === 0) {
    const target = coursesInProgress[0];
    recommendations.push({
      id: "pace-nudge",
      type: "pace",
      priority: "baixa",
      title: "Continue o seu ritmo",
      description: `Já não concluiu nenhuma lição nos últimos 7 dias. Continue "${target.courseTitle}" para manter o seu progresso e streak.`,
      actionLabel: "Continuar curso",
      actionHref: `/dashboard/my-courses`,
    });
  }

  // Nenhum sinal de alerta: mensagem positiva em vez de painel vazio
  if (recommendations.length === 0) {
    recommendations.push({
      id: "healthy",
      type: "healthy",
      priority: "baixa",
      title: "Está tudo em dia!",
      description:
        coursesInProgress.length > 0
          ? `Sem lacunas detetadas. Continue "${coursesInProgress[0].courseTitle}" ao seu ritmo.`
          : "Sem lacunas detetadas. Explore o catálogo para começar um novo curso.",
      actionLabel: coursesInProgress.length > 0 ? "Continuar curso" : "Ver catálogo",
      actionHref: coursesInProgress.length > 0 ? "/dashboard/my-courses" : "/dashboard/catalog",
    });
  }

  return recommendations.slice(0, 4);
}
