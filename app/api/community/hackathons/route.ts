import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { sendDiscordNotification } from "@/lib/discord";

// GET — Lista os hackathons deste tenant, mais recentes primeiro, com contagem real de equipas.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const hackathons = await db.collection("hackathons").find({ tenant_id: tenantId }).sort({ startsAt: -1 }).toArray();
    const teamCounts = await db.collection("hackathon_teams").aggregate([{ $group: { _id: "$hackathonId", count: { $sum: 1 } } }]).toArray();
    const countMap = new Map(teamCounts.map((c: any) => [c._id, c.count]));

    return NextResponse.json({
      success: true,
      hackathons: hackathons.map((h: any) => ({
        id: h._id.toString(),
        title: h.title,
        description: h.description,
        theme: h.theme,
        startsAt: h.startsAt,
        submissionDeadline: h.submissionDeadline,
        prizes: h.prizes,
        organizerName: h.organizerName,
        organizerId: h.organizerId,
        teamsCount: countMap.get(h._id.toString()) || 0,
      })),
    });
  } catch (error: any) {
    console.error("Erro ao listar hackathons:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Cria um novo hackathon.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { title, description, theme, startsAt, submissionDeadline, prizes } = await req.json();
    if (!title?.trim() || !description?.trim() || !startsAt || !submissionDeadline) {
      return NextResponse.json({ error: "Título, descrição, data de início e prazo de submissão são obrigatórios." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const userRecord = await db.collection("users").findOne({ _id: userId });
    const organizerName = userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || userRecord.email : "Utilizador";

    const result = await db.collection("hackathons").insertOne({
      tenant_id: tenantId,
      organizerId: userId,
      organizerName,
      title: title.trim(),
      description: description.trim(),
      theme: theme?.trim() || "",
      startsAt: new Date(startsAt),
      submissionDeadline: new Date(submissionDeadline),
      prizes: prizes?.trim() || "",
      createdAt: new Date(),
    });

    await logAuditEvent(userId, "HACKATHON_CREATED", { tenantId, hackathonId: result.insertedId?.toString(), title: title.trim() });
    after(() => sendDiscordNotification(tenantId, `Novo Hackathon: ${title.trim()}`, description.trim().slice(0, 300)));

    return NextResponse.json({ success: true, hackathonId: result.insertedId?.toString() });
  } catch (error: any) {
    console.error("Erro ao criar hackathon:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
