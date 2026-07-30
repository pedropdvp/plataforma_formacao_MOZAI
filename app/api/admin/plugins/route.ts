import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { PLUGIN_CATALOG, PLUGIN_EVENTS } from "@/lib/plugins";

const REVIEWER_ROLES = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA"];

// GET — Devolve o catálogo de plugins disponíveis e os que a empresa já instalou.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const installed = await db.collection("installed_plugins").find({ tenant_id: tenantId }).toArray();

    return NextResponse.json({
      success: true,
      catalog: PLUGIN_CATALOG,
      events: PLUGIN_EVENTS,
      installed: installed.map((p: any) => ({ ...p, _id: p._id.toString() })),
    });
  } catch (error: any) {
    console.error("Erro ao listar plugins:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Instala um plugin da MOZAI (define o webhook e os eventos reais a que reage).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !REVIEWER_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Só Admin, Suporte ou Gestor de Empresa podem instalar plugins." }, { status: 403 });
    }

    const { pluginId, webhookUrl, events } = await req.json();
    const catalogEntry = PLUGIN_CATALOG.find((p) => p.id === pluginId);
    if (!catalogEntry) {
      return NextResponse.json({ error: "Plugin desconhecido." }, { status: 400 });
    }
    if (!webhookUrl || !/^https?:\/\/\S+$/i.test(webhookUrl)) {
      return NextResponse.json({ error: "Indique um URL de webhook válido (https://...)." }, { status: 400 });
    }
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: "Escolha pelo menos um evento." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    await db.collection("installed_plugins").updateOne(
      { tenant_id: tenantId, pluginId },
      {
        $set: {
          tenant_id: tenantId,
          pluginId,
          pluginName: catalogEntry.name,
          webhookUrl,
          events,
          isActive: true,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    await logAuditEvent(userId, "PLUGIN_INSTALLED", { tenantId, pluginId, events });

    return NextResponse.json({ success: true, message: `Plugin "${catalogEntry.name}" instalado com sucesso.` });
  } catch (error: any) {
    console.error("Erro ao instalar plugin:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
