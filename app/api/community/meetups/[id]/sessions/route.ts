import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { ObjectId } from "mongodb";

// GET — Lista as sessões futuras deste grupo, com contagem real de inscritos.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDb();
    const sessions = await db.collection("meetup_sessions").find({ groupId: id }).sort({ startsAt: 1 }).toArray();

    return NextResponse.json({
      success: true,
      sessions: sessions.map((s: any) => ({
        id: s._id.toString(),
        title: s.title,
        startsAt: s.startsAt,
        location: s.location,
        isOnline: s.isOnline,
        attendeesCount: (s.attendeeIds || []).length,
        attending: (s.attendeeIds || []).includes(userId),
      })),
    });
  } catch (error: any) {
    console.error("Erro ao listar sessões do grupo:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Agenda uma nova sessão (só membros do grupo podem agendar).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const { title, startsAt, location, isOnline } = await req.json();
    if (!title?.trim() || !startsAt) {
      return NextResponse.json({ error: "Título e data são obrigatórios." }, { status: 400 });
    }

    const db = await getDb();
    const group = await db.collection("meetup_groups").findOne({ _id: new ObjectId(id) });
    if (!group) {
      return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });
    }
    if (!(group.memberIds || []).includes(userId)) {
      return NextResponse.json({ error: "Só membros do grupo podem agendar sessões." }, { status: 403 });
    }

    const result = await db.collection("meetup_sessions").insertOne({
      groupId: id,
      tenant_id: group.tenant_id,
      title: title.trim(),
      startsAt: new Date(startsAt),
      location: location?.trim() || "",
      isOnline: !!isOnline,
      attendeeIds: [userId],
      createdAt: new Date(),
    });

    await logAuditEvent(userId, "MEETUP_SESSION_CREATED", { groupId: id, sessionId: result.insertedId?.toString() });

    return NextResponse.json({ success: true, sessionId: result.insertedId?.toString() });
  } catch (error: any) {
    console.error("Erro ao agendar sessão:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
