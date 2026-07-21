import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    const allowedRoles = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA"];
    if (!activeRole || !allowedRoles.includes(activeRole)) {
      return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
    }

    const db = await getDb();
    const userRecord = await db.collection("users").findOne({ _id: userId });
    if (!userRecord) {
      return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });
    }

    const isGlobal = activeRole === "ADMIN" || activeRole === "SUPORTE";

    // 1. Obter Empresas (Tenants)
    let companies: any[] = [];
    if (isGlobal) {
      companies = await db.collection("tenants").find({}).toArray();
    } else {
      // Gestor da empresa: apenas empresas onde ele está associado
      const userTenantIds = (userRecord.tenants || []).map((t: any) => t.tenantId);
      companies = await db.collection("tenants").find({
        _id: { $in: userTenantIds.map((id: string) => id) }
      }).toArray();

      // Adicionar root se estiver associado
      if (userTenantIds.includes("root")) {
        companies.push({ _id: "root", name: "MOZAI AI Education Platform Corporation" });
      }
    }

    const companyIds = companies.map((c: any) => c._id.toString());
    const companyNames: Record<string, string> = {
      root: "MOZAI AI Education Platform Corporation"
    };
    companies.forEach((c: any) => {
      companyNames[c._id.toString()] = c.name;
    });

    // 2. Obter todos os utilizadores associados a estas empresas
    let users: any[] = [];
    const allUsers = await db.collection("users").find({}).toArray();

    if (isGlobal) {
      users = allUsers;
    } else {
      // Filtrar apenas utilizadores que partilham algum tenant com este gestor
      users = allUsers.filter((u: any) => 
        u.tenants?.some((ut: any) => companyIds.includes(ut.tenantId))
      );
    }

    // 3. Obter progresso dos alunos das empresas para relatórios
    let progress: any[] = [];
    if (isGlobal) {
      progress = await db.collection("progress").find({}).toArray();
    } else {
      progress = await db.collection("progress").find({
        tenantId: { $in: companyIds }
      }).toArray();
    }

    // Obter todos os cursos
    const catalog = await db.collection("courses").find({}).toArray();

    return NextResponse.json({
      companies,
      users: users.map((u: any) => ({
        _id: u._id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        tenants: (u.tenants || []).map((ut: any) => ({
          ...ut,
          companyName: companyNames[ut.tenantId] || ut.tenantId
        }))
      })),
      progress,
      catalog
    });
  } catch (error: any) {
    console.error("Erro em GET /api/admin/reports/data:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
