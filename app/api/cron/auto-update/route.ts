import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { AUTO_UPDATE_SOURCES, fetchSourceItems } from "@/lib/auto-update-sources";

export const maxDuration = 30;

// GET — Executado automaticamente pelo Vercel Cron (ver vercel.json): faz o mesmo scan real
// que o botão manual do admin, sem exigir login (protegido pelo cabeçalho de cron da Vercel).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const db = await getDb();
  let newItemsCount = 0;
  const errors: string[] = [];

  for (const source of AUTO_UPDATE_SOURCES) {
    try {
      const items = await fetchSourceItems(source);
      for (const item of items) {
        const result = await db.collection("auto_update_feed").updateOne(
          { externalId: item.externalId },
          { $setOnInsert: { ...item, sourceId: source.id, sourceLabel: source.label, status: "pending", foundAt: new Date() } },
          { upsert: true }
        );
        if (result.upsertedCount > 0) newItemsCount++;
      }
    } catch (err: any) {
      errors.push(`${source.label}: ${err.message}`);
    }
  }

  return NextResponse.json({ success: true, newItemsCount, errors, scannedAt: new Date() });
}
