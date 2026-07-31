import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

// GET — Lista as notificações reais do utilizador (mais recentes primeiro).
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const notifications = await db
      .collection("notifications")
      .find({ tenant_id: tenantId, userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json({
      success: true,
      notifications: notifications.map((n: any) => ({
        id: n._id.toString(),
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link || null,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Erro ao listar notificações:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH — Marca todas as notificações do utilizador como lidas.
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    await db.collection("notifications").updateMany({ tenant_id: tenantId, userId, isRead: false }, { $set: { isRead: true } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
