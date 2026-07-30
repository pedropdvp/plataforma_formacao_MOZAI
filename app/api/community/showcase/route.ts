import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { sendDiscordNotification } from "@/lib/discord";

// GET — Galeria de projetos partilhados pela comunidade (portefólio/showcase — distinto dos
// Projetos-freelance do Marketplace e das entregas de curso), mais recentes primeiro.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const projects = await db.collection("community_showcase_projects").find({ tenant_id: tenantId }).sort({ createdAt: -1 }).toArray();

    return NextResponse.json({
      success: true,
      projects: projects.map((p: any) => ({
        id: p._id.toString(),
        title: p.title,
        description: p.description,
        link: p.link,
        tags: p.tags || [],
        authorName: p.authorName,
        authorId: p.authorId,
        likesCount: (p.likes || []).length,
        likedByMe: (p.likes || []).includes(userId),
        createdAt: p.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Erro ao listar showcase de projetos:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Publica um projeto na galeria da comunidade.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { title, description, link, tags } = await req.json();
    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json({ error: "Título e descrição são obrigatórios." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const userRecord = await db.collection("users").findOne({ _id: userId });
    const authorName = userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || userRecord.email : "Utilizador";

    const tagsArray = typeof tags === "string" ? tags.split(",").map((t: string) => t.trim()).filter(Boolean) : Array.isArray(tags) ? tags : [];

    const result = await db.collection("community_showcase_projects").insertOne({
      tenant_id: tenantId,
      authorId: userId,
      authorName,
      title: title.trim(),
      description: description.trim(),
      link: link?.trim() || "",
      tags: tagsArray,
      likes: [] as string[],
      createdAt: new Date(),
    });

    await logAuditEvent(userId, "COMMUNITY_SHOWCASE_PUBLISHED", { tenantId, projectId: result.insertedId?.toString(), title: title.trim() });
    after(() => sendDiscordNotification(tenantId, `Novo projeto partilhado: ${title.trim()}`, description.trim().slice(0, 300)));

    return NextResponse.json({ success: true, projectId: result.insertedId?.toString() });
  } catch (error: any) {
    console.error("Erro ao publicar no showcase:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
