import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { ObjectId } from "mongodb";

// DELETE — Revoga (não apaga) uma chave de API: fica inativa para sempre, para preservar o
// histórico de auditoria de que existiu.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDb();

    const key = await db.collection("developer_api_keys").findOne({ _id: new ObjectId(id) });
    if (!key) {
      return NextResponse.json({ error: "Chave não encontrada." }, { status: 404 });
    }
    if (key.userId !== userId) {
      return NextResponse.json({ error: "Sem permissão para revogar esta chave." }, { status: 403 });
    }

    await db.collection("developer_api_keys").updateOne({ _id: new ObjectId(id) }, { $set: { revoked: true, revokedAt: new Date() } });

    await logAuditEvent(userId, "DEVELOPER_API_KEY_REVOKED", { keyId: id, name: key.name });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao revogar chave de developer:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
