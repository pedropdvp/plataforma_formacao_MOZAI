import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { listPurchasedCourseIds } from "@/lib/course-purchases";
import { getTenantId } from "@/lib/session";

/** GET — Cursos avulsos comprados pelo utilizador (o catálogo mostra-os como "Comprado"). */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const tenantId = await getTenantId();
    return NextResponse.json({ courseIds: await listPurchasedCourseIds(tenantId, userId) });
  } catch (error: any) {
    console.error("Erro ao listar as compras:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
