import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createBackup, listBlobBackups, pruneOldBackups } from "@/lib/backup/core";
import { logAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET — Lista os backups disponíveis (Vercel Blob, fonte partilhada e duradoura)
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!["ADMIN", "SUPORTE"].includes(activeRole || "")) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const backups = await listBlobBackups();
    return NextResponse.json({ success: true, backups });
  } catch (error: any) {
    console.error("Erro ao listar backups:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Cria um novo backup imediatamente (manual, a pedido do administrador)
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!["ADMIN", "SUPORTE"].includes(activeRole || "")) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const manifest = await createBackup({ trigger: "manual" });
    await pruneOldBackups(30);

    await logAuditEvent(userId, "DB_BACKUP_CREATED", {
      backupId: manifest.id,
      collections: manifest.collections,
    });

    return NextResponse.json({ success: true, backup: manifest });
  } catch (error: any) {
    console.error("Erro ao criar backup:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
