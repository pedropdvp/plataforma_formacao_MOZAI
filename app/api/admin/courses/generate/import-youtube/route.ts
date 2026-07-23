import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ingestExtractedPages } from "@/lib/ai/ingest";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST — Importa a transcrição (legendas) de um vídeo do YouTube como material de curso.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const body = await req.json();
    const { videoUrl, briefingId: rawBriefingId } = body;
    const briefingId = rawBriefingId || Math.random().toString(36).substring(7);

    if (!videoUrl || !videoUrl.trim()) {
      return NextResponse.json({ error: "URL ou ID do vídeo do YouTube é obrigatório." }, { status: 400 });
    }

    const { YoutubeTranscript } = await import("youtube-transcript");

    let segments;
    try {
      segments = await YoutubeTranscript.fetchTranscript(videoUrl, { lang: "pt" });
    } catch {
      // Sem legendas em PT — tentar no idioma padrão do vídeo
      try {
        segments = await YoutubeTranscript.fetchTranscript(videoUrl);
      } catch (err: any) {
        return NextResponse.json(
          { error: "Não foi possível obter a transcrição deste vídeo — pode não ter legendas disponíveis." },
          { status: 400 }
        );
      }
    }

    const text = segments.map((s) => s.text).join(" ").trim();
    if (!text) {
      return NextResponse.json({ error: "A transcrição deste vídeo está vazia." }, { status: 400 });
    }

    const result = await ingestExtractedPages(
      [{ text, images: [] }],
      { briefingId, tenantId, sourceName: `YouTube: ${videoUrl}` }
    );

    return NextResponse.json({
      success: true,
      briefingId,
      sourceName: `YouTube: ${videoUrl}`,
      chunksCount: result.chunksCount,
      imagesCount: result.imagesCount,
    });
  } catch (error: any) {
    console.error("Erro ao importar transcrição do YouTube:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
