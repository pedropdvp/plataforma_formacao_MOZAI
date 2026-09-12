import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import {
  ASSIGNER_ROLES,
  TEACHING_ROLES,
  assignStaff,
  listAssignments,
  removeAssignment,
} from "@/lib/academics";

/** Confirma que a pessoa existe e pertence a este tenant — o isolamento entre empresas
 *  não pode depender de o cliente enviar só ids legítimos. */
async function membroDoTenant(userId: string, tenantId: string) {
  const db = await getDb();
  const user = await db.collection("users").findOne({ _id: userId as never });
  if (!user) return null;
  const vinculo = (user.tenants || []).find((t: any) => t.tenantId === tenantId);
  return vinculo ? { user, roles: (vinculo.roles || []) as string[] } : null;
}

function autorizado(req: NextRequest) {
  const activeRole = req.cookies.get("active-role")?.value;
  return activeRole && ASSIGNER_ROLES.includes(activeRole) ? activeRole : null;
}

// GET — Atribuições do tenant, mais o corpo docente e os alunos disponíveis para atribuir.
// Devolve tudo o que o ecrã precisa num só pedido, como faz /api/admin/academy/tracks.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }
    if (!autorizado(req)) {
      return NextResponse.json({ error: "Sem permissão para gerir o corpo docente." }, { status: 403 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const [assignments, membros] = await Promise.all([
      listAssignments(tenantId),
      db.collection("users").find({ "tenants.tenantId": tenantId }).toArray(),
    ]);

    const perfisNoTenant = (u: any): string[] =>
      (u.tenants || []).find((t: any) => t.tenantId === tenantId)?.roles || [];

    const staff = membros
      .filter((u: any) => perfisNoTenant(u).some((r: string) => TEACHING_ROLES.includes(r as never)))
      .map((u: any) => ({
        id: u._id,
        name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
        email: u.email,
        roles: perfisNoTenant(u).filter((r: string) => TEACHING_ROLES.includes(r as never)),
      }));

    const students = membros
      .filter((u: any) => perfisNoTenant(u).includes("ALUNO"))
      .map((u: any) => ({
        id: u._id,
        name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
        email: u.email,
      }));

    return NextResponse.json({ success: true, assignments, staff, students });
  } catch (error: any) {
    console.error("Erro ao listar atribuições do corpo docente:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Atribui um curso (ou um aluno, em tutela) a um docente.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }
    if (!autorizado(req)) {
      return NextResponse.json({ error: "Sem permissão para gerir o corpo docente." }, { status: 403 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const { staffId, scope, courseId, studentId } = await req.json();

    if (!staffId || !scope || !["course", "student"].includes(scope)) {
      return NextResponse.json({ error: "Indique o docente e o tipo de atribuição." }, { status: 400 });
    }
    if (scope === "course" && !courseId) {
      return NextResponse.json({ error: "Indique o curso a atribuir." }, { status: 400 });
    }
    if (scope === "student" && !studentId) {
      return NextResponse.json({ error: "Indique o aluno a atribuir." }, { status: 400 });
    }

    const docente = await membroDoTenant(staffId, tenantId);
    if (!docente) {
      return NextResponse.json({ error: "Docente não encontrado nesta empresa." }, { status: 404 });
    }
    const perfilDocente = docente.roles.find((r) => TEACHING_ROLES.includes(r as never));
    if (!perfilDocente) {
      return NextResponse.json(
        { error: "Este utilizador não tem nenhum perfil docente nesta empresa." },
        { status: 400 }
      );
    }

    if (scope === "student") {
      const aluno = await membroDoTenant(studentId, tenantId);
      if (!aluno || !aluno.roles.includes("ALUNO")) {
        return NextResponse.json({ error: "Aluno não encontrado nesta empresa." }, { status: 404 });
      }
    }

    const criada = await assignStaff(tenantId, {
      staffId,
      staffRole: perfilDocente,
      scope,
      courseId,
      studentId,
      assignedBy: userId,
    });

    if (!criada) {
      return NextResponse.json({ success: true, alreadyExists: true });
    }

    await logAuditEvent(userId, "ACADEMIC_ASSIGNMENT_CREATED", {
      tenantId,
      staffId,
      staffRole: perfilDocente,
      scope,
      courseId: courseId || null,
      studentId: studentId || null,
    });

    return NextResponse.json({ success: true, assignment: criada });
  } catch (error: any) {
    console.error("Erro ao criar atribuição do corpo docente:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — Remove uma atribuição (?id=...). Não mexe em progresso nem em inscrições de cursos:
// tirar um docente de um curso não desinscreve os alunos desse curso.
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }
    if (!autorizado(req)) {
      return NextResponse.json({ error: "Sem permissão para gerir o corpo docente." }, { status: 403 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const assignmentId = req.nextUrl.searchParams.get("id");
    if (!assignmentId) {
      return NextResponse.json({ error: "Indique a atribuição a remover." }, { status: 400 });
    }

    const removida = await removeAssignment(tenantId, assignmentId);
    if (!removida) {
      return NextResponse.json({ error: "Atribuição não encontrada." }, { status: 404 });
    }

    await logAuditEvent(userId, "ACADEMIC_ASSIGNMENT_REMOVED", { tenantId, assignmentId });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao remover atribuição do corpo docente:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
