import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

// GET — Lista os mentores ativos do tenant (exclui o próprio utilizador), com pesquisa
// opcional por área de especialidade (?q=).
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").trim().toLowerCase();

    const db = await getDb();
    const mentors = await db.collection("mentor_profiles").find({ tenant_id: tenantId, isActive: true }).toArray();

    const filtered = mentors
      .filter((m: any) => m.userId !== userId)
      .filter((m: any) =>
        query
          ? m.name.toLowerCase().includes(query) ||
            (m.expertiseAreas || []).some((a: string) => a.toLowerCase().includes(query))
          : true
      );

    return NextResponse.json({
      success: true,
      mentors: filtered.map((m: any) => ({
        userId: m.userId,
        name: m.name,
        bio: m.bio,
        expertiseAreas: m.expertiseAreas || [],
        availability: m.availability || "",
      })),
    });
  } catch (error: any) {
    console.error("Erro ao listar mentores:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
