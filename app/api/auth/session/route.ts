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

    // Perfis atribuídos ao utilizador: união de TODOS os perfis que tem em TODAS as empresas
    // a que está associado (não só a empresa ativa no momento) — necessário porque, antes de
    // escolher um perfil, ainda não há nenhuma empresa "ativa" resolvida (ver POST abaixo, que
    // é quem define o cookie x-tenant-id de acordo com o perfil escolhido).
    const assignedRoles: string[] = Array.from(
      new Set((userRecord.tenants || []).flatMap((t: any) => t.roles || []))
    );
    if (assignedRoles.length === 0) assignedRoles.push("ALUNO");

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

    // Encontra em QUAL empresa o utilizador tem de facto este perfil (um utilizador pode ter
    // perfis diferentes em empresas diferentes) — é essa empresa que fica ativa na sessão,
    // nunca "root" por omissão. Antes desta correção, o cookie x-tenant-id nunca era definido
    // aqui, pelo que a plataforma ficava sempre presa ao tenant "root": um Gestor de Empresa a
    // escolher o seu próprio perfil continuava, na prática, a operar sobre os dados da empresa
    // errada (ex: colaboradores criados por si "desapareciam" por ficarem gravados no tenant
    // errado em vez da sua empresa real).
    const tenantMapping = (userRecord.tenants || []).find((t: any) => (t.roles || []).includes(role));
    const assignedRoles: string[] = Array.from(new Set((userRecord.tenants || []).flatMap((t: any) => t.roles || [])));

    // Validar se o utilizador possui o perfil solicitado. Exceção: um Administrador (perfil
    // ATRIBUÍDO, não precisa de já estar ativo) pode mudar para qualquer perfil existente na
    // plataforma, para testar o acesso de cada tipo de conta na sua própria empresa — desde
    // que o perfil pedido exista mesmo (nunca aceita um valor arbitrário).
    let resolvedTenantId = tenantMapping?.tenantId;
    if (!tenantMapping) {
      const isAdmin = assignedRoles.includes("ADMIN");
      const roleExists = isAdmin ? !!(await db.collection("roles").findOne({ _id: role })) : false;
      if (!roleExists) {
        return NextResponse.json({ error: "Acesso negado para este perfil" }, { status: 403 });
      }
      // Admin a "testar" um perfil que não tem atribuído em empresa nenhuma: mantém-se na
      // empresa em que já estava (normalmente "root"), nunca inventa uma empresa nova.
      resolvedTenantId = req.headers.get("x-tenant-id") || "root";
    }

    // Definir cookies com validade de 24h
    const response = NextResponse.json({ success: true, activeRole: role, tenantId: resolvedTenantId });
    response.cookies.set("active-role", role, {
      path: "/",
      maxAge: 60 * 60 * 24, // 24 horas
      httpOnly: false, // Permitir leitura do lado do cliente para controlo reativo de UI
      sameSite: "lax"
    });
    response.cookies.set("x-tenant-id", resolvedTenantId!, {
      path: "/",
      maxAge: 60 * 60 * 24,
      httpOnly: false,
      sameSite: "lax"
    });

    return response;
  } catch (error: any) {
    console.error("Erro em POST /api/auth/session:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
