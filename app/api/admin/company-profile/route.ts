import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

const REVIEWER_ROLES = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA"];

// GET — Devolve o perfil público de marketplace da própria empresa (ou null se ainda
// não foi criado).
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const profile = await db.collection("company_marketplace_profiles").findOne({ tenant_id: tenantId });

    return NextResponse.json({ success: true, profile: profile ? { ...profile, _id: profile._id.toString() } : null });
  } catch (error: any) {
    console.error("Erro ao ler perfil público da empresa:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Cria ou atualiza o perfil público de marketplace da empresa (descrição,
// setor, website, e se está visível no Marketplace para os alunos).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !REVIEWER_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Só Admin, Suporte ou Gestor de Empresa podem gerir o perfil público da empresa." }, { status: 403 });
    }

    const { description, industry, website, isPublic } = await req.json();
    if (!description || !description.trim()) {
      return NextResponse.json({ error: "A descrição da empresa é obrigatória." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const tenantSettings = await db.collection("tenant_settings").findOne({ tenant_id: tenantId });
    const companyName = tenantSettings?.companyName || tenantId.toUpperCase();
    const logoUrl = tenantSettings?.logoUrl || "";

    await db.collection("company_marketplace_profiles").updateOne(
      { tenant_id: tenantId },
      {
        $set: {
          tenant_id: tenantId,
          companyName,
          logoUrl,
          description: description.trim(),
          industry: (industry || "").trim(),
          website: (website || "").trim(),
          isPublic: isPublic !== false,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    await logAuditEvent(userId, "COMPANY_MARKETPLACE_PROFILE_SAVED", { tenantId, isPublic: isPublic !== false });

    return NextResponse.json({ success: true, message: "Perfil público da empresa guardado com sucesso." });
  } catch (error: any) {
    console.error("Erro ao guardar perfil público da empresa:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
