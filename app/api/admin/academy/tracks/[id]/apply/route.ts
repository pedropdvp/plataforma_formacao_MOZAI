import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

const REVIEWER_ROLES = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA"];

// POST — Aplica os cursos de UMA trilha a colaboradores específicos (ou a todos, se
// 'employeeIds' vier vazio/omitido) — é o que permite trilhas verdadeiramente distintas
// por área: a trilha Técnica vai só para a equipa técnica, a de Liderança só para
// gestores, etc., em vez de um único currículo igual para toda a empresa. Aditivo —
// nunca remove atribuições já feitas individualmente na Gestão de RH.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !REVIEWER_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Só Admin, Suporte ou Gestor de Empresa podem aplicar trilhas da Academia." }, { status: 403 });
    }

    const { id } = await params;
    const { employeeIds } = await req.json().catch(() => ({ employeeIds: [] }));
    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const track = await db.collection("academy_tracks").findOne({ _id: new ObjectId(id), tenant_id: tenantId });
    if (!track) {
      return NextResponse.json({ error: "Trilha não encontrada." }, { status: 404 });
    }
    const courseIds: string[] = track.courseIds || [];
    if (courseIds.length === 0) {
      return NextResponse.json({ error: "Esta trilha ainda não tem nenhum curso definido." }, { status: 400 });
    }

    let targetEmployees: any[];
    if (Array.isArray(employeeIds) && employeeIds.length > 0) {
      targetEmployees = await db.collection("users").find({ _id: { $in: employeeIds }, "tenants.tenantId": tenantId }).toArray();
    } else {
      targetEmployees = await db.collection("users").find({ "tenants.tenantId": tenantId }).toArray();
    }
    if (targetEmployees.length === 0) {
      return NextResponse.json({ error: "Nenhum colaborador válido selecionado." }, { status: 400 });
    }

    const existingAssignments = await db.collection("assigned_courses").find({ tenantId }).toArray();
    const existingKeys = new Set(existingAssignments.map((a: any) => `${a.userId}::${a.courseId}`));

    let created = 0;
    for (const employee of targetEmployees) {
      for (const courseId of courseIds) {
        const key = `${employee._id}::${courseId}`;
        if (existingKeys.has(key)) continue;
        await db.collection("assigned_courses").insertOne({
          tenantId,
          userId: employee._id,
          courseId,
          assignedAt: new Date(),
          assignedBy: userId,
          viaAcademyTrackId: id,
        });
        created++;
      }
    }

    await logAuditEvent(userId, "ACADEMY_TRACK_APPLIED", {
      tenantId,
      trackId: id,
      trackName: track.name,
      employeeCount: targetEmployees.length,
      newAssignments: created,
    });

    return NextResponse.json({
      success: true,
      message: `Trilha "${track.name}" aplicada a ${targetEmployees.length} colaborador(es). ${created} nova(s) atribuição(ões) criada(s).`,
    });
  } catch (error: any) {
    console.error("Erro ao aplicar trilha da Academia Corporativa:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
