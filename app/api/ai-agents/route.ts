import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

// GET — Catálogo de Agentes IA: pipelines multi-passo públicos de qualquer tenant + os próprios.
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

    const agents = await db.collection("ai_agents").find(filter).sort({ usesCount: -1, createdAt: -1 }).toArray();

    const formatted = agents.map((a: any) => ({
      id: a._id.toString(),
      name: a.name,
      description: a.description,
      category: a.category,
      steps: a.steps || [],
      isPublic: a.isPublic,
      usesCount: a.usesCount || 0,
      ownerName: a.ownerName,
      isMine: a.ownerId === userId,
      createdAt: a.createdAt,
    }));

    return NextResponse.json({ success: true, agents: formatted });
  } catch (error: any) {
    console.error("Erro ao listar Agentes IA:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Publica um novo Agente IA: uma sequência real de passos de IA (cada passo é uma
// instrução própria), executados em cadeia, onde o resultado de cada passo alimenta o seguinte.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { name, description, category, steps, isPublic } = await req.json();
    if (!name?.trim() || !description?.trim()) {
      return NextResponse.json({ error: "Nome e descrição do Agente são obrigatórios." }, { status: 400 });
    }
    if (!Array.isArray(steps) || steps.length < 2) {
      return NextResponse.json({ error: "Um Agente precisa de pelo menos 2 passos encadeados." }, { status: 400 });
    }
    const cleanSteps = steps
      .map((s: any) => ({ title: s.title?.trim() || "", instruction: s.instruction?.trim() || "" }))
      .filter((s: any) => s.title && s.instruction);
    if (cleanSteps.length < 2) {
      return NextResponse.json({ error: "Cada passo precisa de um título e de uma instrução." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const userRecord = await db.collection("users").findOne({ _id: userId });
    const ownerName = userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || userRecord.email : "Utilizador";

    const result = await db.collection("ai_agents").insertOne({
      tenant_id: tenantId,
      ownerId: userId,
      ownerName,
      name: name.trim(),
      description: description.trim(),
      category: category?.trim() || "Geral",
      steps: cleanSteps,
      isPublic: !!isPublic,
      usesCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await logAuditEvent(userId, "AI_AGENT_PUBLISHED", { tenantId, agentId: result.insertedId?.toString(), name: name.trim() });

    return NextResponse.json({ success: true, agentId: result.insertedId?.toString() });
  } catch (error: any) {
    console.error("Erro ao publicar Agente IA:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
