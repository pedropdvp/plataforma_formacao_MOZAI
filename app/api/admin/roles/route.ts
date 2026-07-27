import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { PERMISSIONS_DATA } from "@/lib/seeder";

/**
 * Perfis de acesso (roles) e respetivo catálogo de permissões — usado tanto pelo ecrã
 * "Configuração > Perfil de Acesso" (gestão completa, exige ADMIN ativo) como pelo ecrã
 * /choose-role (leitura, só precisa que "ADMIN" esteja entre os perfis ATRIBUÍDOS ao
 * utilizador, mesmo que ainda não tenha escolhido nenhum perfil ativo nesta sessão —
 * é precisamente esse o momento em que /choose-role é usado).
 */

async function getAssignedRoles(userId: string, tenantId: string): Promise<string[]> {
  const db = await getDb();
  const userRecord = await db.collection("users").findOne({ _id: userId });
  if (!userRecord) return [];
  const tenantMapping = userRecord.tenants?.find((t: any) => t.tenantId === tenantId);
  return tenantMapping ? tenantMapping.roles : ["ALUNO"];
}

/** Leitura: permite se o utilizador é ADMIN/SUPORTE atualmente OU se ainda não escolheu
 * perfil ativo nesta sessão mas "ADMIN" está entre os seus perfis atribuídos (fluxo
 * /choose-role). */
async function canRead(req: NextRequest, userId: string, tenantId: string): Promise<boolean> {
  const activeRole = req.cookies.get("active-role")?.value;
  if (activeRole === "ADMIN" || activeRole === "SUPORTE") return true;
  if (!activeRole) {
    const assignedRoles = await getAssignedRoles(userId, tenantId);
    if (assignedRoles.includes("ADMIN")) return true;
  }
  return false;
}

function canWrite(req: NextRequest): boolean {
  const activeRole = req.cookies.get("active-role")?.value;
  return activeRole === "ADMIN" || activeRole === "SUPORTE";
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    if (!(await canRead(req, userId, tenantId))) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const db = await getDb();
    const roles = await db.collection("roles").find({}).toArray();

    return NextResponse.json({ success: true, roles, permissionsCatalog: PERMISSIONS_DATA });
  } catch (error: any) {
    console.error("Erro ao listar perfis de acesso:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** PATCH — Edita o nome, descrição e/ou permissões de um perfil de acesso existente. */
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }
    if (!canWrite(req)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { roleId, name, description, permissions } = await req.json();
    if (!roleId || typeof roleId !== "string") {
      return NextResponse.json({ error: "roleId é obrigatório." }, { status: 400 });
    }
    if (permissions !== undefined && (!Array.isArray(permissions) || !permissions.every((p) => typeof p === "string"))) {
      return NextResponse.json({ error: "permissions tem de ser uma lista de strings." }, { status: 400 });
    }

    const update: Record<string, any> = { updatedAt: new Date() };
    if (typeof name === "string" && name.trim()) update.name = name.trim();
    if (typeof description === "string") update.description = description.trim();
    if (permissions !== undefined) update.permissions = permissions;

    const db = await getDb();
    const result = await db.collection("roles").updateOne({ _id: roleId }, { $set: update });
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Perfil de acesso não encontrado." }, { status: 404 });
    }

    await logAuditEvent(userId, "ROLE_UPDATED", { roleId, changes: update });

    const updated = await db.collection("roles").findOne({ _id: roleId });
    return NextResponse.json({ success: true, role: updated });
  } catch (error: any) {
    console.error("Erro ao editar perfil de acesso:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** DELETE — Elimina um perfil de acesso. Não remove a atribuição de utilizadores que já
 * tenham este perfil (fica registada por utilizador) — apenas o registo central de
 * permissões, pelo que esses utilizadores passam a não ter permissões nesse perfil até
 * ser recriado. */
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }
    if (!canWrite(req)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const roleId = req.nextUrl.searchParams.get("roleId");
    if (!roleId) {
      return NextResponse.json({ error: "roleId é obrigatório." }, { status: 400 });
    }

    const db = await getDb();
    const result = await db.collection("roles").deleteOne({ _id: roleId });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Perfil de acesso não encontrado." }, { status: 404 });
    }

    await logAuditEvent(userId, "ROLE_DELETED", { roleId });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao eliminar perfil de acesso:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
