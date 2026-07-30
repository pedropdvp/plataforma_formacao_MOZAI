import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

const REVIEWER_ROLES = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA"];

// PATCH — Ativa/desativa um plugin instalado, ou atualiza o seu webhook/eventos.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !REVIEWER_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Sem permissão para gerir plugins." }, { status: 403 });
    }

    const { id } = await params;
    const { isActive, webhookUrl, events } = await req.json();
    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const setFields: any = { updatedAt: new Date() };
    if (typeof isActive === "boolean") setFields.isActive = isActive;
    if (typeof webhookUrl === "string" && webhookUrl.trim()) setFields.webhookUrl = webhookUrl.trim();
    if (Array.isArray(events)) setFields.events = events;

    await db.collection("installed_plugins").updateOne({ _id: new ObjectId(id), tenant_id: tenantId }, { $set: setFields });
    await logAuditEvent(userId, "PLUGIN_UPDATED", { tenantId, pluginRecordId: id, ...setFields });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao atualizar plugin:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — Desinstala o plugin.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !REVIEWER_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Sem permissão para gerir plugins." }, { status: 403 });
    }

    const { id } = await params;
    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    await db.collection("installed_plugins").deleteOne({ _id: new ObjectId(id), tenant_id: tenantId });
    await logAuditEvent(userId, "PLUGIN_UNINSTALLED", { tenantId, pluginRecordId: id });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao desinstalar plugin:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
