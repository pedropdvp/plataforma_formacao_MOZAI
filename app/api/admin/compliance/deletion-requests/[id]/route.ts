import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

const REVIEWER_ROLES = ["ADMIN", "SUPORTE"];
const ANONYMIZED_NAME = "Utilizador Removido (RGPD)";

// PATCH — Aprova (executa a eliminação real) ou rejeita um pedido de eliminação de
// conta. Âmbito explícito da eliminação (para não prometer mais do que cumpre):
// - Remove por completo o registo do utilizador (users) e os seus dados pessoais mais
//   sensíveis e sem valor de retenção para terceiros: progresso, tentativas de quiz,
//   logs cognitivos do Tutor de IA, tentativas de laboratório.
// - Anonimiza (em vez de apagar) registos onde outras pessoas têm interesse legítimo
//   em manter o histórico: publicações na Comunidade e submissões de projetos já
//   avaliadas — o nome do autor passa a "Utilizador Removido (RGPD)", mas o conteúdo
//   em si (ex: nota de um projeto já avaliado) mantém-se para integridade de registos
//   pedagógicos/financeiros da empresa.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !REVIEWER_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Sem permissão para processar pedidos de eliminação de conta." }, { status: 403 });
    }

    const { id } = await params;
    const { action } = await req.json();
    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const requestObjectId = new ObjectId(id);

    const deletionRequest = await db.collection("data_deletion_requests").findOne({ _id: requestObjectId, tenant_id: tenantId });
    if (!deletionRequest) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }
    if (deletionRequest.status !== "pending") {
      return NextResponse.json({ error: "Este pedido já foi processado." }, { status: 409 });
    }

    const reviewer = await currentUser();
    const reviewerName = `${reviewer?.firstName || ""} ${reviewer?.lastName || ""}`.trim() || "Revisor";
    const targetUserId = deletionRequest.userId;

    if (action === "approve") {
      await Promise.all([
        db.collection("users").deleteOne({ _id: targetUserId }),
        db.collection("user_progress").deleteMany({ tenant_id: tenantId, userId: targetUserId }),
        db.collection("quiz_attempts").deleteMany({ tenant_id: tenantId, userId: targetUserId }),
        db.collection("cognitive_logs").deleteMany({ tenant_id: tenantId, userId: targetUserId }),
        db.collection("coding_lab_attempts").deleteMany({ tenant_id: tenantId, userId: targetUserId }),
        db.collection("simulation_lab_attempts").deleteMany({ tenant_id: tenantId, userId: targetUserId }),
        db.collection("gamification_profiles").deleteOne({ _id: targetUserId }),
      ]);

      // Anonimização (não eliminação) — mantém a integridade de registos onde terceiros
      // têm interesse legítimo (avaliação de projetos, publicações na Comunidade).
      const communityPosts = await db.collection("community_posts").find({ tenant_id: tenantId, authorId: targetUserId }).toArray();
      for (const post of communityPosts) {
        await db.collection("community_posts").updateOne({ _id: post._id }, { $set: { authorName: ANONYMIZED_NAME } });
      }
      const projectSubmissions = await db.collection("project_submissions").find({ tenant_id: tenantId, userId: targetUserId }).toArray();
      for (const submission of projectSubmissions) {
        await db.collection("project_submissions").updateOne({ _id: submission._id }, { $set: { studentName: ANONYMIZED_NAME } });
      }
    }

    await db.collection("data_deletion_requests").updateOne(
      { _id: requestObjectId },
      { $set: { status: action === "approve" ? "approved" : "rejected", reviewedAt: new Date(), reviewedBy: reviewerName } }
    );

    await logAuditEvent(userId, action === "approve" ? "ACCOUNT_DELETION_APPROVED" : "ACCOUNT_DELETION_REJECTED", {
      tenantId,
      targetUserId,
      requestId: id,
    });

    return NextResponse.json({
      success: true,
      message: action === "approve" ? "Conta e dados pessoais eliminados com sucesso." : "Pedido de eliminação rejeitado.",
    });
  } catch (error: any) {
    console.error("Erro ao processar pedido de eliminação de conta:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
