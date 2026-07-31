import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { getEffectiveAgentPersona } from "@/lib/ai-agents-catalog";

const MANAGE_ROLES = ["ADMIN", "GESTOR_ACADEMICO", "FORMADOR"];

// GET — Detalhe completo de uma persona do catálogo (inclui o system prompt), só para
// Admin/Gestor Académico/Formador — é o texto que a ficha "Visualizar"/"Editar" mostra.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !MANAGE_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Permissões insuficientes." }, { status: 403 });
    }

    const { id } = await params;
    const persona = await getEffectiveAgentPersona(id);
    if (!persona) {
      return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ success: true, agent: persona });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH — Edita uma persona do catálogo curado (nome, papel, categoria, descrição, nota de
// âmbito e system prompt). Guarda a alteração em ai_agent_catalog_state, sem tocar no código.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !MANAGE_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Permissões insuficientes para editar o catálogo de Agentes IA." }, { status: 403 });
    }

    const { id } = await params;
    const existing = await getEffectiveAgentPersona(id);
    if (!existing) {
      return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 });
    }

    const { name, role, category, description, scopeNote, systemPrompt } = await req.json();
    if (!name?.trim() || !role?.trim() || !category?.trim() || !description?.trim() || !systemPrompt?.trim()) {
      return NextResponse.json({ error: "Nome, papel, categoria, descrição e system prompt são obrigatórios." }, { status: 400 });
    }

    const db = await getDb();
    await db.collection("ai_agent_catalog_state").updateOne(
      { _id: id },
      {
        $set: {
          name: name.trim(),
          role: role.trim(),
          category: category.trim(),
          description: description.trim(),
          scopeNote: scopeNote?.trim() || null,
          systemPrompt: systemPrompt.trim(),
          updatedAt: new Date(),
          updatedById: userId,
        },
      },
      { upsert: true }
    );

    await logAuditEvent(userId, "AI_AGENT_CATALOG_UPDATED", { agentId: id, name: name.trim() });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — Remove uma persona do catálogo curado (marca como apagada; não altera o código-fonte).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !MANAGE_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Permissões insuficientes para remover Agentes IA do catálogo." }, { status: 403 });
    }

    const { id } = await params;
    const existing = await getEffectiveAgentPersona(id);
    if (!existing) {
      return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 });
    }

    const db = await getDb();
    await db.collection("ai_agent_catalog_state").updateOne(
      { _id: id },
      { $set: { deleted: true, updatedAt: new Date(), updatedById: userId } },
      { upsert: true }
    );

    await logAuditEvent(userId, "AI_AGENT_CATALOG_DELETED", { agentId: id, name: existing.name });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
