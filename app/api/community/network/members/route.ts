import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

// GET — Diretório de Networking: só membros que ativaram explicitamente "Visível na Rede",
// excluindo o próprio utilizador, com o estado real da ligação entre ambos.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const q = req.nextUrl.searchParams.get("q")?.trim();
    const db = await getDb();

    const profiles = await db.collection("network_profiles").find({ tenant_id: tenantId, visible: true, userId: { $ne: userId } }).toArray();

    const userIds = profiles.map((p: any) => p.userId);
    const users = await db.collection("users").find({ _id: { $in: userIds } }).toArray();
    const userMap = new Map<string, any>(users.map((u: any) => [u._id, u]));

    const connections = await db.collection("network_connections").find({ tenant_id: tenantId, $or: [{ requesterId: userId }, { addresseeId: userId }] }).toArray();
    const connectionMap = new Map<string, any>();
    connections.forEach((c: any) => {
      const otherId = c.requesterId === userId ? c.addresseeId : c.requesterId;
      connectionMap.set(otherId, c);
    });

    let members = profiles.map((p: any) => {
      const u = userMap.get(p.userId);
      const name = u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email : "Membro";
      const conn = connectionMap.get(p.userId);
      return {
        userId: p.userId,
        name,
        headline: p.headline,
        skills: p.skills || [],
        connectionStatus: conn ? conn.status : "none",
        connectionId: conn ? conn._id.toString() : null,
        isRequester: conn ? conn.requesterId === userId : false,
      };
    });

    if (q) {
      const query = q.toLowerCase();
      members = members.filter((m: any) => m.name.toLowerCase().includes(query) || m.headline.toLowerCase().includes(query) || m.skills.some((s: string) => s.toLowerCase().includes(query)));
    }

    return NextResponse.json({ success: true, members });
  } catch (error: any) {
    console.error("Erro ao listar diretório de Networking:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
