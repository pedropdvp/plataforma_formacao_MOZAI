import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

// GET — Lista os pedidos de mentoria relacionados com o utilizador autenticado: os que
// enviou (como mentee) e os que recebeu (como mentor).
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const [sent, received] = await Promise.all([
      db.collection("mentorship_requests").find({ tenant_id: tenantId, menteeId: userId }).sort({ requestedAt: -1 }).toArray(),
      db.collection("mentorship_requests").find({ tenant_id: tenantId, mentorId: userId }).sort({ requestedAt: -1 }).toArray(),
    ]);

    // Só revela o contacto (e-mail) da outra parte depois do pedido ser aceite — antes
    // disso, só o nome e a mensagem são visíveis.
    const revealContactIfAccepted = async (r: any, otherPartyId: string) => {
      if (r.status !== "accepted") return { ...r, _id: r._id.toString(), otherPartyEmail: null };
      const otherUser = await db.collection("users").findOne({ _id: otherPartyId });
      return { ...r, _id: r._id.toString(), otherPartyEmail: otherUser?.email || null };
    };

    const sentFormatted = await Promise.all(sent.map((r: any) => revealContactIfAccepted(r, r.mentorId)));
    const receivedFormatted = await Promise.all(received.map((r: any) => revealContactIfAccepted(r, r.menteeId)));

    return NextResponse.json({ success: true, sent: sentFormatted, received: receivedFormatted });
  } catch (error: any) {
    console.error("Erro ao listar pedidos de mentoria:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Envia um novo pedido de mentoria a um mentor ativo.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { mentorUserId, message } = await req.json();
    if (!mentorUserId || !message || !message.trim()) {
      return NextResponse.json({ error: "Escolha um mentor e escreva uma mensagem." }, { status: 400 });
    }
    if (mentorUserId === userId) {
      return NextResponse.json({ error: "Não pode pedir mentoria a si próprio." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const mentorProfile = await db.collection("mentor_profiles").findOne({ tenant_id: tenantId, userId: mentorUserId, isActive: true });
    if (!mentorProfile) {
      return NextResponse.json({ error: "Este mentor já não está disponível." }, { status: 404 });
    }

    const existingPending = await db.collection("mentorship_requests").findOne({
      tenant_id: tenantId,
      menteeId: userId,
      mentorId: mentorUserId,
      status: "pending",
    });
    if (existingPending) {
      return NextResponse.json({ error: "Já tem um pedido pendente para este mentor." }, { status: 409 });
    }

    const userRecord = await db.collection("users").findOne({ _id: userId });
    const menteeName = userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || userRecord.email : "Aluno";

    const result = await db.collection("mentorship_requests").insertOne({
      tenant_id: tenantId,
      menteeId: userId,
      menteeName,
      mentorId: mentorUserId,
      mentorName: mentorProfile.name,
      message: message.trim(),
      status: "pending",
      requestedAt: new Date(),
      respondedAt: null,
    });

    await logAuditEvent(userId, "MENTORSHIP_REQUESTED", { tenantId, mentorUserId, requestId: result.insertedId?.toString() });

    return NextResponse.json({ success: true, message: "Pedido de mentoria enviado com sucesso." });
  } catch (error: any) {
    console.error("Erro ao enviar pedido de mentoria:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
