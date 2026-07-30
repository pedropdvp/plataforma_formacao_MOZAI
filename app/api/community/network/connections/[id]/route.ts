import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { ObjectId } from "mongodb";

// PATCH — O destinatário aceita ou recusa um pedido de ligação.
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

    const db = await getDb();
    const connection = await db.collection("network_connections").findOne({ _id: new ObjectId(id) });
    if (!connection) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }
    if (connection.addresseeId !== userId) {
      return NextResponse.json({ error: "Só o destinatário pode responder a este pedido." }, { status: 403 });
    }
    if (connection.status !== "pending") {
      return NextResponse.json({ error: "Este pedido já foi respondido." }, { status: 409 });
    }

    await db.collection("network_connections").updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: action === "accept" ? "accepted" : "declined", respondedAt: new Date() } }
    );

    await logAuditEvent(userId, "NETWORK_CONNECTION_RESPONDED", { connectionId: id, action });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao responder ao pedido de ligação:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
