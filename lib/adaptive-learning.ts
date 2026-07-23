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
