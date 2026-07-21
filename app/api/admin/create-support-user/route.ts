import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logAuditEvent } from "@/lib/audit";

/**
 * POST: Cria um novo utilizador pré-registado com o papel de SUPORTE global no tenant 'root'
 * Apenas acessível por utilizadores autenticados com o papel ativo de 'ADMIN'
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const db = await getDb();

    // 1. Validar se o solicitante existe na BD e é um administrador global ativo
    const caller = await db.collection("users").findOne({ _id: userId });
    const activeRole = req.cookies.get("active-role")?.value;

    if (!caller || activeRole !== "ADMIN") {
      return NextResponse.json({ error: "Apenas administradores globais podem criar utilizadores de suporte." }, { status: 403 });
    }

    const body = await req.json();
    const { email, firstName, lastName } = body;

    if (!email?.trim() || !firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: "Preencha todos os campos obrigatórios (email, firstName, lastName)." }, { status: 400 });
    }

    const emailClean = email.toLowerCase().trim();

    // 2. Verificar se o utilizador já existe
    const existingUser = await db.collection("users").findOne({ email: emailClean });

    if (existingUser) {
      const tenants = existingUser.tenants || [];
      const rootTenant = tenants.find((t: any) => t.tenantId === "root");

      if (rootTenant) {
        if (rootTenant.roles.includes("SUPORTE")) {
          return NextResponse.json({ error: "O utilizador já possui perfil de Suporte associado." }, { status: 400 });
        } else {
          rootTenant.roles.push("SUPORTE");
        }
      } else {
        tenants.push({ tenantId: "root", roles: ["SUPORTE"] });
      }

      await db.collection("users").updateOne(
        { _id: existingUser._id },
        { $set: { tenants, updatedAt: new Date() } }
      );
    } else {
      // Criar pré-registo completo para suporte
      const newSupportUser = {
        _id: `pre-registered-${new ObjectId().toString()}`,
        email: emailClean,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        tenants: [
          {
            tenantId: "root",
            roles: ["SUPORTE"]
          }
        ],
        globalAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await db.collection("users").insertOne(newSupportUser);
    }

    // Registar auditoria
    await logAuditEvent(userId, "GLOBAL_SUPPORT_USER_CREATED", {
      createdUserEmail: emailClean
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro em POST /api/admin/create-support-user:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
