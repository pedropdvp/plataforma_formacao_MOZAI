import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

// GET — Catálogo de Templates de documentos: públicos de qualquer tenant + os próprios.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const q = req.nextUrl.searchParams.get("q")?.trim();
    const db = await getDb();

    const filter: any = {
      $or: [{ isPublic: true }, { ownerId: userId, tenant_id: tenantId }],
    };
    if (q) {
      filter.$and = [
        { $or: filter.$or },
        { $or: [{ title: { $regex: q, $options: "i" } }, { category: { $regex: q, $options: "i" } }] },
      ];
      delete filter.$or;
    }

    const templates = await db
      .collection("content_templates")
      .find(filter)
      .sort({ usesCount: -1, createdAt: -1 })
      .toArray();

    const formatted = templates.map((t: any) => ({
      id: t._id.toString(),
      title: t.title,
      description: t.description,
      category: t.category,
      content: t.content,
      isPublic: t.isPublic,
      usesCount: t.usesCount || 0,
      ownerName: t.ownerName,
      isMine: t.ownerId === userId,
      createdAt: t.createdAt,
    }));

    return NextResponse.json({ success: true, templates: formatted });
  } catch (error: any) {
    console.error("Erro ao listar Templates:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Publica um novo Template de documento (estrutura em Markdown/texto, reutilizável).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { title, description, category, content, isPublic } = await req.json();
    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: "Título e conteúdo do template são obrigatórios." }, { status: 400 });
    }
    if (content.trim().length < 20) {
      return NextResponse.json({ error: "O conteúdo do template deve ter um mínimo de detalhe (20 caracteres)." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const userRecord = await db.collection("users").findOne({ _id: userId });
    const ownerName = userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || userRecord.email : "Utilizador";

    const result = await db.collection("content_templates").insertOne({
      tenant_id: tenantId,
      ownerId: userId,
      ownerName,
      title: title.trim(),
      description: description?.trim() || "",
      category: category?.trim() || "Geral",
      content: content.trim(),
      isPublic: !!isPublic,
      usesCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await logAuditEvent(userId, "TEMPLATE_PUBLISHED", { tenantId, templateId: result.insertedId?.toString(), title: title.trim() });

    return NextResponse.json({ success: true, templateId: result.insertedId?.toString() });
  } catch (error: any) {
    console.error("Erro ao publicar Template:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
