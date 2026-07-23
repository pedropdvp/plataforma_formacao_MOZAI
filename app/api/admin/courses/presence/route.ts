import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";

const STALE_AFTER_SECONDS = 15;
const TTL_SECONDS = 30; // margem acima de STALE_AFTER_SECONDS para garantir limpeza automática

let ttlIndexEnsured = false;
async function ensureTtlIndex(col: any) {
  if (ttlIndexEnsured) return;
  try {
    await col.createIndex({ lastSeenAt: 1 }, { expireAfterSeconds: TTL_SECONDS });
    ttlIndexEnsured = true;
  } catch (err) {
    console.warn("Não foi possível garantir o índice TTL de lesson_presence:", err);
  }
}

// POST — Heartbeat: regista/atualiza a presença do utilizador atual numa lição do editor.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const { courseId, lessonKey } = await req.json();
    if (!courseId || !lessonKey) {
      return NextResponse.json({ error: "courseId e lessonKey são obrigatórios." }, { status: 400 });
    }

    const db = await getDb();
    const col = db.collection("lesson_presence");
    await ensureTtlIndex(col);

    const user = await db.collection("users").findOne({ _id: userId });
    const userName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email : "Utilizador";

    await col.updateOne(
      { tenantId, courseId, lessonKey, userId },
      { $set: { tenantId, courseId, lessonKey, userId, userName, lastSeenAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro no heartbeat de presença:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET — Lista outros editores ativos (últimos ~15s) na mesma lição.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    const lessonKey = searchParams.get("lessonKey");
    if (!courseId || !lessonKey) {
      return NextResponse.json({ error: "courseId e lessonKey são obrigatórios." }, { status: 400 });
    }

    const db = await getDb();
    const cutoff = new Date(Date.now() - STALE_AFTER_SECONDS * 1000);

    const editors = await db
      .collection("lesson_presence")
      .find({ tenantId, courseId, lessonKey, userId: { $ne: userId }, lastSeenAt: { $gte: cutoff } })
      .project({ userId: 1, userName: 1, _id: 0 })
      .toArray();

    return NextResponse.json({ success: true, editors });
  } catch (error: any) {
    console.error("Erro ao listar presença de edição:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
