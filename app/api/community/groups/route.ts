import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

// GET — Lista os Grupos de discussão deste tenant, com contagem real de membros.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const groups = await db.collection("community_groups").find({ tenant_id: tenantId }).sort({ createdAt: -1 }).toArray();

    return NextResponse.json({
      success: true,
      groups: groups.map((g: any) => ({
        id: g._id.toString(),
        name: g.name,
        description: g.description,
        topic: g.topic,
        membersCount: (g.memberIds || []).length,
        isMember: (g.memberIds || []).includes(userId),
      })),
    });
  } catch (error: any) {
    console.error("Erro ao listar Grupos:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Cria um novo Grupo de discussão (o criador entra automaticamente como membro).
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

    const result = await db.collection("community_groups").insertOne({
      tenant_id: tenantId,
      creatorId: userId,
      name: name.trim(),
      description: description.trim(),
      topic: topic?.trim() || "Geral",
      memberIds: [userId],
      createdAt: new Date(),
    });

    await logAuditEvent(userId, "COMMUNITY_GROUP_CREATED", { tenantId, groupId: result.insertedId?.toString(), name: name.trim() });

    return NextResponse.json({ success: true, groupId: result.insertedId?.toString() });
  } catch (error: any) {
    console.error("Erro ao criar Grupo:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
