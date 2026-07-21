import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

/**
 * GET /api/admin/audit: Obtém a listagem de logs de auditoria
 * Exclusivo para ADMIN ou SUPORTE
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // Validar se o papel ativo é ADMIN ou SUPORTE
    const activeRole = req.cookies.get("active-role")?.value;
    if (activeRole !== "ADMIN" && activeRole !== "SUPORTE") {
      return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || undefined;
    const tenantId = searchParams.get("tenantId") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const db = await getDb();
    const query: any = {};

    if (action) {
      query.action = action;
    }

    if (tenantId) {
      query.tenantId = tenantId;
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { userName: searchRegex },
        { userEmail: searchRegex },
        { description: searchRegex },
        { action: searchRegex }
      ];
    }

    const total = await db.collection("audit_logs").countDocuments(query);
    const logs = await db.collection("audit_logs")
      .find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // Obter nomes das empresas para mapear tenantId para designação real
    const companies = await db.collection("tenants").find({}).toArray();
    const companyMap = new Map<string, string>();
    companies.forEach((c: any) => companyMap.set(c._id.toString(), c.name));
    companyMap.set("root", "MOZAI AI Education Platform Corporation");

    const mappedLogs = logs.map((log: any) => ({
      ...log,
      companyName: companyMap.get(log.tenantId) || log.tenantId
    }));

    return NextResponse.json({
      logs: mappedLogs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error("Erro em GET /api/admin/audit:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
