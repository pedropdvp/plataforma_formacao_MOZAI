import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { ObjectId } from "mongodb";

// PATCH — Edita um registo real existente (só o próprio dono).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const { content } = await req.json();
    if (!content?.trim()) {
      return NextResponse.json({ error: "O conteúdo do registo é obrigatório." }, { status: 400 });
    }

    const db = await getDb();
    const entry = await db.collection("digital_twin_entries").findOne({ _id: new ObjectId(id) });
    if (!entry) {
      return NextResponse.json({ error: "Registo não encontrado." }, { status: 404 });
    }
    if (entry.userId !== userId) {
      return NextResponse.json({ error: "Sem permissão para editar este registo." }, { status: 403 });
    }

    await db.collection("digital_twin_entries").updateOne(
      { _id: new ObjectId(id) },
      { $set: { content: content.trim().slice(0, 500), updatedAt: new Date() } }
    );

    await logAuditEvent(userId, "DIGITAL_TWIN_ENTRY_UPDATED", { entryId: id });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao editar registo do Digital Twin:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — Apaga um registo real existente (só o próprio dono).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDb();
    const entry = await db.collection("digital_twin_entries").findOne({ _id: new ObjectId(id) });
    if (!entry) {
      return NextResponse.json({ error: "Registo não encontrado." }, { status: 404 });
    }
    if (entry.userId !== userId) {
      return NextResponse.json({ error: "Sem permissão para apagar este registo." }, { status: 403 });
    }

    await db.collection("digital_twin_entries").deleteOne({ _id: new ObjectId(id) });

    await logAuditEvent(userId, "DIGITAL_TWIN_ENTRY_DELETED", { entryId: id });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao apagar registo do Digital Twin:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
