import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { computeSkillNodes } from "@/lib/skills-os";
import { logAuditEvent } from "@/lib/audit";

// GET — Digital Twin real: combina traços DERIVADOS de dados reais de atividade (nunca
// inventados) com objetivos/motivação que o próprio utilizador define.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const [profile, gamification, quizAttempts, cognitiveLogs, codingAttempts, progressList] = await Promise.all([
      db.collection("digital_twin_profiles").findOne({ tenant_id: tenantId, userId }),
      db.collection("gamification_profiles").findOne({ _id: userId }),
      db.collection("quiz_attempts").find({ tenant_id: tenantId, userId }).toArray(),
      db.collection("cognitive_logs").find({ tenant_id: tenantId, userId }).toArray(),
      db.collection("coding_lab_attempts").find({ tenant_id: tenantId, userId }).toArray(),
      db.collection("user_progress").find({ tenant_id: tenantId, userId }).toArray(),
    ]);

    // Hábito real: hora do dia com mais atividade registada (quiz + coding lab + logs cognitivos)
    const allTimestamps = [
      ...quizAttempts.map((q: any) => q.submittedAt || q.timestamp),
      ...cognitiveLogs.map((l: any) => l.timestamp),
      ...codingAttempts.map((c: any) => c.timestamp),
    ].filter(Boolean).map((d: any) => new Date(d));

    const hourCounts = new Array(24).fill(0);
    allTimestamps.forEach((d) => hourCounts[d.getHours()]++);
    const peakHour = allTimestamps.length > 0 ? hourCounts.indexOf(Math.max(...hourCounts)) : null;

    // Traço real: taxa de confusão (Digital Twin cognitivo já existente no Tutor de IA)
    const confusionRate = cognitiveLogs.length > 0 ? cognitiveLogs.filter((l: any) => l.isConfusion).length / cognitiveLogs.length : null;

    // Competência mais forte real (via motor de scoring do Skills OS)
    const skillNodes = computeSkillNodes(progressList, quizAttempts, new Date());
    const topSkill = [...skillNodes].sort((a, b) => b.score - a.score)[0] || null;

    return NextResponse.json({
      success: true,
      derived: {
        streak: gamification?.streak || 0,
        level: gamification?.level || 1,
        xp: gamification?.xp || 0,
        peakActivityHour: peakHour,
        confusionRatePct: confusionRate !== null ? Math.round(confusionRate * 100) : null,
        topSkill: topSkill ? { label: topSkill.label, score: topSkill.score } : null,
        totalActivityLogs: allTimestamps.length,
      },
      profile: {
        goals: profile?.goals || [],
        motivation: profile?.motivation || "",
        habitsNote: profile?.habitsNote || "",
      },
    });
  } catch (error: any) {
    console.error("Erro ao ler Digital Twin:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Atualiza os campos que só o próprio utilizador pode definir (objetivos, motivação,
// notas de hábitos) — nunca campos derivados, que são sempre calculados a partir de dados reais.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { goals, motivation, habitsNote } = await req.json();
    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    await db.collection("digital_twin_profiles").updateOne(
      { tenant_id: tenantId, userId },
      {
        $set: {
          tenant_id: tenantId,
          userId,
          goals: Array.isArray(goals) ? goals.slice(0, 10).map((g: string) => g.trim()).filter(Boolean) : [],
          motivation: motivation?.trim().slice(0, 500) || "",
          habitsNote: habitsNote?.trim().slice(0, 500) || "",
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    await logAuditEvent(userId, "DIGITAL_TWIN_PROFILE_UPDATED", { tenantId });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao atualizar Digital Twin:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
