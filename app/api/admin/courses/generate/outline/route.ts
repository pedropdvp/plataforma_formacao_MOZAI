import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { generateOutline, searchUploadedMaterials } from "@/lib/ai/generator-engine";
import { ObjectId } from "mongodb";

export const maxDuration = 60; // Permitir até 60 segundos para gerar outline robusto

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const body = await req.json();
    const { topic, level, duration, objectives, targetAudience, briefingId } = body;

    if (!topic || !topic.trim()) {
      return NextResponse.json({ error: "Tópico é obrigatório." }, { status: 400 });
    }

    // 1. Extrair RAG dos materiais caso fornecido briefingId
    let contextTexts: string[] = [];
    if (briefingId) {
      const contextChunks = await searchUploadedMaterials(briefingId, topic, 4);
      contextTexts = contextChunks.map((c) => c.content);
    }

    // 2. Gerar Outline usando OpenAI
    const outline = await generateOutline({
      topic,
      level: level || "Intermédio",
      duration: duration || "4 semanas",
      objectives: objectives || "Aprender os conceitos principais.",
      targetAudience: targetAudience || "Público geral",
    }, contextTexts);

    // 3. Criar o Job na base de dados
    const db = await getDb();
    const jobDoc = {
      tenant_id: tenantId,
      userId,
      status: "PENDING_OUTLINE",
      progress: 0,
      brief: {
        topic,
        level: level || "Intermédio",
        duration: duration || "4 semanas",
        objectives: objectives || "Aprender os conceitos principais.",
        targetAudience: targetAudience || "Público geral",
        briefingId,
      },
      outline,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("course_generation_jobs").insertOne(jobDoc);

    return NextResponse.json({
      success: true,
      jobId: result.insertedId.toString(),
      outline,
    });
  } catch (error: any) {
    console.error("Erro ao gerar outline de curso:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
