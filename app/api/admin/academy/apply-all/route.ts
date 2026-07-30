import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

const REVIEWER_ROLES = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA"];

// POST — Aplica o currículo atual da Academia Corporativa a TODOS os colaboradores
// do tenant de uma só vez: atribui (assigned_courses) cada curso do currículo a cada
// colaborador que ainda não o tenha. Não remove atribuições feitas individualmente na
// Gestão de RH — é aditivo, nunca destrutivo. Deve ser corrido de novo sempre que
// entrarem novos colaboradores ou o currículo mudar.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !REVIEWER_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Só Admin, Suporte ou Gestor de Empresa podem aplicar o currículo da Academia." }, { status: 403 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const curriculum = await db.collection("academy_curricula").findOne({ tenant_id: tenantId });
    const courseIds: string[] = curriculum?.courseIds || [];
    if (courseIds.length === 0) {
      return NextResponse.json({ error: "Defina pelo menos um curso no currículo antes de aplicar." }, { status: 400 });
    }

    const employees = await db.collection("users").find({ "tenants.tenantId": tenantId }).toArray();
    if (employees.length === 0) {
      return NextResponse.json({ error: "Esta empresa ainda não tem colaboradores registados." }, { status: 400 });
    }

    const existingAssignments = await db.collection("assigned_courses").find({ tenantId }).toArray();
    const existingKeys = new Set(existingAssignments.map((a: any) => `${a.userId}::${a.courseId}`));

    let created = 0;
    for (const employee of employees) {
      for (const courseId of courseIds) {
        const key = `${employee._id}::${courseId}`;
        if (existingKeys.has(key)) continue;
        await db.collection("assigned_courses").insertOne({
          tenantId,
          userId: employee._id,
          courseId,
          assignedAt: new Date(),
          assignedBy: userId,
          viaAcademyRollout: true,
        });
        created++;
      }
    }

    await logAuditEvent(userId, "ACADEMY_CURRICULUM_APPLIED_TO_ALL", {
      tenantId,
      employeeCount: employees.length,
      courseCount: courseIds.length,
      newAssignments: created,
    });

    return NextResponse.json({
      success: true,
      message: `Currículo aplicado a ${employees.length} colaborador(es). ${created} nova(s) atribuição(ões) criada(s).`,
      employeeCount: employees.length,
      newAssignments: created,
    });
  } catch (error: any) {
    console.error("Erro ao aplicar currículo da Academia Corporativa a todos os colaboradores:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
