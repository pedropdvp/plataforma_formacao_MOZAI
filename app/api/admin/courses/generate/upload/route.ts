import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { chunkText } from "@/lib/vector-store";
import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";

const EMBEDDING_MODEL = "text-embedding-3-small";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const briefingId = formData.get("briefingId")?.toString() || Math.random().toString(36).substring(7);

    const db = await getDb();
    const col = db.collection("uploaded_chunks");

    let totalChunks = 0;

    for (const file of files) {
      const text = await file.text();
      if (!text || !text.trim()) continue;

      // Dividir texto
      const textChunks = chunkText(text, 600, 100);
      if (textChunks.length === 0) continue;

      let embeddings: number[][] = [];
      try {
        const r = await embedMany({
          model: openai.embedding(EMBEDDING_MODEL),
          values: textChunks,
        });
        embeddings = r.embeddings;
      } catch (err) {
        console.warn("Upload RAG: falha ao gerar embeddings, a ignorar vetores:", err);
      }

      const docs = textChunks.map((chunk, idx) => ({
        briefingId,
        tenant_id: tenantId,
        fileName: file.name,
        content: chunk,
        embedding: embeddings[idx] || [],
        createdAt: new Date(),
      }));

      await col.insertMany(docs);
      totalChunks += docs.length;
    }

    return NextResponse.json({
      success: true,
      briefingId,
      chunksCount: totalChunks,
    });
  } catch (error: any) {
    console.error("Erro no upload de materiais:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
