import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logAuditEvent } from "@/lib/audit";

/**
 * GET: Lista todos os tenants (empresas) do sistema (para ADMIN/SUPORTE)
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (activeRole !== "ADMIN" && activeRole !== "SUPORTE") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const db = await getDb();
    const companies = await db.collection("tenants").find({}).toArray();
    
    // Obter também a contagem de utilizadores por empresa
    const users = await db.collection("users").find({}).toArray();
    const companiesWithStats = companies.map((company: any) => {
      const companyUsers = users.filter((u: any) => 
        u.tenants?.some((t: any) => t.tenantId === company._id.toString())
      );
      
      const gestores = companyUsers.filter((u: any) => 
        u.tenants?.some((t: any) => t.tenantId === company._id.toString() && t.roles.includes("GESTOR_EMPRESA"))
      );

      return {
        ...company,
        employeesCount: companyUsers.length,
        gestorEmail: gestores[0]?.email || "Não atribuído",
        gestorName: gestores[0] ? `${gestores[0].firstName} ${gestores[0].lastName}`.trim() : "Não atribuído"
      };
    });

    return NextResponse.json(companiesWithStats);
  } catch (error: any) {
    console.error("Erro em GET /api/admin/companies:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST: Cria um novo inquilino (Empresa) e associa o seu respetivo GestorEmpresa
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (activeRole !== "ADMIN" && activeRole !== "SUPORTE") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const { companyName, subdomain, gestorEmail, gestorName } = body;

    if (!companyName || !subdomain || !gestorEmail || !gestorName) {
      return NextResponse.json({ error: "Preencha todos os campos obrigatórios." }, { status: 400 });
    }

    const db = await getDb();

    // Validar se subdomínio já existe
    const exists = await db.collection("tenants").findOne({ subdomain: subdomain.toLowerCase() });
    if (exists) {
      return NextResponse.json({ error: "Subdomínio já está em uso por outra empresa." }, { status: 400 });
    }

    // 1. Criar inquilino (Tenant)
    const newTenant = {
      name: companyName,
      subdomain: subdomain.toLowerCase(),
      brandColor: "#6366f1",
      logoUrl: "",
      ssoActive: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const tenantResult = await db.collection("tenants").insertOne(newTenant);
    const tenantIdStr = tenantResult.insertedId.toString();

    // 2. Criar utilizador GestorEmpresa (vinculado ao e-mail)
    const nameParts = gestorName.trim().split(" ");
    const firstName = nameParts[0] || "Gestor";
    const lastName = nameParts.slice(1).join(" ") || "Empresa";

    const newGestor = {
      _id: `pre-registered-${new ObjectId().toString()}`, // ID temporário que será atualizado no login
      email: gestorEmail.toLowerCase().trim(),
      firstName,
      lastName,
      tenants: [
        {
          tenantId: tenantIdStr,
          roles: ["GESTOR_EMPRESA"]
        }
      ],
      globalAdmin: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Verificar se já existe um utilizador com esse e-mail
    const existingUser = await db.collection("users").findOne({ email: newGestor.email });
    if (existingUser) {
      // Adicionar associação de tenant ao utilizador existente
      const updatedTenants = existingUser.tenants || [];
      if (!updatedTenants.some((t: any) => t.tenantId === tenantIdStr)) {
        updatedTenants.push({ tenantId: tenantIdStr, roles: ["GESTOR_EMPRESA"] });
        await db.collection("users").updateOne(
          { _id: existingUser._id },
          { $set: { tenants: updatedTenants, updatedAt: new Date() } }
        );
      }
    } else {
      await db.collection("users").insertOne(newGestor);
    }

    // Registar auditoria
    await logAuditEvent(userId, "COMPANY_CREATED", {
      companyId: tenantIdStr,
      companyName,
      gestorEmail
    });

    return NextResponse.json({ success: true, companyId: tenantIdStr });
  } catch (error: any) {
    console.error("Erro em POST /api/admin/companies:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT: Atualiza uma empresa (Tenant) e os dados do seu GestorEmpresa (para ADMIN/SUPORTE)
 */
export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (activeRole !== "ADMIN" && activeRole !== "SUPORTE") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const { companyId, companyName, subdomain, gestorEmail, gestorName } = body;

    if (!companyId || !companyName || !subdomain || !gestorEmail || !gestorName) {
      return NextResponse.json({ error: "Preencha todos os campos obrigatórios." }, { status: 400 });
    }

    const db = await getDb();

    let queryId;
    try {
      queryId = ObjectId.isValid(companyId) ? new ObjectId(companyId) : companyId;
    } catch {
      queryId = companyId;
    }

    // Validar se subdomínio já existe em outra empresa
    const exists = await db.collection("tenants").findOne({
      subdomain: subdomain.toLowerCase(),
      _id: { $ne: queryId }
    });
    if (exists) {
      return NextResponse.json({ error: "Subdomínio já está em uso por outra empresa." }, { status: 400 });
    }

    // 1. Atualizar inquilino (Tenant)
    await db.collection("tenants").updateOne(
      { _id: queryId },
      {
        $set: {
          name: companyName,
          subdomain: subdomain.toLowerCase(),
          updatedAt: new Date()
        }
      }
    );

    // 2. Encontrar ou atualizar o GestorEmpresa
    const companyIdStr = companyId.toString();
    const gestorUser = await db.collection("users").findOne({
      tenants: {
        $elemMatch: {
          tenantId: companyIdStr,
          roles: "GESTOR_EMPRESA"
        }
      }
    });

    const nameParts = gestorName.trim().split(" ");
    const firstName = nameParts[0] || "Gestor";
    const lastName = nameParts.slice(1).join(" ") || "Empresa";

    if (gestorUser) {
      await db.collection("users").updateOne(
        { _id: gestorUser._id },
        {
          $set: {
            email: gestorEmail.toLowerCase().trim(),
            firstName,
            lastName,
            updatedAt: new Date()
          }
        }
      );
    } else {
      const newGestor = {
        _id: `pre-registered-${new ObjectId().toString()}`,
        email: gestorEmail.toLowerCase().trim(),
        firstName,
        lastName,
        tenants: [
          {
            tenantId: companyIdStr,
            roles: ["GESTOR_EMPRESA"]
          }
        ],
        globalAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await db.collection("users").insertOne(newGestor);
    }

    await logAuditEvent(userId, "COMPANY_UPDATED", {
      companyId: companyIdStr,
      companyName,
      gestorEmail
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro em PUT /api/admin/companies:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE: Remove uma empresa (Tenant) e desassocia/remove os utilizadores dela (para ADMIN/SUPORTE)
 */
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (activeRole !== "ADMIN" && activeRole !== "SUPORTE") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("id");

    if (!companyId) {
      return NextResponse.json({ error: "O ID da empresa é obrigatório." }, { status: 400 });
    }

    const db = await getDb();

    let queryId;
    try {
      queryId = ObjectId.isValid(companyId) ? new ObjectId(companyId) : companyId;
    } catch {
      queryId = companyId;
    }

    // 1. Eliminar empresa da coleção tenants
    await db.collection("tenants").deleteOne({ _id: queryId });

    // 2. Eliminar ou limpar utilizadores associados a esta empresa
    const companyIdStr = companyId.toString();
    const users = await db.collection("users").find({
      "tenants.tenantId": companyIdStr
    }).toArray();

    for (const u of users) {
      const remainingTenants = u.tenants.filter((t: any) => t.tenantId !== companyIdStr);
      if (remainingTenants.length === 0 && !u.globalAdmin) {
        await db.collection("users").deleteOne({ _id: u._id });
      } else {
        await db.collection("users").updateOne(
          { _id: u._id },
          { $set: { tenants: remainingTenants, updatedAt: new Date() } }
        );
      }
    }

    // 3. Limpar progresso e cursos atribuídos a esta empresa
    await db.collection("assigned_courses").deleteMany({ tenant_id: companyIdStr });
    await db.collection("user_progress").deleteMany({ tenant_id: companyIdStr });
    await db.collection("study_history").deleteMany({ tenant_id: companyIdStr });

    await logAuditEvent(userId, "COMPANY_DELETED", { companyId: companyIdStr });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro em DELETE /api/admin/companies:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
