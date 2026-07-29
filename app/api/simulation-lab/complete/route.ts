import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";

// POST — Regista a conclusão de uma Simulação Guiada (cenário com escolhas) e, na
// primeira conclusão de cada simulação, atribui XP de gamificação — mesmo mecanismo
// já usado nos quizzes e no Coding Lab, aplicado a este novo tipo de laboratório.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { exerciseId, courseId, lessonKey, totalSteps, bestChoices } = await req.json();
    if (!exerciseId || totalSteps === undefined || bestChoices === undefined) {
      return NextResponse.json({ error: "Parâmetros em falta." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    await db.collection("simulation_lab_attempts").insertOne({
      tenant_id: tenantId,
      userId,
      exerciseId,
      courseId: courseId || null,
      lessonKey: lessonKey || null,
      totalSteps,
      bestChoices,
      timestamp: new Date(),
    });

    let xpAwarded = 0;
    let badgeUnlocked = false;

    // XP só na primeira conclusão desta simulação específica (a contagem já inclui a
    // tentativa gravada acima, por isso "<= 1" é "esta foi a primeira vez").
    try {
      const priorCompletions = await db.collection("simulation_lab_attempts").countDocuments({
        tenant_id: tenantId,
        userId,
        exerciseId,
      });

      if (priorCompletions <= 1) {
        const isPerfect = bestChoices === totalSteps;
        xpAwarded = 10 + (isPerfect ? 15 : 0);

        let profile = await db.collection("gamification_profiles").findOne({ _id: userId });
        const today = new Date();
        if (!profile) {
          profile = { _id: userId, tenant_id: tenantId, xp: 0, level: 1, streak: 0, badges: [], createdAt: today };
        }
        const currentBadges = profile.badges || [];
        const hasBadge = currentBadges.some((b: any) => b.badgeId === "scenario-strategist");
        const newBadges = isPerfect && !hasBadge ? [...currentBadges, { badgeId: "scenario-strategist", unlockedAt: today }] : currentBadges;
        badgeUnlocked = isPerfect && !hasBadge;

        const newXp = (profile.xp || 0) + xpAwarded;
        await db.collection("gamification_profiles").updateOne(
          { _id: userId },
          {
            $set: {
              tenant_id: tenantId,
              xp: newXp,
              level: Math.floor(newXp / 100) + 1,
              badges: newBadges,
              lastActiveDate: today,
              updatedAt: today,
            },
          },
          { upsert: true }
        );
      }

      await logAuditEvent(userId, "SIMULATION_COMPLETED", { courseId, lessonKey, exerciseId, totalSteps, bestChoices });
    } catch (persistError) {
      console.warn("Falha ao processar gamificação da Simulação Guiada (conclusão já foi gravada):", persistError);
    }

    return NextResponse.json({ success: true, xpAwarded, badgeUnlocked });
  } catch (error: any) {
    console.error("Erro ao registar conclusão de Simulação Guiada:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
