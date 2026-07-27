import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { getChatbotDocumentStatus, clearChatbotDocument } from "@/lib/chatbot-documents";

const ALLOWED_ROLES = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA"];

/**
 * GET — Estado do PDF de conhecimento do próprio tenant. ADMIN vê ainda a lista de
 * TODAS as empresas com o respetivo estado (só visualização — não pode gerir o PDF de
 * outra empresa), tal como em /api/admin/api-keys.
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

    const tenantId = activeRole === "GESTOR_EMPRESA" ? req.headers.get("x-tenant-id") || "root" : "root";
    const own = await getChatbotDocumentStatus(tenantId);

    let companies: any[] = [];
    if (activeRole === "ADMIN" || activeRole === "SUPORTE") {
      const db = await getDb();
      const tenants = await db.collection("tenants").find({}).toArray();
      companies = await Promise.all(
        tenants.map(async (t: any) => {
          const status = await getChatbotDocumentStatus(t._id.toString());
          return { name: t.name, ...status };
        })
      );
    }

    return NextResponse.json({ success: true, own, companies });
  } catch (error: any) {
    console.error("Erro ao consultar o ChatBot:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** DELETE — Remove o PDF de conhecimento configurado do próprio tenant. */
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

    const isCompanyScoped = activeRole === "GESTOR_EMPRESA";
    const tenantId = isCompanyScoped ? req.headers.get("x-tenant-id") || "" : "root";
    if (isCompanyScoped && !tenantId) {
      return NextResponse.json({ error: "Empresa não identificada." }, { status: 400 });
    }

    await clearChatbotDocument(tenantId);
    await logAuditEvent(userId, "CHATBOT_DOCUMENT_REMOVED", { tenantId });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao remover o PDF do ChatBot:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
