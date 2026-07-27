import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { getGamificationLevels } from "@/lib/gamification-levels";

function canWrite(req: NextRequest): boolean {
  const activeRole = req.cookies.get("active-role")?.value;
  return activeRole === "ADMIN" || activeRole === "SUPORTE";
}

/** GET — Escala de níveis atual (qualquer utilizador autenticado — usado para calcular o
 * progresso de cada aluno, não só pela página de gestão). */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const levels = await getGamificationLevels();
    return NextResponse.json({ success: true, levels });
  } catch (error: any) {
    console.error("Erro ao consultar os níveis:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** POST — Cria um novo nível na escala (só ADMIN/SUPORTE). */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }
    if (!canWrite(req)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { name, threshold } = await req.json();
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Nome do nível é obrigatório." }, { status: 400 });
    }
    if (typeof threshold !== "number" || !Number.isFinite(threshold) || threshold < 0) {
      return NextResponse.json({ error: "Limiar de pontos inválido." }, { status: 400 });
    }

    const db = await getDb();
    const result = await db.collection("gamification_levels").insertOne({
      name: name.trim(),
      threshold,
      createdAt: new Date(),
    });

    await logAuditEvent(userId, "GAMIFICATION_LEVEL_CREATED", { name: name.trim(), threshold });

    const levels = await getGamificationLevels();
    return NextResponse.json({ success: true, id: result.insertedId.toString(), levels });
  } catch (error: any) {
    console.error("Erro ao criar nível:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
