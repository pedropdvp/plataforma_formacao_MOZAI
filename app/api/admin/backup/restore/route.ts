import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { restoreBackup } from "@/lib/backup/core";
import { logAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST — Restaura a base de dados a partir de um backup. Ação extremamente destrutiva:
// substitui o conteúdo atual de cada coleção presente no backup.
// ADMIN restaura backups de plataforma inteira; GESTOR_EMPRESA só pode restaurar um backup
// da SUA PRÓPRIA empresa (verificado em restoreBackup contra o tenantId derivado do servidor),
// e mesmo assim só os documentos da sua empresa são substituídos, nunca a coleção inteira.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    const isCompanyScoped = activeRole === "GESTOR_EMPRESA";
    if (activeRole !== "ADMIN" && !isCompanyScoped) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const tenantId = isCompanyScoped ? req.headers.get("x-tenant-id") || undefined : undefined;
    if (isCompanyScoped && !tenantId) {
      return NextResponse.json({ error: "Empresa não identificada." }, { status: 400 });
    }

    const body = await req.json();
    const { backupId } = body;
    if (!backupId) {
      return NextResponse.json({ error: "backupId é obrigatório." }, { status: 400 });
    }

    const result = await restoreBackup(backupId, { tenantId });

    await logAuditEvent(userId, "DB_BACKUP_RESTORED", {
      restoredBackupId: backupId,
      safetyBackupId: result.safetyBackupId,
      restoredCollections: result.restoredCollections,
      tenantId: tenantId || null,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Erro ao restaurar backup:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
