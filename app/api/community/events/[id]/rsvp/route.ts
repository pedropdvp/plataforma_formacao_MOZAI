import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

// POST — Alterna a inscrição (RSVP) do utilizador autenticado neste evento.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDb();
    const event = await db.collection("community_events").findOne({ _id: new ObjectId(id) });
    if (!event) {
      return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
    }

    const attending = (event.attendeeIds || []).includes(userId);
    await db.collection("community_events").updateOne(
      { _id: new ObjectId(id) },
      attending ? { $pull: { attendeeIds: userId } } : { $addToSet: { attendeeIds: userId } }
    );

    const updated = await db.collection("community_events").findOne({ _id: new ObjectId(id) });
    return NextResponse.json({ success: true, attending: !attending, attendeesCount: (updated?.attendeeIds || []).length });
  } catch (error: any) {
    console.error("Erro ao alternar inscrição no evento:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
