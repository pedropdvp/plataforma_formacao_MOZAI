import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

const VALID_TYPES = ["objetivo", "motivacao", "habito"];

// GET — Lista os registos reais (objetivos, motivação, hábitos) do Digital Twin do utilizador.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const entries = await db
      .collection("digital_twin_entries")
      .find({ tenant_id: tenantId, userId })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      entries: entries.map((e: any) => ({
        id: e._id.toString(),
        type: e.type,
        content: e.content,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error("Erro ao listar registos do Digital Twin:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Cria um novo registo real (objetivo, motivação ou hábito).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { type, content } = await req.json();
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: "Tipo de registo inválido." }, { status: 400 });
    }
    if (!content?.trim()) {
      return NextResponse.json({ error: "O conteúdo do registo é obrigatório." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const result = await db.collection("digital_twin_entries").insertOne({
      tenant_id: tenantId,
      userId,
      type,
      content: content.trim().slice(0, 500),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await logAuditEvent(userId, "DIGITAL_TWIN_ENTRY_CREATED", { tenantId, entryId: result.insertedId?.toString(), type });

    return NextResponse.json({ success: true, entryId: result.insertedId?.toString() });
  } catch (error: any) {
    console.error("Erro ao criar registo do Digital Twin:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
