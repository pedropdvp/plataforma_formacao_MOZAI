import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { erasePersonalData } from "@/lib/compliance";

const REVIEWER_ROLES = ["ADMIN", "SUPORTE"];

// PATCH — Aprova (executa a eliminação real) ou rejeita um pedido de eliminação de
// conta. O que é apagado e o que é anonimizado está declarado numa única lista, em
// lib/compliance.ts, partilhada com a exportação: o que a plataforma mostra no direito de
// acesso é exatamente o que elimina no direito ao apagamento.
//
// O âmbito é a pessoa, em todas as empresas onde a conta existe. Antes, o registo de
// utilizador (que é global) era removido, mas os dados só eram limpos na empresa ativa do
// revisor — nas outras ficavam registos órfãos a apontar para alguém que já não existia.
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

    // Sem filtro de empresa, pelo mesmo motivo da listagem: quem revê são perfis da
    // plataforma, e o pedido pode ter sido feito dentro de qualquer empresa.
    const deletionRequest = await db.collection("data_deletion_requests").findOne({ _id: requestObjectId });
    if (!deletionRequest) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }
    if (deletionRequest.status !== "pending") {
      return NextResponse.json({ error: "Este pedido já foi processado." }, { status: 409 });
    }

    const reviewer = await currentUser();
    const reviewerName = `${reviewer?.firstName || ""} ${reviewer?.lastName || ""}`.trim() || "Revisor";
    const targetUserId = deletionRequest.userId;

    let erased: Record<string, number> | null = null;
    if (action === "approve") {
      erased = await erasePersonalData(targetUserId);
    }

    await db.collection("data_deletion_requests").updateOne(
      { _id: requestObjectId },
      { $set: { status: action === "approve" ? "approved" : "rejected", reviewedAt: new Date(), reviewedBy: reviewerName } }
    );

    await logAuditEvent(userId, action === "approve" ? "ACCOUNT_DELETION_APPROVED" : "ACCOUNT_DELETION_REJECTED", {
      tenantId,
      targetUserId,
      requestId: id,
      scope: "all-tenants",
      // Contagem por coleção do que foi apagado e anonimizado: é a prova de execução do
      // pedido, e sem ela ficava só o registo de que alguém carregou no botão.
      erased,
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
