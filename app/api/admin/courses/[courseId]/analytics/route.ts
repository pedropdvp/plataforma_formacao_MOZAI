import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export const runtime = "nodejs";

/**
 * Analytics de um curso específico da Fábrica de Cursos — só números reais
 * (incluindo zero/vazio quando não há atividade). Ao contrário de
 * app/api/admin/reports/analytics/route.ts e teacher-dashboard/route.ts, esta
 * rota NÃO inventa dados de demonstração: mostrar dados falsos ao autor sobre
 * o seu próprio curso seria enganador.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value || "ALUNO";
    const allowedRoles = ["ADMIN", "GESTOR_EMPRESA", "GESTOR_ACADEMICO", "SUPORTE"];
    if (!allowedRoles.includes(activeRole)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { courseId } = await params;
    const tenantId = req.headers.get("x-tenant-id") || "root";

    const db = await getDb();
    let queryId: any = courseId;
    try {
      queryId = new ObjectId(courseId);
    } catch {}

    const course = await db.collection("courses").findOne({ _id: queryId, tenant_id: tenantId });
    if (!course) {
      return NextResponse.json({ error: "Curso não encontrado." }, { status: 404 });
    }

    const lessonMeta = (course.modules || []).flatMap((mod: any) =>
      (mod.lessons || []).map((l: any) => ({ lessonId: l.id, slug: l.slug || l.id, title: l.title }))
    );
    const lessonIds = lessonMeta.map((l: any) => l.lessonId);

    // 1. Progresso real (conclusão por lição)
    const progressList = await db
      .collection("user_progress")
      .find({ tenant_id: tenantId, courseId: courseId.toString() })
      .toArray();

    const totalStudents = new Set(progressList.map((p: any) => p.userId)).size;

    // 2. Tempo médio real por lição, a partir de pares started_lesson/completed_lesson em study_history
    const historyEvents = await db
      .collection("study_history")
      .find({ tenant_id: tenantId, courseId: courseId.toString() })
      .sort({ timestamp: 1 })
      .toArray();

    const eventsByUserLesson = new Map<string, any[]>();
    for (const ev of historyEvents) {
      const key = `${ev.userId}::${ev.lessonId}`;
      const arr = eventsByUserLesson.get(key) || [];
      arr.push(ev);
      eventsByUserLesson.set(key, arr);
    }

    const timeSamplesByLesson = new Map<string, number[]>();
    for (const [key, events] of eventsByUserLesson) {
      const lessonId = key.split("::")[1];
      let startedAt: Date | null = null;
      for (const ev of events) {
        if (ev.action === "started_lesson") {
          startedAt = new Date(ev.timestamp);
        } else if (ev.action === "completed_lesson" && startedAt) {
          const seconds = (new Date(ev.timestamp).getTime() - startedAt.getTime()) / 1000;
          if (seconds > 0 && seconds < 6 * 3600) {
            // descarta outliers (>6h — provavelmente sessão deixada aberta, não tempo real de estudo)
            const arr = timeSamplesByLesson.get(lessonId) || [];
            arr.push(seconds);
            timeSamplesByLesson.set(lessonId, arr);
          }
          startedAt = null;
        }
      }
    }

    // 3. Perguntas mais erradas (escopadas a este curso)
    const attempts = await db.collection("quiz_attempts").find({ tenant_id: tenantId, courseId: courseId.toString() }).toArray();
    const questionErrorsMap: Record<string, { questionText: string; correctOption: string; count: number }> = {};
    for (const att of attempts) {
      if (!Array.isArray(att.erroredQuestions)) continue;
      for (const q of att.erroredQuestions) {
        const qText = q.questionText || String(q);
        if (!questionErrorsMap[qText]) {
          questionErrorsMap[qText] = { questionText: qText, correctOption: q.correctOption || "", count: 0 };
        }
        questionErrorsMap[qText].count += 1;
      }
    }
    const erroredQuestions = Object.values(questionErrorsMap).sort((a, b) => b.count - a.count).slice(0, 10);

    // Resolver nomes/emails dos alunos com progresso neste curso, para os drill-downs do painel
    const studentIds = Array.from(new Set(progressList.map((p: any) => p.userId)));
    const users = studentIds.length > 0 ? await db.collection("users").find({ _id: { $in: studentIds } }).toArray() : [];
    const studentNames = users.map((u: any) => ({
      userId: u._id,
      name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
      email: u.email,
    }));

    // Montar a resposta por lição
    const lessons = lessonMeta.map((meta: any) => {
      const completedCount = progressList.filter((p: any) => p.lessonId === meta.lessonId && p.status === "completed").length;
      const students = progressList
        .filter((p: any) => p.lessonId === meta.lessonId && p.status === "completed")
        .map((p: any) => p.userId);
      const completionRate = totalStudents > 0 ? Math.round((completedCount / totalStudents) * 100) : 0;

      const timeSamples = timeSamplesByLesson.get(meta.lessonId) || [];
      const avgTimeSeconds = timeSamples.length > 0
        ? Math.round(timeSamples.reduce((a, b) => a + b, 0) / timeSamples.length)
        : null;

      return {
        lessonId: meta.lessonId,
        slug: meta.slug,
        title: meta.title,
        completedCount,
        completionRate,
        avgTimeSeconds,
        studentIds: students,
      };
    });

    return NextResponse.json({
      success: true,
      courseTitle: course.title,
      totalStudents,
      lessons,
      erroredQuestions,
      studentNames,
    });
  } catch (error: any) {
    console.error("Erro ao calcular analytics do curso:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
