import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { sendDiscordNotification } from "@/lib/discord";

// GET — Lista os grupos de Meetup deste tenant, com contagem real de membros e se o próprio
// utilizador já pertence ao grupo.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const groups = await db.collection("meetup_groups").find({ tenant_id: tenantId }).sort({ createdAt: -1 }).toArray();

    return NextResponse.json({
      success: true,
      groups: groups.map((g: any) => ({
        id: g._id.toString(),
        name: g.name,
        description: g.description,
        topic: g.topic,
        organizerName: g.organizerName,
        organizerId: g.organizerId,
        membersCount: (g.memberIds || []).length,
        isMember: (g.memberIds || []).includes(userId),
      })),
    });
  } catch (error: any) {
    console.error("Erro ao listar grupos de Meetup:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Cria um novo grupo de Meetup (o criador entra automaticamente como membro).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { name, description, topic } = await req.json();
    if (!name?.trim() || !description?.trim()) {
      return NextResponse.json({ error: "Nome e descrição do grupo são obrigatórios." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const userRecord = await db.collection("users").findOne({ _id: userId });
    const organizerName = userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || userRecord.email : "Utilizador";

    const result = await db.collection("meetup_groups").insertOne({
      tenant_id: tenantId,
      organizerId: userId,
      organizerName,
      name: name.trim(),
      description: description.trim(),
      topic: topic?.trim() || "Geral",
      memberIds: [userId],
      createdAt: new Date(),
    });

    await logAuditEvent(userId, "MEETUP_GROUP_CREATED", { tenantId, groupId: result.insertedId?.toString(), name: name.trim() });
    after(() => sendDiscordNotification(tenantId, `Novo grupo de Meetup: ${name.trim()}`, description.trim().slice(0, 300)));

    return NextResponse.json({ success: true, groupId: result.insertedId?.toString() });
  } catch (error: any) {
    console.error("Erro ao criar grupo de Meetup:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
