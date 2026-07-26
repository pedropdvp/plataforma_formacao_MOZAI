import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createBackup, listBlobBackups, pruneOldBackups } from "@/lib/backup/core";
import { logAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_ROLES = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA"];

// GET — Lista os backups disponíveis (Vercel Blob, fonte partilhada e duradoura).
// ADMIN/SUPORTE veem os backups de plataforma inteira; GESTOR_EMPRESA vê só os da sua empresa.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !ALLOWED_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const isCompanyScoped = activeRole === "GESTOR_EMPRESA";
    const tenantId = isCompanyScoped ? req.headers.get("x-tenant-id") || undefined : undefined;

    const backups = await listBlobBackups(tenantId);
    return NextResponse.json({ success: true, backups });
  } catch (error: any) {
    console.error("Erro ao listar backups:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Cria um novo backup imediatamente (manual, a pedido do administrador/gestor).
// ADMIN/SUPORTE: backup de toda a plataforma. GESTOR_EMPRESA: só dos dados da sua empresa
// (tenantId derivado sempre do servidor — nunca aceite do cliente).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !ALLOWED_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const isCompanyScoped = activeRole === "GESTOR_EMPRESA";
    const tenantId = isCompanyScoped ? req.headers.get("x-tenant-id") || undefined : undefined;
    if (isCompanyScoped && !tenantId) {
      return NextResponse.json({ error: "Empresa não identificada." }, { status: 400 });
    }

    const manifest = await createBackup({ trigger: "manual", tenantId });
    await pruneOldBackups(30);

    await logAuditEvent(userId, "DB_BACKUP_CREATED", {
      backupId: manifest.id,
      collections: manifest.collections,
      tenantId: tenantId || null,
    });

    return NextResponse.json({ success: true, backup: manifest });
  } catch (error: any) {
    console.error("Erro ao criar backup:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
