import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const body = await req.json();
    const { courseId, lessonId, score, correctAnswers, totalQuestions, erroredQuestions } = body;

    if (!courseId || !lessonId || score === undefined) {
      return NextResponse.json({ error: "Parâmetros em falta." }, { status: 400 });
    }

    const db = await getDb();

    // 1. Salvar a tentativa do quiz
    const attempt = {
      tenant_id: tenantId,
      userId,
      courseId,
      lessonId,
      score, // e.g. 0.8
      correctAnswers,
      totalQuestions,
      erroredQuestions: erroredQuestions || [],
      timestamp: new Date(),
    };

    await db.collection("quiz_attempts").insertOne(attempt);

    // 2. Registar em Auditoria
    await logAuditEvent(userId, "QUIZ_SUBMITTED", {
      courseId,
      lessonId,
      score,
      correctAnswers,
      totalQuestions,
    });

    // 3. Conceder XP de Gamificação
    const baseQuizXp = 10;
    const isPerfect = correctAnswers === totalQuestions;
    const bonusXp = isPerfect ? 20 : 0;
    const totalXpAwarded = baseQuizXp + bonusXp;

    // Buscar perfil de gamificação
    let profile = await db.collection("gamification_profiles").findOne({ _id: userId });
    const today = new Date();

    if (!profile) {
      profile = {
        _id: userId,
        tenant_id: tenantId,
        xp: 0,
        level: 1,
        streak: 0,
        badges: [],
        createdAt: today,
        updatedAt: today,
      };
    }

    const newXp = (profile.xp || 0) + totalXpAwarded;
    const newLevel = Math.floor(newXp / 100) + 1;

    // Verificar se desbloqueia o badge 'quiz-master'
    const currentBadges = profile.badges || [];
    const unlockedBadges = [...currentBadges];
    const hasBadge = (id: string) => unlockedBadges.some((b: any) => b.badgeId === id);

    if (isPerfect && !hasBadge("quiz-master")) {
      unlockedBadges.push({ badgeId: "quiz-master", unlockedAt: today });
    }

    await db.collection("gamification_profiles").updateOne(
      { _id: userId },
      {
        $set: {
          tenant_id: tenantId,
          xp: newXp,
          level: newLevel,
          badges: unlockedBadges,
          lastActiveDate: today,
          updatedAt: today,
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      xpAwarded: totalXpAwarded,
      perfectScore: isPerfect,
      badgeUnlocked: isPerfect && !hasBadge("quiz-master"),
    });
  } catch (error: any) {
    console.error("Erro ao processar tentativa de quiz:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
