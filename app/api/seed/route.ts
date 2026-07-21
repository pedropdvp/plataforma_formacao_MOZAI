import { NextRequest, NextResponse } from "next/server";
import { seedLessonChunks } from "@/lib/seeder";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email") || undefined;
    const tenantId = req.headers.get("x-tenant-id") || "root";
    
    // Executa a carga dos dados no banco
    const count = await seedLessonChunks(tenantId, email);
    
    return NextResponse.json({
      success: true,
      message: `Base de dados populada com sucesso para o tenant "${tenantId}".`,
      insertedChunks: count,
    });
  } catch (error: any) {
    console.error("Erro no API Seeder:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
