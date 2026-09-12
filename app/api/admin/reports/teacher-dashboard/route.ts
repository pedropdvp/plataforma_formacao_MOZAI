import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value || "ALUNO";
    const allowedRoles = ["ADMIN", "GESTOR_EMPRESA", "PROFESSOR", "SUPORTE"];
    if (!allowedRoles.includes(activeRole)) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenantId") || req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    // 1. Obter tentativas de quizzes
    const attempts = await db.collection("quiz_attempts").find({ tenant_id: tenantId }).toArray();
    
    let totalScoreSum = 0;
    let totalAttemptsCount = attempts.length;
    const activeStudentIds = new Set<string>();

    attempts.forEach((att: any) => {
      totalScoreSum += att.score || 0;
      if (att.userId) activeStudentIds.add(att.userId);
    });

    // Sem tentativas registadas, a média é zero e diz-se que é zero. Este painel devolvia
    // aqui valores inventados ("fallback rico e realista"), que apareciam com o mesmo
    // aspeto dos reais e seguiam para os ficheiros exportados — um relatório que preenche
    // buracos com números plausíveis é pior do que um relatório vazio.
    const averageQuizScore = totalAttemptsCount > 0
      ? Math.round((totalScoreSum / totalAttemptsCount) * 100)
      : 0;

    const activeStudentsCount = activeStudentIds.size;

    // Lista detalhada dos alunos ativos (para drill-down no card)
    let activeStudents: Array<{ name: string; email: string }> = [];
    if (activeStudentIds.size > 0) {
      const activeUsers = await db.collection("users").find({
        _id: { $in: Array.from(activeStudentIds) }
      }).toArray();
      activeStudents = activeUsers.map((u: any) => ({
        name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
        email: u.email
      }));
    }
    // 2. Obter laboratórios práticos concluídos
    const progressList = await db.collection("user_progress").find({ tenant_id: tenantId }).toArray();
    const completedLabs = progressList.filter((p: any) => {
      // lessonId em falta num registo antigo não pode derrubar o relatório inteiro.
      const lessonId = String(p.lessonId || "");
      return p.status === "completed" && (lessonId.includes("lab") || lessonId.includes("coding"));
    });
    const completedLabsCount = completedLabs.length;

    // 3. Questões com mais erros
    const questionErrorsMap: Record<string, { count: number; correctOption: string; questionText: string }> = {};

    attempts.forEach((att: any) => {
      if (att.erroredQuestions && Array.isArray(att.erroredQuestions)) {
        att.erroredQuestions.forEach((q: any) => {
          const qText = q.questionText || q;
          const correctOpt = q.correctOption || "Não especificada";
          
          if (!questionErrorsMap[qText]) {
            questionErrorsMap[qText] = {
              questionText: qText,
              count: 0,
              correctOption: correctOpt,
            };
          }
          questionErrorsMap[qText].count += 1;
        });
      }
    });

    const erroredQuestions = Object.values(questionErrorsMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      // Distingue "não há registos" de "os registos dão zero" — sem isto a interface não
      // consegue explicar porque está tudo a zeros.
      hasData: totalAttemptsCount > 0 || progressList.length > 0,
      metrics: {
        averageQuizScore,
        activeStudentsCount,
        activeStudents,
        completedLabsCount,
        erroredQuestions,
      },
    });
  } catch (error: any) {
    console.error("Erro no GET do dashboard de professores:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
