import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { sendDiscordNotification } from "@/lib/discord";

// GET — Lista os eventos da Comunidade deste tenant, futuros primeiro, com contagem real de
// inscritos e se o próprio utilizador já está inscrito.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const events = await db.collection("community_events").find({ tenant_id: tenantId }).sort({ startsAt: 1 }).toArray();

    return NextResponse.json({
      success: true,
      events: events.map((e: any) => ({
        id: e._id.toString(),
        title: e.title,
        description: e.description,
        category: e.category,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        location: e.location,
        isOnline: e.isOnline,
        organizerName: e.organizerName,
        organizerId: e.organizerId,
        attendeesCount: (e.attendeeIds || []).length,
        attending: (e.attendeeIds || []).includes(userId),
      })),
    });
  } catch (error: any) {
    console.error("Erro ao listar eventos:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Cria um novo evento da Comunidade (qualquer utilizador autenticado pode organizar,
// tal como publicar na Comunidade ou publicar um Projeto no Marketplace).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { title, description, category, startsAt, endsAt, location, isOnline } = await req.json();
    if (!title?.trim() || !description?.trim() || !startsAt) {
      return NextResponse.json({ error: "Título, descrição e data de início são obrigatórios." }, { status: 400 });
    }
    const startsAtDate = new Date(startsAt);
    if (isNaN(startsAtDate.getTime()) || startsAtDate < new Date()) {
      return NextResponse.json({ error: "A data de início tem de ser uma data futura válida." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const userRecord = await db.collection("users").findOne({ _id: userId });
    const organizerName = userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || userRecord.email : "Utilizador";

    const result = await db.collection("community_events").insertOne({
      tenant_id: tenantId,
      organizerId: userId,
      organizerName,
      title: title.trim(),
      description: description.trim(),
      category: category?.trim() || "Geral",
      startsAt: startsAtDate,
      endsAt: endsAt ? new Date(endsAt) : null,
      location: location?.trim() || "",
      isOnline: !!isOnline,
      attendeeIds: [userId],
      createdAt: new Date(),
    });

    await logAuditEvent(userId, "COMMUNITY_EVENT_CREATED", { tenantId, eventId: result.insertedId?.toString(), title: title.trim() });

    after(() =>
      sendDiscordNotification(
        tenantId,
        `Novo evento: ${title.trim()}`,
        `${description.trim().slice(0, 300)}\n\n📅 ${startsAtDate.toLocaleString("pt-PT")}`
      )
    );

    return NextResponse.json({ success: true, eventId: result.insertedId?.toString() });
  } catch (error: any) {
    console.error("Erro ao criar evento:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
