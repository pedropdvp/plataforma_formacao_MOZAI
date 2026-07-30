import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { TRACK_AREAS } from "@/lib/academy";

const REVIEWER_ROLES = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA"];

// GET — Lista as trilhas da Academia Corporativa do tenant (uma por área — Técnica,
// Comercial, RH, Liderança, ou Personalizada) e os colaboradores disponíveis para as
// atribuir. Antes só existia UM currículo único por empresa; agora cada área pode ter
// o seu próprio percurso de cursos, com colaboradores diferentes em cada uma.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const [tracks, employees] = await Promise.all([
      db.collection("academy_tracks").find({ tenant_id: tenantId }).sort({ createdAt: 1 }).toArray(),
      db.collection("users").find({ "tenants.tenantId": tenantId }).toArray(),
    ]);

    return NextResponse.json({
      success: true,
      tracks: tracks.map((t: any) => ({ ...t, _id: t._id.toString() })),
      employees: employees.map((e: any) => ({
        id: e._id,
        name: `${e.firstName || ""} ${e.lastName || ""}`.trim() || e.email,
        email: e.email,
      })),
    });
  } catch (error: any) {
    console.error("Erro ao listar trilhas da Academia Corporativa:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Cria uma nova trilha (nome + área + cursos reais do catálogo).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !REVIEWER_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Só Admin, Suporte ou Gestor de Empresa podem gerir a Academia Corporativa." }, { status: 403 });
    }

    const { name, area, courseIds } = await req.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "O nome da trilha é obrigatório." }, { status: 400 });
    }
    if (!Array.isArray(courseIds)) {
      return NextResponse.json({ error: "'courseIds' deve ser uma lista de IDs de curso." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const track = {
      tenant_id: tenantId,
      name: name.trim(),
      area: TRACK_AREAS.includes(area) ? area : "Personalizada",
      courseIds,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await db.collection("academy_tracks").insertOne(track);

    await logAuditEvent(userId, "ACADEMY_TRACK_CREATED", { tenantId, trackId: result.insertedId?.toString(), name: track.name, area: track.area });

    return NextResponse.json({ success: true, track: { ...track, _id: result.insertedId?.toString() } });
  } catch (error: any) {
    console.error("Erro ao criar trilha da Academia Corporativa:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
