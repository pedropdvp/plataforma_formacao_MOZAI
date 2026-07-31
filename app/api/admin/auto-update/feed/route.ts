import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

// GET — Lista o feed real de itens detetados (mais recentes primeiro).
export async function GET(req: NextRequest) {
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
    const items = await db.collection("auto_update_feed").find({}).sort({ foundAt: -1 }).limit(30).toArray();

    return NextResponse.json({
      success: true,
      items: items.map((i: any) => ({
        id: i._id.toString(),
        sourceLabel: i.sourceLabel,
        title: i.title,
        description: i.description,
        url: i.url,
        publishedAt: i.publishedAt,
        status: i.status,
        draftContent: i.draftContent || null,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
