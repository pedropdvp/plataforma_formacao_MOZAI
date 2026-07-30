import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { TRACK_AREAS } from "@/lib/academy";

const REVIEWER_ROLES = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA"];

// PATCH — Atualiza nome, área e/ou cursos de uma trilha existente.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !REVIEWER_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Só Admin, Suporte ou Gestor de Empresa podem gerir a Academia Corporativa." }, { status: 403 });
    }

    const { id } = await params;
    const { name, area, courseIds } = await req.json();
    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const setFields: any = { updatedAt: new Date() };
    if (typeof name === "string" && name.trim()) setFields.name = name.trim();
    if (TRACK_AREAS.includes(area)) setFields.area = area;
    if (Array.isArray(courseIds)) setFields.courseIds = courseIds;

    await db.collection("academy_tracks").updateOne({ _id: new ObjectId(id), tenant_id: tenantId }, { $set: setFields });
    await logAuditEvent(userId, "ACADEMY_TRACK_UPDATED", { tenantId, trackId: id });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao atualizar trilha da Academia Corporativa:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — Remove uma trilha (não remove atribuições de cursos já feitas aos colaboradores).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !REVIEWER_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Só Admin, Suporte ou Gestor de Empresa podem gerir a Academia Corporativa." }, { status: 403 });
    }

    const { id } = await params;
    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    await db.collection("academy_tracks").deleteOne({ _id: new ObjectId(id), tenant_id: tenantId });
    await logAuditEvent(userId, "ACADEMY_TRACK_DELETED", { tenantId, trackId: id });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao eliminar trilha da Academia Corporativa:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
