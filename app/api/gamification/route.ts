import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";

// Helper para verificar se duas datas são o mesmo dia
function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

// Helper para verificar se d2 foi no dia anterior a d1
function isYesterday(d1: Date, d2: Date): boolean {
  const oneDay = 24 * 60 * 60 * 1000;
  const diffTime = Math.abs(d1.getTime() - d2.getTime());
  const diffDays = Math.ceil(diffTime / oneDay);
  if (diffDays > 2) return false;
  
  // Confirma decremento de data
  const date1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const date2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return (date1.getTime() - date2.getTime()) === oneDay;
}

// Obter o perfil e leaderboard do tenant
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    // 1. Obter ou inicializar o perfil do aluno
    let profile = await db.collection("gamification_profiles").findOne({ _id: userId });
    
    if (!profile) {
      profile = {
        _id: userId,
        tenant_id: tenantId,
        xp: 0,
        level: 1,
        streak: 0,
        badges: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.collection("gamification_profiles").insertOne(profile);
    } else {
      // Verificar se a streak expirou (se última atividade foi há mais de 1 dia)
      if (profile.lastActiveDate) {
        const lastDate = new Date(profile.lastActiveDate);
        const today = new Date();
        if (!isSameDay(today, lastDate) && !isYesterday(today, lastDate)) {
          // Streak quebrada
          await db.collection("gamification_profiles").updateOne(
            { _id: userId },
            { $set: { streak: 0, updatedAt: new Date() } }
          );
          profile.streak = 0;
        }
      }
    }

    // 2. Obter leaderboard do tenant (top 10 ordenado por XP)
    const topProfiles = await db
      .collection("gamification_profiles")
      .find({ tenant_id: tenantId })
      .sort({ xp: -1 })
      .limit(10)
      .toArray();

    // Join simples para pegar nomes dos usuários
    const userIds = topProfiles.map((p: any) => p._id);
    const users = await db
      .collection("users")
      .find({ _id: { $in: userIds } })
      .toArray();

    const userNamesMap: Record<string, string> = {};
    users.forEach((u: any) => {
      userNamesMap[u._id] = `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email;
    });

    const leaderboard = topProfiles.map((p: any, idx: number) => ({
      rank: idx + 1,
      name: userNamesMap[p._id] || "Aluno Incógnito",
      xp: p.xp,
      level: p.level || Math.floor(p.xp / 100) + 1,
      isCurrentUser: p._id === userId,
    }));

    return NextResponse.json({
      success: true,
      profile,
      leaderboard,
    });
  } catch (error: any) {
    console.error("Erro no GET de gamificação:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Atribuir XP e desbloquear conquistas
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const { action, bonusXp } = await req.json(); // action: "lesson_completed" | "quiz_passed" | "lab_completed"

    let xpToAward = 0;
    if (action === "lesson_completed") xpToAward = 15;
    else if (action === "quiz_passed") xpToAward = 10;
    else if (action === "lab_completed") xpToAward = 25;

    if (bonusXp) {
      xpToAward += bonusXp; // Por exemplo, gabaritar um quiz concede bônus
    }

    const db = await getDb();

    // Obter ou criar perfil
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
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    // Calcular Streak
    let newStreak = profile.streak || 0;
    if (profile.lastActiveDate) {
      const lastDate = new Date(profile.lastActiveDate);
      if (isYesterday(today, lastDate)) {
        newStreak += 1;
      } else if (!isSameDay(today, lastDate)) {
        newStreak = 1; // Reseta se for mais antigo
      }
    } else {
      newStreak = 1;
    }

    const newXp = (profile.xp || 0) + xpToAward;
    const newLevel = Math.floor(newXp / 100) + 1;

    // Verificar badges a desbloquear
    const currentBadges = profile.badges || [];
    const unlockedBadges = [...currentBadges];

    const hasBadge = (id: string) => unlockedBadges.some((b: any) => b.badgeId === id);

    // Regra 1: first-step ao concluir primeira aula
    if (action === "lesson_completed" && !hasBadge("first-step")) {
      unlockedBadges.push({ badgeId: "first-step", unlockedAt: new Date() });
    }

    // Regra 2: streak-5
    if (newStreak >= 5 && !hasBadge("streak-5")) {
      unlockedBadges.push({ badgeId: "streak-5", unlockedAt: new Date() });
    }

    // Regra 3: quiz-master se ganhar bônus por nota máxima
    if (action === "quiz_passed" && bonusXp && bonusXp >= 20 && !hasBadge("quiz-master")) {
      unlockedBadges.push({ badgeId: "quiz-master", unlockedAt: new Date() });
    }

    await db.collection("gamification_profiles").updateOne(
      { _id: userId },
      {
        $set: {
          tenant_id: tenantId,
          xp: newXp,
          level: newLevel,
          streak: newStreak,
          badges: unlockedBadges,
          lastActiveDate: today,
          updatedAt: today,
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      xpAwarded: xpToAward,
      newXp,
      newLevel,
      newStreak,
      badgesCount: unlockedBadges.length,
    });
  } catch (error: any) {
    console.error("Erro ao creditar XP de gamificação:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
