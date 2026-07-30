import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

// GET — Lista as empresas com perfil público ativo no Marketplace, cada uma com as
// suas vagas reais em aberto (nunca vagas inventadas — só as que a própria empresa
// publicou em /dashboard/admin/company-profile).
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const db = await getDb();

    const [profiles, jobs] = await Promise.all([
      db.collection("company_marketplace_profiles").find({ isPublic: true }).toArray(),
      db.collection("job_postings").find({ isActive: true }).toArray(),
    ]);

    const companies = profiles.map((p: any) => ({
      tenantId: p.tenant_id,
      companyName: p.companyName,
      logoUrl: p.logoUrl || "",
      description: p.description,
      industry: p.industry || "",
      website: p.website || "",
      jobs: jobs
        .filter((j: any) => j.tenant_id === p.tenant_id)
        .map((j: any) => ({
          id: j._id.toString(),
          title: j.title,
          description: j.description,
          location: j.location,
          workMode: j.workMode,
        })),
    }));

    return NextResponse.json({ success: true, companies });
  } catch (error: any) {
    console.error("Erro ao listar empresas do Marketplace:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
