import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

// GET — Devolve o próprio perfil de mentor do utilizador autenticado (ou null se ainda
// não criou um).
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const profile = await db.collection("mentor_profiles").findOne({ tenant_id: tenantId, userId });

    return NextResponse.json({ success: true, profile: profile ? { ...profile, _id: profile._id.toString() } : null });
  } catch (error: any) {
    console.error("Erro ao ler perfil de mentor:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Cria ou atualiza o próprio perfil de mentor. Qualquer utilizador autenticado
// se pode candidatar a mentor — não é uma função exclusiva de Professor/Formador,
// alinhado com o espírito de partilha de conhecimento entre pares da plataforma.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { bio, expertiseAreas, availability, isActive } = await req.json();
    if (!bio || !bio.trim()) {
      return NextResponse.json({ error: "A biografia é obrigatória." }, { status: 400 });
    }
    if (!Array.isArray(expertiseAreas) || expertiseAreas.length === 0) {
      return NextResponse.json({ error: "Indique pelo menos uma área de especialidade." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const userRecord = await db.collection("users").findOne({ _id: userId });
    const name = userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || userRecord.email : "Mentor";

    await db.collection("mentor_profiles").updateOne(
      { tenant_id: tenantId, userId },
      {
        $set: {
          tenant_id: tenantId,
          userId,
          name,
          bio: bio.trim(),
          expertiseAreas: expertiseAreas.map((a: string) => a.trim()).filter(Boolean),
          availability: availability || "",
          isActive: isActive !== false,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    await logAuditEvent(userId, "MENTOR_PROFILE_SAVED", { tenantId, isActive: isActive !== false });

    return NextResponse.json({ success: true, message: "Perfil de mentor guardado com sucesso." });
  } catch (error: any) {
    console.error("Erro ao guardar perfil de mentor:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
