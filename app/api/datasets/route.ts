import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

// GET — Lista os datasets publicados no Marketplace (cross-empresa, tal como o
// marketplace de cursos), com pesquisa opcional por título/categoria (?q=).
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").trim().toLowerCase();

    const db = await getDb();
    const datasets = await db.collection("datasets").find({}).sort({ createdAt: -1 }).toArray();

    const filtered = datasets.filter((d: any) =>
      query ? d.title.toLowerCase().includes(query) || (d.category || "").toLowerCase().includes(query) : true
    );

    return NextResponse.json({
      success: true,
      datasets: filtered.map((d: any) => ({ ...d, _id: d._id.toString() })),
    });
  } catch (error: any) {
    console.error("Erro ao listar datasets:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Publica um novo dataset (o ficheiro já foi carregado para o Vercel Blob via
// /api/datasets/upload-token — aqui só se regista a entrada no catálogo).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { title, description, category, fileUrl, fileName, fileSize } = await req.json();
    if (!title || !title.trim() || !fileUrl || !fileName) {
      return NextResponse.json({ error: "Título e ficheiro são obrigatórios." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const userRecord = await db.collection("users").findOne({ _id: userId });
    const uploaderName = userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || userRecord.email : "Utilizador";

    const result = await db.collection("datasets").insertOne({
      tenant_id: tenantId,
      title: title.trim(),
      description: (description || "").trim(),
      category: (category || "Geral").trim(),
      fileUrl,
      fileName,
      fileSize: fileSize || 0,
      uploadedBy: userId,
      uploaderName,
      downloadsCount: 0,
      createdAt: new Date(),
    });

    await logAuditEvent(userId, "DATASET_PUBLISHED", { tenantId, datasetId: result.insertedId?.toString(), title: title.trim() });

    return NextResponse.json({ success: true, message: "Dataset publicado com sucesso no Marketplace." });
  } catch (error: any) {
    console.error("Erro ao publicar dataset:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
