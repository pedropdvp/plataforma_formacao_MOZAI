import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { getTenantApiKeyStatus, setTenantApiKey, removeTenantApiKey } from "@/lib/ai/tenant-api-key";

const ALLOWED_ROLES = ["ADMIN", "GESTOR_EMPRESA"];

/**
 * GET — Estado da chave OpenAI do próprio tenant (nunca o valor completo, só
 * configurado/não-configurado + últimos caracteres). ADMIN vê ainda a lista de TODAS as
 * empresas com o respetivo estado (só visualização — não pode editar a chave de outra empresa).
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !ALLOWED_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const own = await getTenantApiKeyStatus(tenantId);

    let companies: any[] = [];
    if (activeRole === "ADMIN") {
      const db = await getDb();
      const tenants = await db.collection("tenants").find({}).toArray();
      companies = await Promise.all(
        tenants.map(async (t: any) => {
          const status = await getTenantApiKeyStatus(t._id.toString());
          return { name: t.name, ...status };
        })
      );
    }

    return NextResponse.json({ success: true, own, companies });
  } catch (error: any) {
    console.error("Erro ao consultar chaves de API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST — Define/atualiza a chave OpenAI do PRÓPRIO tenant (Admin define a da plataforma
 * ["root"], Gestor Empresa define só a da sua empresa — nunca a de outra).
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !ALLOWED_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const { apiKey } = await req.json();
    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      return NextResponse.json({ error: "A chave de API é obrigatória." }, { status: 400 });
    }

    await setTenantApiKey(tenantId, apiKey.trim());
    await logAuditEvent(userId, "TENANT_API_KEY_UPDATED", { tenantId });

    const status = await getTenantApiKeyStatus(tenantId);
    return NextResponse.json({ success: true, own: status });
  } catch (error: any) {
    console.error("Erro ao guardar chave de API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** DELETE — Remove a chave configurada do próprio tenant. */
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !ALLOWED_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    await removeTenantApiKey(tenantId);
    await logAuditEvent(userId, "TENANT_API_KEY_REMOVED", { tenantId });

    const status = await getTenantApiKeyStatus(tenantId);
    return NextResponse.json({ success: true, own: status });
  } catch (error: any) {
    console.error("Erro ao remover chave de API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
