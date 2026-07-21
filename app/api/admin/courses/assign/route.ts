import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

/**
 * POST: Atribui ou remove a inscrição de um curso para um estudante do tenant
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    const allowedRoles = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA", "FUNCIONARIO"];
    if (!activeRole || !allowedRoles.includes(activeRole)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const body = await req.json();
    const { studentId, courseId, action } = body; // action: "assign" | "unassign"

    if (!studentId || !courseId || !action) {
      return NextResponse.json({ error: "Campos 'studentId', 'courseId' e 'action' são obrigatórios." }, { status: 400 });
    }

    const db = await getDb();

    // 1. Validar se o estudante pertence ao mesmo tenant
    const student = await db.collection("users").findOne({ _id: studentId });
    if (!student) {
      return NextResponse.json({ error: "Estudante não encontrado." }, { status: 404 });
    }

    const belongs = student.tenants?.some((t: any) => t.tenantId === tenantId);
    if (!belongs && activeRole !== "ADMIN" && activeRole !== "SUPORTE") {
      return NextResponse.json({ error: "Este estudante não pertence à sua organização." }, { status: 403 });
    }

    if (action === "assign") {
      // Verificar se já está atribuído
      const exists = await db.collection("assigned_courses").findOne({ tenantId, userId: studentId, courseId });
      if (!exists) {
        await db.collection("assigned_courses").insertOne({
          tenantId,
          userId: studentId,
          courseId,
          assignedAt: new Date(),
          assignedBy: userId
        });
      }
    } else if (action === "unassign") {
      await db.collection("assigned_courses").deleteOne({ tenantId, userId: studentId, courseId });
    } else {
      return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    }

    // Registar auditoria
    await logAuditEvent(userId, action === "assign" ? "COURSE_ASSIGNED" : "COURSE_UNASSIGNED", {
      tenantId,
      targetStudentId: studentId,
      courseId
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro em POST /api/admin/courses/assign:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
