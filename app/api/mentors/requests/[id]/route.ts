import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

// PATCH — O mentor aceita ou recusa um pedido de mentoria recebido. Ao aceitar, o
// e-mail do mentee é revelado ao mentor (e vice-versa) para combinarem os detalhes da
// sessão fora da plataforma — não há um sistema de mensagens/chamada próprio aqui.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const { action } = await req.json();
    if (!["accept", "decline"].includes(action)) {
      return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const requestObjectId = new ObjectId(id);

    const mentorshipRequest = await db.collection("mentorship_requests").findOne({ _id: requestObjectId, tenant_id: tenantId });
    if (!mentorshipRequest) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }
    if (mentorshipRequest.mentorId !== userId) {
      return NextResponse.json({ error: "Só o mentor visado pode responder a este pedido." }, { status: 403 });
    }
    if (mentorshipRequest.status !== "pending") {
      return NextResponse.json({ error: "Este pedido já foi respondido." }, { status: 409 });
    }

    await db.collection("mentorship_requests").updateOne(
      { _id: requestObjectId },
      { $set: { status: action === "accept" ? "accepted" : "declined", respondedAt: new Date() } }
    );

    await logAuditEvent(userId, action === "accept" ? "MENTORSHIP_ACCEPTED" : "MENTORSHIP_DECLINED", {
      tenantId,
      requestId: id,
      menteeId: mentorshipRequest.menteeId,
    });

    return NextResponse.json({
      success: true,
      message: action === "accept" ? "Pedido de mentoria aceite." : "Pedido de mentoria recusado.",
    });
  } catch (error: any) {
    console.error("Erro ao responder a pedido de mentoria:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
