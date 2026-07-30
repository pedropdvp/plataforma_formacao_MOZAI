import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { extractPromptVariables } from "@/lib/prompts";

// GET — Catálogo de Prompts: públicos de qualquer tenant + os próprios (privados ou públicos).
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

    const prompts = await db
      .collection("ai_prompts")
      .find(filter)
      .sort({ usesCount: -1, createdAt: -1 })
      .toArray();

    const formatted = prompts.map((p: any) => ({
      id: p._id.toString(),
      title: p.title,
      description: p.description,
      category: p.category,
      template: p.template,
      variables: p.variables || [],
      isPublic: p.isPublic,
      usesCount: p.usesCount || 0,
      ownerName: p.ownerName,
      isMine: p.ownerId === userId,
      createdAt: p.createdAt,
    }));

    return NextResponse.json({ success: true, prompts: formatted });
  } catch (error: any) {
    console.error("Erro ao listar Prompts:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Publica um novo Prompt reutilizável. Aceita variáveis no formato {{nome}}.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { title, description, category, template, isPublic } = await req.json();
    if (!title?.trim() || !template?.trim()) {
      return NextResponse.json({ error: "Título e template do prompt são obrigatórios." }, { status: 400 });
    }
    if (template.trim().length < 10) {
      return NextResponse.json({ error: "O template deve ter um mínimo de detalhe (10 caracteres)." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const userRecord = await db.collection("users").findOne({ _id: userId });
    const ownerName = userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || userRecord.email : "Utilizador";

    const variables = extractPromptVariables(template.trim());

    const result = await db.collection("ai_prompts").insertOne({
      tenant_id: tenantId,
      ownerId: userId,
      ownerName,
      title: title.trim(),
      description: description?.trim() || "",
      category: category?.trim() || "Geral",
      template: template.trim(),
      variables,
      isPublic: !!isPublic,
      usesCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await logAuditEvent(userId, "PROMPT_PUBLISHED", { tenantId, promptId: result.insertedId?.toString(), title: title.trim() });

    return NextResponse.json({ success: true, promptId: result.insertedId?.toString() });
  } catch (error: any) {
    console.error("Erro ao publicar Prompt:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
