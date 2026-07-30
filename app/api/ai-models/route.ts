import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { indexLessonContent } from "@/lib/vector-store";

const MAX_KNOWLEDGE_CHARS = 60000;

// GET — Catálogo de Modelos IA: modelos públicos de qualquer tenant + os próprios (privados ou públicos).
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
        { $or: [{ name: { $regex: q, $options: "i" } }, { category: { $regex: q, $options: "i" } }] },
      ];
      delete filter.$or;
    }

    const models = await db
      .collection("ai_models")
      .find(filter)
      .sort({ usesCount: -1, createdAt: -1 })
      .toArray();

    const formatted = models.map((m: any) => ({
      id: m._id.toString(),
      name: m.name,
      description: m.description,
      category: m.category,
      hasKnowledge: !!m.hasKnowledge,
      isPublic: m.isPublic,
      usesCount: m.usesCount || 0,
      ownerName: m.ownerName,
      isMine: m.ownerId === userId,
      createdAt: m.createdAt,
    }));

    return NextResponse.json({ success: true, models: formatted });
  } catch (error: any) {
    console.error("Erro ao listar Modelos IA:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Publica um novo Modelo IA (persona/assistente especializado com system prompt próprio e,
// opcionalmente, conhecimento próprio indexado via RAG — reutiliza o mesmo motor de embeddings do Tutor de IA).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { name, description, category, systemPrompt, knowledgeText, isPublic } = await req.json();
    if (!name?.trim() || !description?.trim() || !systemPrompt?.trim()) {
      return NextResponse.json(
        { error: "Nome, descrição e instruções do assistente (system prompt) são obrigatórios." },
        { status: 400 }
      );
    }
    if (systemPrompt.trim().length < 20) {
      return NextResponse.json(
        { error: "As instruções do assistente devem ser suficientemente detalhadas (mín. 20 caracteres)." },
        { status: 400 }
      );
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const userRecord = await db.collection("users").findOne({ _id: userId });
    const ownerName = userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || userRecord.email : "Utilizador";

    const trimmedKnowledge = typeof knowledgeText === "string" ? knowledgeText.trim().slice(0, MAX_KNOWLEDGE_CHARS) : "";

    const result = await db.collection("ai_models").insertOne({
      tenant_id: tenantId,
      ownerId: userId,
      ownerName,
      name: name.trim(),
      description: description.trim(),
      category: category?.trim() || "Geral",
      systemPrompt: systemPrompt.trim(),
      hasKnowledge: trimmedKnowledge.length > 0,
      isPublic: !!isPublic,
      usesCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const modelId = result.insertedId.toString();

    if (trimmedKnowledge.length > 0) {
      // Reutiliza o motor de RAG (chunking + embeddings) já usado pelo Tutor de IA nas lições dos
      // cursos, indexando o conhecimento próprio deste modelo sob um "courseId" sintético.
      await indexLessonContent(tenantId, `aimodel-${modelId}`, `aimodel-${modelId}`, trimmedKnowledge);
    }

    await logAuditEvent(userId, "AI_MODEL_PUBLISHED", { tenantId, modelId, name: name.trim() });

    return NextResponse.json({ success: true, modelId });
  } catch (error: any) {
    console.error("Erro ao publicar Modelo IA:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
