import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { ObjectId } from "mongodb";

// DELETE — Cancela um evento (organizador ou ADMIN/SUPORTE).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const activeRole = req.cookies.get("active-role")?.value;
    const db = await getDb();

    const event = await db.collection("community_events").findOne({ _id: new ObjectId(id) });
    if (!event) {
      return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
    }
    const isModerator = activeRole === "ADMIN" || activeRole === "SUPORTE";
    if (event.organizerId !== userId && !isModerator) {
      return NextResponse.json({ error: "Sem permissão para cancelar este evento." }, { status: 403 });
    }

    await db.collection("community_events").deleteOne({ _id: new ObjectId(id) });
    await logAuditEvent(userId, "COMMUNITY_EVENT_CANCELLED", { eventId: id, title: event.title });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao cancelar evento:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
