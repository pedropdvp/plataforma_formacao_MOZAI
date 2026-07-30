import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { executeCode, getPistonRuntimes } from "@/lib/coding-lab/piston";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 20;

// Distância mínima entre execuções do mesmo utilizador — o Piston é uma API pública e
// partilhada (sem chave própria); sem este limite, um utilizador a martelar "Executar"
// poderia esgotar o rate-limit informal do Piston para TODA a plataforma.
const MIN_INTERVAL_BETWEEN_RUNS_MS = 2000;

// GET — Lista as linguagens/versões atualmente suportadas pelo Piston (para o seletor de linguagem no editor).
export async function GET() {
  try {
    const runtimes = await getPistonRuntimes();
    return NextResponse.json({ success: true, runtimes });
  } catch (error: any) {
    console.error("Erro ao listar runtimes do Piston:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Executa código real e isolado via Piston, grava a tentativa (histórico) e,
// numa primeira aprovação de um exercício, atribui XP de gamificação.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { language, code, stdin, expectedOutput, exerciseId, courseId, lessonKey, testCases } = await req.json();
    if (!language || !code) {
      return NextResponse.json({ error: "Os campos 'language' e 'code' são obrigatórios." }, { status: 400 });
    }
    if (testCases !== undefined && (!Array.isArray(testCases) || testCases.length === 0 || testCases.length > 10)) {
      return NextResponse.json({ error: "'testCases' deve ser uma lista com 1 a 10 casos." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    // Limite de cadência: rejeita se a última tentativa deste utilizador foi há menos de
    // MIN_INTERVAL_BETWEEN_RUNS_MS — protege a API partilhada do Piston, não o nosso servidor.
    const lastAttempt = await db
      .collection("coding_lab_attempts")
      .find({ tenant_id: tenantId, userId })
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();
    if (lastAttempt.length > 0) {
      const elapsed = Date.now() - new Date(lastAttempt[0].timestamp).getTime();
      if (elapsed < MIN_INTERVAL_BETWEEN_RUNS_MS) {
        return NextResponse.json(
          { error: "Aguarde alguns segundos antes de executar novamente." },
          { status: 429 }
        );
      }
    }

    // Modo "suite de testes": corre o MESMO código uma vez por cada caso (stdin/expectedOutput
    // próprios), sequencialmente — tal como um pipeline de CI real correria vários testes contra
    // um único build. Cada caso é uma execução Piston genuína, nunca simulada.
    let testResults: { label?: string; stdin: string; expectedOutput: string; stdout: string; stderr: string; passed: boolean }[] | undefined;
    let result: { stdout: string; stderr: string; exitCode: number };
    let passed: boolean | undefined;

    if (Array.isArray(testCases)) {
      testResults = [];
      for (const tc of testCases) {
        const r = await executeCode(language, code, tc.stdin || "");
        testResults.push({
          label: tc.label,
          stdin: tc.stdin || "",
          expectedOutput: tc.expectedOutput ?? "",
          stdout: r.stdout,
          stderr: r.stderr,
          passed: r.stdout.trim() === String(tc.expectedOutput ?? "").trim(),
        });
      }
      passed = testResults.every((t) => t.passed);
      const last = testResults[testResults.length - 1];
      result = { stdout: last.stdout, stderr: last.stderr, exitCode: 0 };
    } else {
      result = await executeCode(language, code, stdin || "");
      passed = expectedOutput !== undefined && expectedOutput !== null && expectedOutput !== ""
        ? result.stdout.trim() === String(expectedOutput).trim()
        : undefined;
    }

    // Gravação do histórico + gamificação nunca pode impedir a devolução do resultado real
    // da execução ao aluno — se a base de dados falhar aqui, o código já correu com sucesso
    // no Piston e o aluno tem direito a ver o resultado na mesma.
    let xpAwarded = 0;
    let badgeUnlocked = false;
    try {
      await db.collection("coding_lab_attempts").insertOne({
        tenant_id: tenantId,
        userId,
        exerciseId: exerciseId || null,
        courseId: courseId || null,
        lessonKey: lessonKey || null,
        language,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        passed: passed ?? null,
        testResults: testResults || null,
        timestamp: new Date(),
      });

      // XP só na primeira aprovação de CADA exercício (evita "grinding" repetindo o mesmo
      // exercício). A contagem já inclui a tentativa gravada acima, por isso "<= 1" é "esta foi a primeira".
      if (passed && exerciseId) {
        const priorPassesCount = await db.collection("coding_lab_attempts").countDocuments({
          tenant_id: tenantId,
          userId,
          exerciseId,
          passed: true,
        });

        if (priorPassesCount <= 1) {
          xpAwarded = 15;
          let profile = await db.collection("gamification_profiles").findOne({ _id: userId });
          const today = new Date();
          if (!profile) {
            profile = { _id: userId, tenant_id: tenantId, xp: 0, level: 1, streak: 0, badges: [], createdAt: today };
          }
          const currentBadges = profile.badges || [];
          const hasBadge = currentBadges.some((b: any) => b.badgeId === "code-runner");
          const newBadges = hasBadge ? currentBadges : [...currentBadges, { badgeId: "code-runner", unlockedAt: today }];
          badgeUnlocked = !hasBadge;

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
      }

      await logAuditEvent(userId, "CODE_EXECUTED", { courseId, lessonKey, exerciseId, language, passed });
    } catch (persistError) {
      console.warn("Falha ao gravar histórico/gamificação do Coding Lab (resultado da execução mantém-se válido):", persistError);
    }

    return NextResponse.json({
      success: true,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      passed,
      testResults,
      xpAwarded,
      badgeUnlocked,
    });
  } catch (error: any) {
    console.error("Erro na execução de código (Piston):", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
