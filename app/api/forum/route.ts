import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { getForums, createForum } from "@/lib/forum";

async function canManageForums(req: NextRequest): Promise<boolean> {
  const activeRole = req.cookies.get("active-role")?.value;
  if (!activeRole) return false;
  if (activeRole === "ADMIN" || activeRole === "SUPORTE") return true;
  const db = await getDb();
  const role = await db.collection("roles").findOne({ _id: activeRole });
  return !!role?.permissions?.includes("FORUM_MANAGE");
}

/** GET — Lista os fóruns do tenant ativo (qualquer utilizador autenticado). */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const forums = await getForums(tenantId);
    return NextResponse.json({ success: true, forums });
  } catch (error: any) {
    console.error("Erro ao consultar fóruns:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** POST — Cria um novo fórum no tenant ativo (requer FORUM_MANAGE). */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }
    if (!(await canManageForums(req))) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { title, category } = await req.json();
    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "O título do fórum é obrigatório." }, { status: 400 });
    }
    if (typeof category !== "string" || !category.trim()) {
      return NextResponse.json({ error: "A categoria do fórum é obrigatória." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const id = await createForum(tenantId, title.trim(), category.trim());

    await logAuditEvent(userId, "FORUM_CREATED", { tenantId, title: title.trim() });

    const forums = await getForums(tenantId);
    return NextResponse.json({ success: true, id, forums });
  } catch (error: any) {
    console.error("Erro ao criar fórum:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
