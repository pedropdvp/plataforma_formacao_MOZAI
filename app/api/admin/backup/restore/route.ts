import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { restoreBackup } from "@/lib/backup/core";
import { logAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST — Restaura a base de dados a partir de um backup. Ação extremamente destrutiva:
// substitui o conteúdo atual de cada coleção presente no backup. Restrito a ADMIN.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    // Só ADMIN (não SUPORTE) pode restaurar — é uma operação destrutiva sobre toda a base de dados.
    const activeRole = req.cookies.get("active-role")?.value;
    if (activeRole !== "ADMIN") {
      return NextResponse.json({ error: "Só um Administrador Global pode restaurar backups." }, { status: 403 });
    }

    const body = await req.json();
    const { backupId } = body;
    if (!backupId) {
      return NextResponse.json({ error: "backupId é obrigatório." }, { status: 400 });
    }

    const result = await restoreBackup(backupId);

    await logAuditEvent(userId, "DB_BACKUP_RESTORED", {
      restoredBackupId: backupId,
      safetyBackupId: result.safetyBackupId,
      restoredCollections: result.restoredCollections,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Erro ao restaurar backup:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
