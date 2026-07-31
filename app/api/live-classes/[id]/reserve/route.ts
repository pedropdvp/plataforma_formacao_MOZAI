import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { ObjectId } from "mongodb";

// POST — Reserva um lugar real numa aula ao vivo (bloqueia novas reservas do mesmo utilizador
// para a mesma aula) e cria uma notificação real ligada a essa reserva.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    let liveClass: any;
    try {
      liveClass = await db.collection("live_classes").findOne({ _id: new ObjectId(id), tenant_id: tenantId });
    } catch {
      liveClass = null;
    }
    if (!liveClass) {
      return NextResponse.json({ error: "Aula ao vivo não encontrada." }, { status: 404 });
    }

    const existing = await db.collection("live_class_reservations").findOne({ tenant_id: tenantId, classId: liveClass._id, userId });
    if (existing) {
      return NextResponse.json({ error: "Já tem uma reserva para esta aula." }, { status: 409 });
    }

    const reservedAt = new Date();
    await db.collection("live_class_reservations").insertOne({
      tenant_id: tenantId,
      classId: liveClass._id,
      userId,
      reservedAt,
    });

    await db.collection("notifications").insertOne({
      tenant_id: tenantId,
      userId,
      type: "live_class_reservation",
      title: "Reserva confirmada",
      body: `Reservou o seu lugar na aula "${liveClass.title}", dia ${liveClass.date} às ${liveClass.time}.`,
      link: "/dashboard/live-classes",
      isRead: false,
      createdAt: reservedAt,
    });

    await logAuditEvent(userId, "LIVE_CLASS_RESERVED", { tenantId, classId: id, title: liveClass.title });

    return NextResponse.json({ success: true, reservedAt: reservedAt.toISOString() });
  } catch (error: any) {
    console.error("Erro ao reservar aula ao vivo:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — Cancela a reserva real do próprio utilizador (liberta novamente o botão "Reservar Lugar").
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    await db.collection("live_class_reservations").deleteOne({ tenant_id: tenantId, classId: new ObjectId(id), userId });

    await logAuditEvent(userId, "LIVE_CLASS_RESERVATION_CANCELLED", { tenantId, classId: id });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao cancelar reserva:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
