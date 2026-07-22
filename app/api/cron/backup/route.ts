import { NextRequest, NextResponse } from "next/server";
import { createBackup, pruneOldBackups } from "@/lib/backup/core";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET — Disparado diariamente pelo Vercel Cron (ver vercel.json). O Vercel autentica
// automaticamente o pedido com "Authorization: Bearer $CRON_SECRET" quando essa
// variável de ambiente está definida — confirmamos aqui para que ninguém mais consiga
// chamar este endpoint e disparar backups à vontade.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const manifest = await createBackup({ trigger: "cron" });
    await pruneOldBackups(30);
    return NextResponse.json({ success: true, backup: manifest });
  } catch (error: any) {
    console.error("Erro no backup automático (cron):", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
