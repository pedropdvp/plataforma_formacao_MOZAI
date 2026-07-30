import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

// POST — Alterna a inscrição (RSVP) numa sessão de Meetup.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; sessionId: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { sessionId } = await params;
    const db = await getDb();
    const session = await db.collection("meetup_sessions").findOne({ _id: new ObjectId(sessionId) });
    if (!session) {
      return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
    }

    const attending = (session.attendeeIds || []).includes(userId);
    await db.collection("meetup_sessions").updateOne(
      { _id: new ObjectId(sessionId) },
      attending ? { $pull: { attendeeIds: userId } } : { $addToSet: { attendeeIds: userId } }
    );

    const updated = await db.collection("meetup_sessions").findOne({ _id: new ObjectId(sessionId) });
    return NextResponse.json({ success: true, attending: !attending, attendeesCount: (updated?.attendeeIds || []).length });
  } catch (error: any) {
    console.error("Erro ao alternar RSVP na sessão:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
