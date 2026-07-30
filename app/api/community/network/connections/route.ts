import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { sendDiscordNotification } from "@/lib/discord";

// GET — Lista os pedidos de ligação enviados e recebidos pelo utilizador autenticado.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const [sent, received] = await Promise.all([
      db.collection("network_connections").find({ tenant_id: tenantId, requesterId: userId }).sort({ requestedAt: -1 }).toArray(),
      db.collection("network_connections").find({ tenant_id: tenantId, addresseeId: userId }).sort({ requestedAt: -1 }).toArray(),
    ]);

    const fmt = (c: any) => ({ id: c._id.toString(), otherName: c.requesterId === userId ? c.addresseeName : c.requesterName, status: c.status, requestedAt: c.requestedAt });

    return NextResponse.json({ success: true, sent: sent.map(fmt), received: received.map(fmt) });
  } catch (error: any) {
    console.error("Erro ao listar pedidos de ligação:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Envia um pedido de ligação real a outro membro visível no diretório.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { targetUserId } = await req.json();
    if (!targetUserId?.trim() || targetUserId === userId) {
      return NextResponse.json({ error: "Alvo do pedido de ligação inválido." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const targetProfile = await db.collection("network_profiles").findOne({ tenant_id: tenantId, userId: targetUserId, visible: true });
    if (!targetProfile) {
      return NextResponse.json({ error: "Este membro não está visível no diretório de Networking." }, { status: 404 });
    }

    const existing = await db.collection("network_connections").findOne({
      tenant_id: tenantId,
      $or: [
        { requesterId: userId, addresseeId: targetUserId },
        { requesterId: targetUserId, addresseeId: userId },
      ],
    });
    if (existing) {
      return NextResponse.json({ error: "Já existe um pedido de ligação entre vocês." }, { status: 409 });
    }

    const [requesterRecord, addresseeRecord] = await Promise.all([
      db.collection("users").findOne({ _id: userId }),
      db.collection("users").findOne({ _id: targetUserId }),
    ]);
    const requesterName = requesterRecord ? `${requesterRecord.firstName || ""} ${requesterRecord.lastName || ""}`.trim() || requesterRecord.email : "Utilizador";
    const addresseeName = addresseeRecord ? `${addresseeRecord.firstName || ""} ${addresseeRecord.lastName || ""}`.trim() || addresseeRecord.email : "Utilizador";

    const result = await db.collection("network_connections").insertOne({
      tenant_id: tenantId,
      requesterId: userId,
      requesterName,
      addresseeId: targetUserId,
      addresseeName,
      status: "pending",
      requestedAt: new Date(),
      respondedAt: null,
    });

    await logAuditEvent(userId, "NETWORK_CONNECTION_REQUESTED", { tenantId, targetUserId, connectionId: result.insertedId?.toString() });
    after(() => sendDiscordNotification(tenantId, "Novo pedido de Networking", `${requesterName} quer ligar-se a ${addresseeName}.`));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao enviar pedido de ligação:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
