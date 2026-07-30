import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { CURRENT_TERMS_VERSION } from "@/lib/compliance";

// POST — Regista a aceitação explícita dos Termos & Política de Privacidade na versão
// atual. Auditado (quem aceitou, quando, que versão) — é a prova de consentimento
// exigida por RGPD/GDPR para o tratamento de dados pessoais.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const db = await getDb();
    await db.collection("users").updateOne(
      { _id: userId },
      { $set: { termsAcceptedAt: new Date(), termsVersion: CURRENT_TERMS_VERSION } }
    );

    await logAuditEvent(userId, "TERMS_ACCEPTED", { termsVersion: CURRENT_TERMS_VERSION });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao registar consentimento de termos:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
