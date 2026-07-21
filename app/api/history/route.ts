import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

export async function GET(req: NextRequest) {
  try {
    // 1. Validar autenticação do Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Autenticação obrigatória." },
        { status: 401 }
      );
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    // 2. Procurar histórico de estudos persistido no MongoDB
    const logs = await db
      .collection("study_history")
      .find({
        tenant_id: tenantId,
        userId,
      })
      .sort({ timestamp: -1 })
      .limit(30)
      .toArray();

    return NextResponse.json({
      success: true,
      logs,
    });
  } catch (error: any) {
    console.error("Erro na leitura do histórico:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
