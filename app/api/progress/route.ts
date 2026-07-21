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

    // Análise Cognitiva do Digital Twin: Extrair tópicos de interesse das perguntas à IA
    let topTopics: string[] = [];
    try {
      const cognitiveLogs = await db
        .collection("cognitive_logs")
        .find({ tenant_id: tenantId, userId })
        .toArray();

      const topicCounts: Record<string, number> = {};
      cognitiveLogs.forEach((log: any) => {
        if (log.topics && Array.isArray(log.topics)) {
          log.topics.forEach((topic: string) => {
            topicCounts[topic] = (topicCounts[topic] || 0) + 1;
          });
        }
      });

      topTopics = Object.entries(topicCounts)
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
    });
  } catch (error: any) {
    console.error("Erro na leitura do progresso:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
