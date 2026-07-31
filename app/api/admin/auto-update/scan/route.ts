import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { AUTO_UPDATE_SOURCES, fetchSourceItems } from "@/lib/auto-update-sources";
import { logAuditEvent } from "@/lib/audit";

export const maxDuration = 30;

// POST — Faz scan REAL a todas as fontes (GitHub Releases + arXiv), guardando só os itens
// novos (dedupe por externalId) na coleção partilhada auto_update_feed. Nunca inventa itens —
// se uma fonte falhar, o erro real dessa fonte é reportado, as outras continuam.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }
    const activeRole = req.cookies.get("active-role")?.value;
    if (activeRole !== "ADMIN" && activeRole !== "SUPORTE") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
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
            {
              $setOnInsert: {
                ...item,
                sourceId: source.id,
                sourceLabel: source.label,
                status: "pending",
                foundAt: new Date(),
              },
            },
            { upsert: true }
          );
          if (result.upsertedCount > 0) newItemsCount++;
        }
      } catch (err: any) {
        errors.push(`${source.label}: ${err.message}`);
      }
    }

    await logAuditEvent(userId, "AUTO_UPDATE_SCAN", { newItemsCount, errors });

    return NextResponse.json({ success: true, newItemsCount, errors, scannedAt: new Date() });
  } catch (error: any) {
    console.error("Erro no scan de Atualização Automática:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
