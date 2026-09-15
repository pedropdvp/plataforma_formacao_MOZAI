import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { getForums, deleteForum } from "@/lib/forum";
import { getActiveRole, getTenantId } from "@/lib/session";

async function canManageForums(): Promise<boolean> {
  const activeRole = await getActiveRole();
  if (!activeRole) return false;
  if (activeRole === "ADMIN" || activeRole === "SUPORTE") return true;
  const db = await getDb();
  const role = await db.collection("roles").findOne({ _id: activeRole });
  return !!role?.permissions?.includes("FORUM_MANAGE");
}

/** DELETE — Elimina um fórum do tenant ativo (requer FORUM_MANAGE). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }
    if (!(await canManageForums())) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { id } = await params;
    const tenantId = await getTenantId();
    const deleted = await deleteForum(tenantId, id);
    if (!deleted) {
      return NextResponse.json({ error: "Fórum não encontrado." }, { status: 404 });
    }

    await logAuditEvent(userId, "FORUM_DELETED", { tenantId, forumId: id });

    const forums = await getForums(tenantId);
    return NextResponse.json({ success: true, forums });
  } catch (error: any) {
    console.error("Erro ao eliminar fórum:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
