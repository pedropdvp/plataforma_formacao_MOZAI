import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

// GET — Estado do próprio perfil de Networking (visível/oculto, cabeçalho, competências).
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const profile = await db.collection("network_profiles").findOne({ tenant_id: tenantId, userId });

    return NextResponse.json({
      success: true,
      profile: profile
        ? { visible: !!profile.visible, headline: profile.headline || "", skills: profile.skills || [] }
        : { visible: false, headline: "", skills: [] },
    });
  } catch (error: any) {
    console.error("Erro ao ler perfil de Networking:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Ativa/atualiza o perfil de Networking. Só fica visível no diretório se
// explicitamente ativado — nunca opt-out (privacidade por definição, consistente com o
// módulo de Compliance/RGPD da plataforma).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { visible, headline, skills } = await req.json();
    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    await db.collection("network_profiles").updateOne(
      { tenant_id: tenantId, userId },
      {
        $set: {
          tenant_id: tenantId,
          userId,
          visible: !!visible,
          headline: headline?.trim().slice(0, 160) || "",
          skills: Array.isArray(skills) ? skills.slice(0, 10) : [],
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    await logAuditEvent(userId, "NETWORK_PROFILE_UPDATED", { tenantId, visible: !!visible });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao atualizar perfil de Networking:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
