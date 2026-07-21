import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

/**
 * GET: Obtém o perfil ativo da sessão e as permissões associadas
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    // 1. Obter ou criar o registo de utilizador na base de dados
    let userRecord = await db.collection("users").findOne({ _id: userId });
    
    if (!userRecord) {
      const user = await currentUser();
      const userEmail = user?.emailAddresses?.[0]?.emailAddress;
      
      if (userEmail) {
        // Procurar se foi pré-registado por e-mail pelo Administrador ou Gestor de Empresa
        const preRegistered = await db.collection("users").findOne({ email: userEmail.toLowerCase().trim() });
        if (preRegistered) {
          // Excluir documento antigo e reinserir com o ID oficial do Clerk
          await db.collection("users").deleteOne({ _id: preRegistered._id });
          userRecord = {
            ...preRegistered,
            _id: userId,
            firstName: user?.firstName || preRegistered.firstName,
            lastName: user?.lastName || preRegistered.lastName,
            updatedAt: new Date()
          };
          await db.collection("users").insertOne(userRecord);
        }
      }
    }

    if (!userRecord) {
      const user = await currentUser();
      const userEmail = user?.emailAddresses?.[0]?.emailAddress;
      
      if (userEmail) {
        const usersCount = await db.collection("users").countDocuments({});
        if (usersCount === 0) {
          // Primeiro utilizador vira admin (bootstrapping)
          userRecord = {
            _id: userId,
            email: userEmail.toLowerCase().trim(),
            firstName: user?.firstName || "Admin",
            lastName: user?.lastName || "Principal",
            tenants: [
              {
                tenantId: "root",
                roles: ["ADMIN"]
              }
            ],
            globalAdmin: true,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          await db.collection("users").insertOne(userRecord);
        } else {
          // Aluno Individual auto-registado
          userRecord = {
            _id: userId,
            email: userEmail.toLowerCase().trim(),
            firstName: user?.firstName || "Aluno",
            lastName: user?.lastName || "Individual",
            tenants: [
              {
                tenantId: "root",
                roles: ["ALUNO"]
              }
            ],
            globalAdmin: false,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          await db.collection("users").insertOne(userRecord);
        }
      } else {
        return NextResponse.json({ error: "unregistered" }, { status: 403 });
      }
    }

    // Encontrar perfis do utilizador para o tenant ativo
    const tenantMapping = userRecord.tenants?.find((t: any) => t.tenantId === tenantId);
    const assignedRoles: string[] = tenantMapping ? tenantMapping.roles : ["ALUNO"];

    // 2. Obter o cookie de papel ativo
    let activeRole = req.cookies.get("active-role")?.value || null;

    // Se o papel ativo não pertencer aos papéis atribuídos, anula-o
    if (activeRole && !assignedRoles.includes(activeRole)) {
      activeRole = null;
    }

    // 3. Se tiver papel ativo, procurar as suas permissões associadas
    let permissions: string[] = [];
    if (activeRole) {
      const roleRecord = await db.collection("roles").findOne({ _id: activeRole });
      permissions = roleRecord ? roleRecord.permissions : [];
    }

    return NextResponse.json({
      authenticated: true,
      userId,
      activeRole,
      assignedRoles,
      permissions,
      userName: `${userRecord.firstName} ${userRecord.lastName}`.trim(),
      userEmail: userRecord.email
    });
  } catch (error: any) {
    console.error("Erro em GET /api/auth/session:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST: Define/altera o perfil ativo na sessão (cookie)
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const body = await req.json();
    const { role } = body;

    if (!role) {
      return NextResponse.json({ error: "Perfil não especificado" }, { status: 400 });
    }

    const db = await getDb();
    const userRecord = await db.collection("users").findOne({ _id: userId });
    
    if (!userRecord) {
      return NextResponse.json({ error: "Utilizador não registado" }, { status: 404 });
    }

    const tenantMapping = userRecord.tenants?.find((t: any) => t.tenantId === tenantId);
    const assignedRoles: string[] = tenantMapping ? tenantMapping.roles : ["ALUNO"];

    // Validar se o utilizador possui o perfil solicitado
    if (!assignedRoles.includes(role)) {
      return NextResponse.json({ error: "Acesso negado para este perfil" }, { status: 403 });
    }

    // Definir cookie com validade de 24h
    const response = NextResponse.json({ success: true, activeRole: role });
    response.cookies.set("active-role", role, {
      path: "/",
      maxAge: 60 * 60 * 24, // 24 horas
      httpOnly: false, // Permitir leitura do lado do cliente para controlo reativo de UI
      sameSite: "lax"
    });

    return response;
  } catch (error: any) {
    console.error("Erro em POST /api/auth/session:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
