import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

// GET — Lista os pedidos de entrada pendentes desta equipa (só o líder pode ver).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDb();
    const team = await db.collection("community_teams").findOne({ _id: new ObjectId(id) });
    if (!team) {
      return NextResponse.json({ error: "Equipa não encontrada." }, { status: 404 });
    }
    if (team.leaderId !== userId) {
      return NextResponse.json({ error: "Só o líder pode ver os pedidos de entrada." }, { status: 403 });
    }

    const requests = await db.collection("team_join_requests").find({ teamId: id, status: "pending" }).sort({ requestedAt: -1 }).toArray();

    return NextResponse.json({ success: true, requests: requests.map((r: any) => ({ id: r._id.toString(), userName: r.userName, requestedAt: r.requestedAt })) });
  } catch (error: any) {
    console.error("Erro ao listar pedidos de entrada:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
