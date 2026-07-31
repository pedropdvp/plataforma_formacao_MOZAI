import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

const MANAGE_ROLES = ["ADMIN", "GESTOR_ACADEMICO", "FORMADOR"];

// GET — Lista os percursos (Tracks) do tenant: cada um é um conjunto de cursos reais do
// catálogo que, quando TODOS concluídos a 100%, dá direito a um Diploma único do percurso.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const tracks = await db.collection("course_tracks").find({ tenant_id: tenantId }).sort({ createdAt: 1 }).toArray();

    return NextResponse.json({
      success: true,
      tracks: tracks.map((t: any) => ({
        id: t._id.toString(),
        name: t.name,
        courseIds: t.courseIds || [],
        createdByName: t.createdByName,
        createdAt: t.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Erro ao listar percursos:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Cria um novo percurso (nome + lista de cursos reais do catálogo). Só
// Admin/Gestor Académico/Formador podem definir percursos.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !MANAGE_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Permissões insuficientes para criar percursos." }, { status: 403 });
    }

    const { name, courseIds } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "O nome do percurso é obrigatório." }, { status: 400 });
    }
    if (!Array.isArray(courseIds) || courseIds.length < 2) {
      return NextResponse.json({ error: "Um percurso precisa de pelo menos 2 cursos." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const userRecord = await db.collection("users").findOne({ _id: userId });
    const createdByName = userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || userRecord.email : "Utilizador";

    const result = await db.collection("course_tracks").insertOne({
      tenant_id: tenantId,
      name: name.trim(),
      courseIds,
      createdById: userId,
      createdByName,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await logAuditEvent(userId, "COURSE_TRACK_CREATED", { tenantId, trackId: result.insertedId?.toString(), name: name.trim() });

    return NextResponse.json({ success: true, trackId: result.insertedId?.toString() });
  } catch (error: any) {
    console.error("Erro ao criar percurso:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
