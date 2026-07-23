import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { put } from "@vercel/blob";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { generateNarration, isNarrationConfigured } from "@/lib/ai/narration";

export const runtime = "nodejs";
export const maxDuration = 40;

async function persistAudioUrl(tenantId: string, courseId: string, lessonKey: string, blockId: string, audioUrl: string) {
  try {
    const db = await getDb();
    let queryId: any = courseId;
    try {
      queryId = new ObjectId(courseId);
    } catch {}

    const course = await db.collection("courses").findOne({ _id: queryId, tenant_id: tenantId });
    if (!course) return;

    let changed = false;
    const modules = (course.modules || []).map((mod: any) => ({
      ...mod,
      lessons: (mod.lessons || []).map((les: any) => {
        if (les.slug !== lessonKey && les.id !== lessonKey) return les;
        const blocks = (les.blocks || []).map((b: any) => {
          if (b.id !== blockId) return b;
          changed = true;
          return { ...b, audioUrl };
        });
        return { ...les, blocks };
      }),
    }));

    if (changed) {
      await db.collection("courses").updateOne({ _id: course._id }, { $set: { modules, updatedAt: new Date() } });
    }
  } catch (error) {
    console.warn("Não foi possível persistir o URL do áudio de narração (não bloqueante):", error);
  }
}

// POST — Gera (ou reaproveita) a narração em áudio de um bloco heading/text e guarda-a no bloco.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    if (!isNarrationConfigured()) {
      return NextResponse.json(
        { error: "Narração por voz não está configurada nesta instalação (ELEVENLABS_API_KEY em falta)." },
        { status: 503 }
      );
    }

    const { text, courseId, lessonKey, blockId } = await req.json();
    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Parâmetro 'text' é obrigatório." }, { status: 400 });
    }

    const audioBuffer = await generateNarration(text);
    if (!audioBuffer) {
      return NextResponse.json({ error: "Falha ao gerar a narração." }, { status: 502 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const pathname = `narration/${tenantId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`;
    const blob = await put(pathname, audioBuffer, { access: "public", contentType: "audio/mpeg", addRandomSuffix: false });

    if (courseId && lessonKey && blockId) {
      await persistAudioUrl(tenantId, courseId, lessonKey, blockId, blob.url);
    }

    return NextResponse.json({ success: true, audioUrl: blob.url });
  } catch (error: any) {
    console.error("Erro ao gerar narração:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
