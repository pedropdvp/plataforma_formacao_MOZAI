import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

const CREATE_ROLES = ["ADMIN", "GESTOR_ACADEMICO", "FORMADOR"];

// GET — Lista as aulas ao vivo do tenant, com o estado real de reserva do próprio utilizador.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const [classes, myReservations] = await Promise.all([
      db.collection("live_classes").find({ tenant_id: tenantId }).sort({ dateTime: 1 }).toArray(),
      db.collection("live_class_reservations").find({ tenant_id: tenantId, userId }).toArray(),
    ]);

    const reservationByClassId = new Map<string, any>(myReservations.map((r: any) => [r.classId.toString(), r]));

    return NextResponse.json({
      success: true,
      classes: classes.map((c: any) => {
        const reservation = reservationByClassId.get(c._id.toString());
        return {
          id: c._id.toString(),
          title: c.title,
          trainer: c.trainer,
          description: c.description,
          date: c.date,
          time: c.time,
          joinUrl: c.joinUrl,
          reservedByMe: !!reservation,
          myReservedAt: reservation ? reservation.reservedAt : null,
        };
      }),
    });
  } catch (error: any) {
    console.error("Erro ao listar aulas ao vivo:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Cria uma nova aula ao vivo real (só Admin/Gestor Académico/Formador).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !CREATE_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Permissões insuficientes para agendar aulas ao vivo." }, { status: 403 });
    }

    const { title, trainer, description, date, time, joinUrl } = await req.json();
    if (!title?.trim() || !trainer?.trim() || !date?.trim() || !time?.trim() || !joinUrl?.trim()) {
      return NextResponse.json({ error: "Título, formador, data, horário e link da sessão são obrigatórios." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const result = await db.collection("live_classes").insertOne({
      tenant_id: tenantId,
      title: title.trim(),
      trainer: trainer.trim(),
      description: (description || "").trim(),
      date: date.trim(),
      time: time.trim(),
      joinUrl: joinUrl.trim(),
      createdById: userId,
      createdAt: new Date(),
    });

    await logAuditEvent(userId, "LIVE_CLASS_CREATED", { tenantId, classId: result.insertedId?.toString(), title: title.trim() });

    return NextResponse.json({ success: true, classId: result.insertedId?.toString() });
  } catch (error: any) {
    console.error("Erro ao criar aula ao vivo:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
