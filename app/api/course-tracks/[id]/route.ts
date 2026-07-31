import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { ObjectId } from "mongodb";

const MANAGE_ROLES = ["ADMIN", "GESTOR_ACADEMICO", "FORMADOR"];

// DELETE — Remove um percurso (não apaga os cursos, só deixa de existir como agrupamento
// para efeitos de Diploma). Só Admin/Gestor Académico/Formador.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !MANAGE_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Permissões insuficientes para remover percursos." }, { status: 403 });
    }

    const { id } = await params;
    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const track = await db.collection("course_tracks").findOne({ _id: new ObjectId(id), tenant_id: tenantId });
    if (!track) {
      return NextResponse.json({ error: "Percurso não encontrado." }, { status: 404 });
    }

    await db.collection("course_tracks").deleteOne({ _id: new ObjectId(id) });

    await logAuditEvent(userId, "COURSE_TRACK_DELETED", { tenantId, trackId: id, name: track.name });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
