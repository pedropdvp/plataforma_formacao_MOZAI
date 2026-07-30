import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

// GET — Direito de acesso e portabilidade (RGPD Art. 15/20): devolve TODOS os dados
// pessoais reais do utilizador autenticado, num único JSON descarregável. Cada secção
// vem diretamente das coleções reais — nada é resumido ou fabricado.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const [
      userRecord,
      progress,
      quizAttempts,
      codingLabAttempts,
      simulationAttempts,
      projectSubmissions,
      cognitiveLogs,
      communityPosts,
      gamificationProfile,
    ] = await Promise.all([
      db.collection("users").findOne({ _id: userId }),
      db.collection("user_progress").find({ tenant_id: tenantId, userId }).toArray(),
      db.collection("quiz_attempts").find({ tenant_id: tenantId, userId }).toArray(),
      db.collection("coding_lab_attempts").find({ tenant_id: tenantId, userId }).toArray(),
      db.collection("simulation_lab_attempts").find({ tenant_id: tenantId, userId }).toArray(),
      db.collection("project_submissions").find({ tenant_id: tenantId, userId }).toArray(),
      db.collection("cognitive_logs").find({ tenant_id: tenantId, userId }).toArray(),
      db.collection("community_posts").find({ tenant_id: tenantId, authorId: userId }).toArray(),
      db.collection("gamification_profiles").findOne({ _id: userId }),
    ]);

    await logAuditEvent(userId, "PERSONAL_DATA_EXPORTED", { tenantId });

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      profile: userRecord
        ? { firstName: userRecord.firstName, lastName: userRecord.lastName, email: userRecord.email, tenants: userRecord.tenants }
        : null,
      gamification: gamificationProfile || null,
      courseProgress: progress,
      quizAttempts,
      codingLabAttempts,
      simulationAttempts,
      projectSubmissions,
      tutorAiInteractions: cognitiveLogs,
      communityPosts,
    };

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="mozai-dados-pessoais-${userId}.json"`,
      },
    });
  } catch (error: any) {
    console.error("Erro ao exportar dados pessoais:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
