import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";

// POST — Clona um curso público do marketplace para dentro do tenant do utilizador.
// Cópia real (não referência partilhada), para preservar o isolamento de tenants já
// garantido em todo o resto da plataforma — editar a cópia nunca afeta o original.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    const allowedRoles = ["ADMIN", "GESTOR_EMPRESA", "GESTOR_ACADEMICO", "SUPORTE"];
    if (!allowedRoles.includes(activeRole || "")) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { sourceCourseId } = await req.json();
    if (!sourceCourseId) {
      return NextResponse.json({ error: "sourceCourseId é obrigatório." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    let queryId: any = sourceCourseId;
    try {
      queryId = new ObjectId(sourceCourseId);
    } catch {}

    const sourceCourse = await db.collection("courses").findOne({ _id: queryId, isPublicMarketplace: true, status: "PUBLISHED" });
    if (!sourceCourse) {
      return NextResponse.json({ error: "Curso não encontrado no marketplace." }, { status: 404 });
    }

    const { _id, tenant_id, isPublicMarketplace, marketplaceDescription, ...rest } = sourceCourse;

    const clonedCourse = {
      ...rest,
      tenant_id: tenantId,
      status: "PUBLISHED",
      isPrivate: false,
      isPublicMarketplace: false,
      sourceCourseId: sourceCourseId.toString(),
      sourceTenantId: tenant_id,
      generatedByUserId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("courses").insertOne(clonedCourse);

    await logAuditEvent(userId, "MARKETPLACE_COURSE_ACQUIRED", {
      sourceCourseId: sourceCourseId.toString(),
      newCourseId: result.insertedId.toString(),
      title: sourceCourse.title,
    });

    return NextResponse.json({ success: true, courseId: result.insertedId.toString() });
  } catch (error: any) {
    console.error("Erro ao adquirir curso do marketplace:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
