import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { getGamificationLevels } from "@/lib/gamification-levels";

function canWrite(req: NextRequest): boolean {
  const activeRole = req.cookies.get("active-role")?.value;
  return activeRole === "ADMIN" || activeRole === "SUPORTE";
}

/** PATCH — Edita o nome e/ou o limiar de pontos de um nível existente. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }
    if (!canWrite(req)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { id } = await params;
    const { name, threshold } = await req.json();

    const update: Record<string, any> = {};
    if (typeof name === "string" && name.trim()) update.name = name.trim();
    if (typeof threshold === "number" && Number.isFinite(threshold) && threshold >= 0) update.threshold = threshold;
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
    }

    const db = await getDb();
    const result = await db.collection("gamification_levels").updateOne({ _id: new ObjectId(id) }, { $set: update });
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Nível não encontrado." }, { status: 404 });
    }

    await logAuditEvent(userId, "GAMIFICATION_LEVEL_UPDATED", { levelId: id, changes: update });

    const levels = await getGamificationLevels();
    return NextResponse.json({ success: true, levels });
  } catch (error: any) {
    console.error("Erro ao editar nível:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** DELETE — Remove um nível da escala. Nunca deixa a escala ficar vazia (tem de existir
 * sempre pelo menos um nível, senão nenhum aluno teria uma "patente" para mostrar). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }
    if (!canWrite(req)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { id } = await params;
    const db = await getDb();

    const total = await db.collection("gamification_levels").countDocuments({});
    if (total <= 1) {
      return NextResponse.json({ error: "Tem de existir pelo menos um nível na escala." }, { status: 400 });
    }

    const result = await db.collection("gamification_levels").deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Nível não encontrado." }, { status: 404 });
    }

    await logAuditEvent(userId, "GAMIFICATION_LEVEL_DELETED", { levelId: id });

    const levels = await getGamificationLevels();
    return NextResponse.json({ success: true, levels });
  } catch (error: any) {
    console.error("Erro ao apagar nível:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
