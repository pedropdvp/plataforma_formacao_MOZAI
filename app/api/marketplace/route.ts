import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export const runtime = "nodejs";

// GET — Lista cursos publicados no marketplace, de TODOS os tenants.
// Única exceção deliberada ao filtro tenant_id estrito usado no resto da plataforma:
// só leitura, só metadados públicos (nunca dados de alunos/progresso/tentativas de quiz).
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const db = await getDb();
    const courses = await db
      .collection("courses")
      .find({ isPublicMarketplace: true, status: "PUBLISHED" })
      .project({
        title: 1,
        description: 1,
        marketplaceDescription: 1,
        tenant_id: 1,
        modules: 1,
        createdAt: 1,
      })
      .toArray();

    // Resolver nome do tenant de origem (para atribuição, "criado por X") — tenant_id
    // é a string do _id do documento em "tenants"; "root" é um caso especial sem documento próprio.
    const tenantIdSet = new Set<string>();
    for (const c of courses as any[]) {
      if (c.tenant_id && c.tenant_id !== "root") tenantIdSet.add(c.tenant_id);
    }
    const tenantObjectIds = Array.from(tenantIdSet)
      .map((id: string) => {
        try {
          return new ObjectId(id);
        } catch {
          return null;
        }
      })
      .filter((id): id is ObjectId => id !== null);
    const tenants = tenantObjectIds.length > 0 ? await db.collection("tenants").find({ _id: { $in: tenantObjectIds } }).toArray() : [];
    const tenantNameById = new Map<string, string>(tenants.map((t: any) => [t._id.toString(), t.name]));
    tenantNameById.set("root", "MOZAI");

    const listings = courses.map((c: any) => ({
      _id: c._id,
      title: c.title,
      description: c.marketplaceDescription || c.description || "",
      sourceTenantId: c.tenant_id,
      sourceTenantName: tenantNameById.get(c.tenant_id) || c.tenant_id,
      lessonsCount: (c.modules || []).reduce((acc: number, m: any) => acc + (m.lessons || []).length, 0),
      createdAt: c.createdAt,
    }));

    return NextResponse.json({ success: true, listings });
  } catch (error: any) {
    console.error("Erro ao listar marketplace:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
