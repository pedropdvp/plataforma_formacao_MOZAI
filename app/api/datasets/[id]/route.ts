import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

// DELETE — Remove um dataset do Marketplace: o próprio autor, ou ADMIN/SUPORTE por
// moderação (mesmo modelo já usado nos posts da Comunidade).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDb();
    const datasetObjectId = new ObjectId(id);

    const dataset = await db.collection("datasets").findOne({ _id: datasetObjectId });
    if (!dataset) {
      return NextResponse.json({ error: "Dataset não encontrado." }, { status: 404 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    const isModerator = activeRole === "ADMIN" || activeRole === "SUPORTE";
    if (dataset.uploadedBy !== userId && !isModerator) {
      return NextResponse.json({ error: "Sem permissão para eliminar este dataset." }, { status: 403 });
    }

    await db.collection("datasets").deleteOne({ _id: datasetObjectId });
    await logAuditEvent(userId, "DATASET_DELETED", { datasetId: id, moderated: dataset.uploadedBy !== userId });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao eliminar dataset:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
