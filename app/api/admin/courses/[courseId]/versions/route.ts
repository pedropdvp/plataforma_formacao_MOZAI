import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";

// GET — Lista o histórico de versões de um curso (mais recente primeiro), sem o payload completo de módulos.
export async function GET(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const { courseId } = await params;
    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const versions = await db
      .collection("course_versions")
      .find({ courseId, tenantId })
      .project({ versionNumber: 1, title: 1, editedBy: 1, createdAt: 1 })
      .sort({ versionNumber: -1 })
      .toArray();

    const editorIds = Array.from(new Set(versions.map((v: any) => v.editedBy)));
    const users = editorIds.length > 0 ? await db.collection("users").find({ _id: { $in: editorIds } }).toArray() : [];
    const nameById = new Map(users.map((u: any) => [u._id, `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email]));

    const enriched = versions.map((v: any) => ({
      versionNumber: v.versionNumber,
      title: v.title,
      editedByName: nameById.get(v.editedBy) || v.editedBy,
      createdAt: v.createdAt,
    }));

    return NextResponse.json({ success: true, versions: enriched });
  } catch (error: any) {
    console.error("Erro ao listar versões do curso:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST { versionNumber } — Restaura uma versão anterior do curso (grava o estado atual como nova versão antes).
export async function POST(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
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

    const { courseId } = await params;
    const { versionNumber } = await req.json();
    if (!versionNumber) {
      return NextResponse.json({ error: "versionNumber é obrigatório." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const targetVersion = await db.collection("course_versions").findOne({ courseId, tenantId, versionNumber });
    if (!targetVersion) {
      return NextResponse.json({ error: "Versão não encontrada." }, { status: 404 });
    }

    const current = await db.collection("courses").findOne({ _id: new ObjectId(courseId), tenant_id: tenantId });
    if (!current) {
      return NextResponse.json({ error: "Curso não encontrado." }, { status: 404 });
    }

    // Grava o estado atual como uma nova versão antes de restaurar — nunca se perde trabalho.
    const lastVersion = await db
      .collection("course_versions")
      .find({ courseId, tenantId })
      .sort({ versionNumber: -1 })
      .limit(1)
      .toArray();
    const nextVersionNumber = (lastVersion[0]?.versionNumber || 0) + 1;
    await db.collection("course_versions").insertOne({
      courseId,
      tenantId,
      versionNumber: nextVersionNumber,
      title: current.title,
      modules: current.modules || [],
      editedBy: userId,
      createdAt: new Date(),
    });

    await db.collection("courses").updateOne(
      { _id: new ObjectId(courseId), tenant_id: tenantId },
      { $set: { modules: targetVersion.modules, updatedAt: new Date() } }
    );

    await logAuditEvent(userId, "COURSE_VERSION_RESTORED", { courseId, restoredVersionNumber: versionNumber });

    const updated = await db.collection("courses").findOne({ _id: new ObjectId(courseId) });
    return NextResponse.json({ success: true, course: updated });
  } catch (error: any) {
    console.error("Erro ao restaurar versão do curso:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
