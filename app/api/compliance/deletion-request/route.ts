import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

// GET — Estado do pedido de eliminação de conta mais recente do próprio utilizador
// (ou null se nunca pediu).
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const requests = await db
      .collection("data_deletion_requests")
      .find({ tenant_id: tenantId, userId })
      .sort({ requestedAt: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      latestRequest: requests[0] ? { ...requests[0], _id: requests[0]._id.toString() } : null,
    });
  } catch (error: any) {
    console.error("Erro ao ler pedido de eliminação de conta:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Direito ao esquecimento (RGPD Art. 17): o aluno pede a eliminação da sua
// conta e dados pessoais. Não é executado de imediato — fica pendente para revisão de
// ADMIN/SUPORTE (evita eliminações acidentais e permite retenção legal/contratual
// quando aplicável, comum em contas geridas por uma empresa B2B).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const existing = await db.collection("data_deletion_requests").findOne({ tenant_id: tenantId, userId, status: "pending" });
    if (existing) {
      return NextResponse.json({ error: "Já tem um pedido de eliminação pendente." }, { status: 409 });
    }

    const { reason } = await req.json().catch(() => ({ reason: "" }));

    const userRecord = await db.collection("users").findOne({ _id: userId });
    const result = await db.collection("data_deletion_requests").insertOne({
      tenant_id: tenantId,
      userId,
      userEmail: userRecord?.email || null,
      userName: userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() : null,
      reason: reason || null,
      status: "pending",
      requestedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
    });

    await logAuditEvent(userId, "ACCOUNT_DELETION_REQUESTED", { tenantId, requestId: result.insertedId?.toString() });

    return NextResponse.json({ success: true, message: "Pedido de eliminação registado. A equipa de suporte irá processá-lo." });
  } catch (error: any) {
    console.error("Erro ao criar pedido de eliminação de conta:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
