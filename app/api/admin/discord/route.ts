import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { logAuditEvent } from "@/lib/audit";
import { getTenantDiscordStatus, setTenantDiscordWebhook, removeTenantDiscordWebhook } from "@/lib/discord";

const ALLOWED_ROLES = ["ADMIN", "GESTOR_EMPRESA"];

// GET — Estado do webhook do Discord do próprio tenant (nunca o URL completo).
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }
    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !ALLOWED_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const status = await getTenantDiscordStatus(tenantId);
    return NextResponse.json({ success: true, ...status });
  } catch (error: any) {
    console.error("Erro ao consultar ligação ao Discord:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Guarda o Webhook URL do Discord (encriptado).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }
    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !ALLOWED_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { webhookUrl } = await req.json();
    if (!webhookUrl?.trim() || !/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//i.test(webhookUrl.trim())) {
      return NextResponse.json({ error: "Introduza um URL de Webhook do Discord válido (discord.com/api/webhooks/...)." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    await setTenantDiscordWebhook(tenantId, webhookUrl.trim());
    await logAuditEvent(userId, "DISCORD_WEBHOOK_SAVED", { tenantId });

    const status = await getTenantDiscordStatus(tenantId);
    return NextResponse.json({ success: true, ...status });
  } catch (error: any) {
    console.error("Erro ao guardar webhook do Discord:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — Remove o webhook configurado.
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }
    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !ALLOWED_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const tenantId = req.headers.get("x-tenant-id") || "root";
    await removeTenantDiscordWebhook(tenantId);
    await logAuditEvent(userId, "DISCORD_WEBHOOK_REMOVED", { tenantId });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
