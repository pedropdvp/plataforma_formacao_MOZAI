import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

// POST — Regista uma transferência real (incrementa o contador) e devolve o URL real do
// ficheiro para o browser abrir/descarregar.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const newCount = (dataset.downloadsCount || 0) + 1;
    await db.collection("datasets").updateOne({ _id: datasetObjectId }, { $set: { downloadsCount: newCount } });

    return NextResponse.json({ success: true, fileUrl: dataset.fileUrl, downloadsCount: newCount });
  } catch (error: any) {
    console.error("Erro ao registar transferência de dataset:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
