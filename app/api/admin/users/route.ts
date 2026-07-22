import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logAuditEvent } from "@/lib/audit";

/**
 * GET: Lista utilizadores vinculados ao tenant ativo (excluindo os administradores)
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    const allowedRoles = [
      "ADMIN", "SUPORTE", "GESTOR_EMPRESA", "FUNCIONARIO", 
      "GESTOR_ACADEMICO", "PROFESSOR", "FORMADOR", "TUTOR", "FINANCEIRO"
    ];
    if (!activeRole || !allowedRoles.includes(activeRole)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    // Obter todas as empresas e as configurações do root
    const companies = await db.collection("tenants").find({}).toArray();
    const rootSettings = await db.collection("tenant_settings").findOne({ tenant_id: "root" });
    const rootCompanyName = rootSettings?.companyName || "MOZAI Global";

    const companyMap: Record<string, string> = {
      root: rootCompanyName
    };
    for (const c of companies) {
      companyMap[c._id.toString()] = c.name;
    }

    // Obter todos os utilizadores (excluindo ADMINs e administradores globais)
    const users = await db.collection("users").find({}).toArray();
    const tenantUsers = users.filter((u: any) => 
      u.tenants?.some((t: any) => t.tenantId === tenantId) &&
      !u.globalAdmin &&
      !u.tenants?.some((t: any) => t.tenantId === tenantId && t.roles.includes("ADMIN"))
    );

    // Separar por Alunos e Funcionários (para retrocompatibilidade)
    const employees = tenantUsers.filter((u: any) => 
      u.tenants?.some((t: any) => t.tenantId === tenantId && t.roles.includes("FUNCIONARIO"))
    );

    const students = tenantUsers.filter((u: any) => 
      u.tenants?.some((t: any) => t.tenantId === tenantId && t.roles.includes("ALUNO"))
    );

    // Carregar também os cursos atribuídos a cada estudante
    const assignedCoursesList = await db.collection("assigned_courses").find({ tenantId }).toArray();
    const tenantUsersWithCourses = tenantUsers.map((user: any) => {
      const userAssigned = assignedCoursesList.filter((ac: any) => ac.userId === user._id);
      
      const resolvedTenants = (user.tenants || []).map((t: any) => ({
        ...t,
        companyName: companyMap[t.tenantId] || t.tenantId
      }));

      return {
        ...user,
        tenants: resolvedTenants,
        assignedCourses: userAssigned.map((ac: any) => ac.courseId)
      };
    });

    return NextResponse.json({
      users: tenantUsersWithCourses,
      employees,
      students
    });
  } catch (error: any) {
    console.error("Erro em GET /api/admin/users:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST: Cria um novo utilizador no tenant ativo
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    const allowedRoles = [
      "ADMIN", "SUPORTE", "GESTOR_EMPRESA", "FUNCIONARIO",
      "GESTOR_ACADEMICO", "PROFESSOR", "FORMADOR", "TUTOR", "FINANCEIRO"
    ];
    if (!activeRole || !allowedRoles.includes(activeRole)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const requestTenantId = req.headers.get("x-tenant-id") || "root";
    const body = await req.json();
    const { name, email, role, registerAsIndividual } = body;

    if (!name || !email || !role) {
      return NextResponse.json({ error: "Preencha todos os campos obrigatórios." }, { status: 400 });
    }

    // Registo de Aluno Individual (sem empresa): fica associado ao tenant "root",
    // independentemente da empresa em que o administrador está a operar no momento.
    // Só ADMIN/SUPORTE podem criar alunos individuais (evita que um GESTOR_EMPRESA
    // registe utilizadores fora do âmbito da sua própria empresa).
    if (registerAsIndividual) {
      if (role !== "ALUNO") {
        return NextResponse.json({ error: "Só é possível registar Alunos como individuais." }, { status: 400 });
      }
      if (!["ADMIN", "SUPORTE"].includes(activeRole)) {
        return NextResponse.json({ error: "Não tem permissões para registar um aluno individual." }, { status: 403 });
      }
    }
    const tenantId = registerAsIndividual ? "root" : requestTenantId;

    const db = await getDb();

    const nameParts = name.trim().split(" ");
    const firstName = nameParts[0] || "Nome";
    const lastName = nameParts.slice(1).join(" ") || "Sobrenome";

    const emailClean = email.toLowerCase().trim();

    // Procurar se o utilizador já existe na base de dados
    const existingUser = await db.collection("users").findOne({ email: emailClean });

    if (existingUser) {
      // Validar se já possui este tenant associado
      const tenantMapping = existingUser.tenants || [];
      const match = tenantMapping.find((t: any) => t.tenantId === tenantId);
      
      if (match) {
        if (match.roles.includes(role)) {
          return NextResponse.json({ error: "Utilizador já possui este perfil associado à empresa." }, { status: 400 });
        } else {
          match.roles.push(role);
        }
      } else {
        tenantMapping.push({ tenantId, roles: [role] });
      }

      await db.collection("users").updateOne(
        { _id: existingUser._id },
        { $set: { tenants: tenantMapping, updatedAt: new Date() } }
      );
    } else {
      // Criar pré-registo de utilizador
      const newUser = {
        _id: `pre-registered-${new ObjectId().toString()}`,
        email: emailClean,
        firstName,
        lastName,
        tenants: [
          {
            tenantId,
            roles: [role]
          }
        ],
        globalAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await db.collection("users").insertOne(newUser);
    }

    // Registar auditoria
    await logAuditEvent(userId, "COMPANY_USER_CREATED", {
      tenantId,
      createdUserEmail: emailClean,
      createdUserRole: role
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro em POST /api/admin/users:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT: Atualiza um utilizador existente (Nome, Email, Role)
 */
export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    const allowedRoles = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA", "GESTOR_ACADEMICO"];
    if (!activeRole || !allowedRoles.includes(activeRole)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const body = await req.json();
    const { targetUserId, name, email, role } = body;

    if (!targetUserId || !name || !email || !role) {
      return NextResponse.json({ error: "Parâmetros obrigatórios em falta." }, { status: 400 });
    }

    const db = await getDb();

    // Encontrar o utilizador alvo
    const userToEdit = await db.collection("users").findOne({ _id: targetUserId });
    if (!userToEdit) {
      return NextResponse.json({ error: "Utilizador não encontrado." }, { status: 404 });
    }

    // Não permitir editar se for admin principal ou se for o próprio utilizador logado de forma indevida
    if (userToEdit.globalAdmin && userId !== targetUserId && activeRole !== "ADMIN") {
      return NextResponse.json({ error: "Não tem permissões para editar um Administrador Global." }, { status: 403 });
    }

    const nameParts = name.trim().split(" ");
    const firstName = nameParts[0] || "Nome";
    const lastName = nameParts.slice(1).join(" ") || "Sobrenome";
    const emailClean = email.toLowerCase().trim();

    // Atualizar dados gerais e o papel no tenant atual
    const updatedTenants = (userToEdit.tenants || []).map((t: any) => {
      if (t.tenantId === tenantId) {
        return {
          ...t,
          roles: [role]
        };
      }
      return t;
    });

    const hasTenant = updatedTenants.some((t: any) => t.tenantId === tenantId);
    if (!hasTenant) {
      updatedTenants.push({ tenantId, roles: [role] });
    }

    await db.collection("users").updateOne(
      { _id: targetUserId },
      {
        $set: {
          firstName,
          lastName,
          email: emailClean,
          tenants: updatedTenants,
          updatedAt: new Date()
        }
      }
    );

    // Registar auditoria
    await logAuditEvent(userId, "COMPANY_USER_UPDATED", {
      tenantId,
      updatedUserEmail: emailClean,
      updatedUserRole: role
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro em PUT /api/admin/users:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE: Remove um utilizador do tenant ativo
 */
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    const allowedRoles = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA"];
    if (!activeRole || !allowedRoles.includes(activeRole)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const targetUserId = req.nextUrl.searchParams.get("targetUserId");

    if (!targetUserId) {
      return NextResponse.json({ error: "ID do utilizador é obrigatório." }, { status: 400 });
    }

    if (userId === targetUserId) {
      return NextResponse.json({ error: "Não pode eliminar a sua própria conta." }, { status: 400 });
    }

    const db = await getDb();
    const userToDelete = await db.collection("users").findOne({ _id: targetUserId });

    if (!userToDelete) {
      return NextResponse.json({ error: "Utilizador não encontrado." }, { status: 404 });
    }

    // Não permitir apagar admins globais
    if (userToDelete.globalAdmin) {
      return NextResponse.json({ error: "Não é permitido eliminar um Administrador Global." }, { status: 403 });
    }

    // Se o utilizador tem múltiplos tenants mapeados, apenas removemos a associação a este tenant
    const tenants = userToDelete.tenants || [];
    const otherTenants = tenants.filter((t: any) => t.tenantId !== tenantId);

    if (otherTenants.length > 0) {
      await db.collection("users").updateOne(
        { _id: targetUserId },
        { $set: { tenants: otherTenants, updatedAt: new Date() } }
      );
    } else {
      await db.collection("users").deleteOne({ _id: targetUserId });
    }

    // Registar auditoria
    await logAuditEvent(userId, "COMPANY_USER_DELETED", {
      tenantId,
      deletedUserEmail: userToDelete.email
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro em DELETE /api/admin/users:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
