import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    // 1. Validar autenticação do Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Autenticação obrigatória." },
        { status: 401 }
      );
    }

    // 2. Extrair cabeçalhos e corpo do pedido
    const tenantId = req.headers.get("x-tenant-id") || "root";
    const { courseId, lessonId, status, watchTime } = await req.json();

    if (!courseId || !lessonId || !status) {
      return NextResponse.json(
        { error: "Campos 'courseId', 'lessonId' e 'status' são obrigatórios." },
        { status: 400 }
      );
    }

    const db = await getDb();

    // 3. Atualizar/Inserir o progresso da lição (Upsert)
    const progressQuery = {
      tenant_id: tenantId,
      userId,
      courseId,
      lessonId,
    };

    const progressUpdate = {
      $set: {
        status,
        watchTime: watchTime || 0,
        completedAt: status === "completed" ? new Date() : null,
        updatedAt: new Date(),
      },
    };

    await db.collection("user_progress").updateOne(progressQuery, progressUpdate, { upsert: true });

    // 4. Gravar diário de estudo (Histórico de Estudo)
    await db.collection("study_history").insertOne({
      tenant_id: tenantId,
      userId,
      courseId,
      lessonId,
      action: status === "completed" ? "completed_lesson" : "started_lesson",
      timestamp: new Date(),
    });

    // 5. Registar auditoria
    await logAuditEvent(userId, status === "completed" ? "LESSON_COMPLETED" : "LESSON_STARTED", {
      courseId,
      lessonId,
      watchTime: watchTime || 0
    });

    return NextResponse.json({
      success: true,
      message: `Progresso gravado: ${status}.`,
    });
  } catch (error: any) {
    console.error("Erro na gravação do progresso:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Obter progresso atual do utilizador para um curso específico
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Autenticação obrigatória." },
        { status: 401 }
      );
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");

    const db = await getDb();

    // Filtro básico scoped
    const query: any = {
      tenant_id: tenantId,
      userId,
    };

    if (courseId) {
      query.courseId = courseId;
    }

    // Buscar todas as lições completas deste curso para este utilizador
    const progressList = await db
      .collection("user_progress")
      .find(query)
      .toArray();

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
    let complexityBreakdown = { baixa: 0, media: 0, alta: 0 };
    try {
      const cognitiveLogs = await db
        .collection("cognitive_logs")
        .find({ tenant_id: tenantId, userId })
        .toArray();

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
      console.warn("Erro ao ler logs cognitivos para progresso:", e);
    }

    return NextResponse.json({
      success: true,
      progress: progressList,
      topTopics,
      difficultTopics,
      complexityBreakdown,
      retentionPct,
      velocityPct,
    });
  } catch (error: any) {
    console.error("Erro na leitura do progresso:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
