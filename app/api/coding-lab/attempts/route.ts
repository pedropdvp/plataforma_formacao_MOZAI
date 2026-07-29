import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

// GET — Histórico das últimas execuções do próprio aluno para um exercício específico
// (ou todas, se 'exerciseId' não for indicado), mais recentes primeiro.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const { searchParams } = new URL(req.url);
    const exerciseId = searchParams.get("exerciseId");

    const query: any = { tenant_id: tenantId, userId };
    if (exerciseId) query.exerciseId = exerciseId;

    const db = await getDb();
    const attempts = await db
      .collection("coding_lab_attempts")
      .find(query)
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();

    return NextResponse.json({
      success: true,
      attempts: attempts.map((a: any) => ({ ...a, _id: a._id.toString() })),
    });
  } catch (error: any) {
    console.error("Erro ao ler histórico do Coding Lab:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
