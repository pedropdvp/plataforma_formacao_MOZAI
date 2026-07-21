import { NextRequest, NextResponse } from "next/server";
import { findTenantScoped, insertTenantScoped, deleteTenantScoped } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { logAuditEvent } from "@/lib/audit";

/**
 * GET: Lista todas as gerações de conteúdo do tenant ativo
 */
export async function GET(req: NextRequest) {
  try {
    const tenantId = req.headers.get("x-tenant-id") || "root";
    
    // Obter todas as gerações do banco de dados ordenadas por data de criação descrescente
    const generations = await findTenantScoped("content_factory_generations", tenantId);
    
    // Inverter para mostrar os mais novos primeiro (MongoDB toArray no-sort fallback)
    generations.reverse();

    return NextResponse.json(generations);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST: Salva uma nova estrutura de aula gerada no MongoDB
 */
export async function POST(req: NextRequest) {
  try {
    const activeRole = req.cookies.get("active-role")?.value;
    const allowedRoles = ["ADMIN", "GESTOR_ACADEMICO", "FORMADOR"];
    if (!activeRole || !allowedRoles.includes(activeRole)) {
      return NextResponse.json({ error: "Permissões insuficientes para esta ação." }, { status: 403 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const body = await req.json();

    const { topic, script, slides, quiz, lab } = body;

    if (!topic || !script) {
      return NextResponse.json(
        { error: "Tópico e Roteiro (Script) são obrigatórios para guardar." },
        { status: 400 }
      );
    }

    const newGeneration = {
      topic,
      script,
      slides: slides || [],
      quiz: quiz || [],
      lab: lab || "",
      createdAt: new Date(),
    };

    // Salvar utilizando o helper seguro que força o tenant_id
    const result = await insertTenantScoped("content_factory_generations", tenantId, newGeneration);

    const { userId } = await auth();
    if (userId) {
      await logAuditEvent(userId, "CONTENT_GENERATION_CREATED", {
        generationId: result.insertedId,
        topic
      });
    }

    return NextResponse.json({ success: true, id: result.insertedId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE: Apaga uma geração existente pelo seu _id
 */
export async function DELETE(req: NextRequest) {
  try {
    const activeRole = req.cookies.get("active-role")?.value;
    const allowedRoles = ["ADMIN", "GESTOR_ACADEMICO", "FORMADOR"];
    if (!activeRole || !allowedRoles.includes(activeRole)) {
      return NextResponse.json({ error: "Permissões insuficientes para esta ação." }, { status: 403 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "O parâmetro ID é obrigatório." }, { status: 450 });
    }

    // Apagar utilizando o helper que restringe pelo tenant_id do utilizador
    const result = await deleteTenantScoped("content_factory_generations", tenantId, {
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Geração de conteúdo não encontrada ou sem autorização." }, { status: 404 });
    }

    const { userId } = await auth();
    if (userId) {
      await logAuditEvent(userId, "CONTENT_GENERATION_DELETED", {
        generationId: id
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
