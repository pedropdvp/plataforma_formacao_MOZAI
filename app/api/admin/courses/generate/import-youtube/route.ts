import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ingestExtractedPages } from "@/lib/ai/ingest";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Alguns motores de busca (ex: Bing "riverview") devolvem uma página de resultados
 * de vídeo, não um link direto do YouTube — mas normalmente embutem o URL real
 * num parâmetro de query (ex: "churl"). Tenta desembrulhar esses casos antes de
 * validar se é mesmo um vídeo específico.
 */
function unwrapSearchEngineRedirect(input: string): string {
  try {
    const url = new URL(input);
    if (url.hostname.includes("bing.com")) {
      const churl = url.searchParams.get("churl");
      if (churl) return decodeURIComponent(churl);
    }
  } catch {
    // não é um URL válido — devolve o valor original tal como veio (pode ser só um ID de vídeo)
  }
  return input;
}

/** Deteta se o URL aponta para um canal/página de utilizador do YouTube, não para um vídeo específico. */
function isYoutubeNonVideoUrl(input: string): boolean {
  return /youtube\.com\/(channel|c|user|@)/i.test(input);
}

/** Extrai o ID de 11 caracteres de um URL do YouTube (watch, youtu.be, embed, shorts). */
function extractYoutubeVideoId(input: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const match = input.match(re);
    if (match) return match[1];
  }
  // Já pode ser só o ID puro (11 caracteres, sem barras nem pontos)
  if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) return input.trim();
  return null;
}

// POST — Importa a transcrição (legendas) de um vídeo do YouTube como material de curso.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const body = await req.json();
    const { videoUrl: rawVideoUrl, briefingId: rawBriefingId } = body;
    const briefingId = rawBriefingId || Math.random().toString(36).substring(7);

    if (!rawVideoUrl || !rawVideoUrl.trim()) {
      return NextResponse.json({ error: "URL ou ID do vídeo do YouTube é obrigatório." }, { status: 400 });
    }

    const unwrapped = unwrapSearchEngineRedirect(rawVideoUrl.trim());

    if (isYoutubeNonVideoUrl(unwrapped)) {
      return NextResponse.json(
        {
          error:
            "O link fornecido aponta para um canal do YouTube, não para um vídeo específico. " +
            "Abra o vídeo desejado no YouTube e cole o link direto (ex: https://www.youtube.com/watch?v=XXXXXXXXXXX).",
        },
        { status: 400 }
      );
    }

    const videoId = extractYoutubeVideoId(unwrapped);
    if (!videoId) {
      return NextResponse.json(
        {
          error:
            "Não foi possível identificar um vídeo do YouTube neste link (pode ser uma página de resultados de pesquisa, não um vídeo). " +
            "Cole o link direto do vídeo (ex: https://www.youtube.com/watch?v=XXXXXXXXXXX).",
        },
        { status: 400 }
      );
    }

    const { YoutubeTranscript } = await import("youtube-transcript");

    let segments;
    try {
      segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: "pt" });
    } catch {
      // Sem legendas em PT — tentar no idioma padrão do vídeo
      try {
        segments = await YoutubeTranscript.fetchTranscript(videoId);
      } catch (err: any) {
        return NextResponse.json(
          { error: `Não foi possível obter a transcrição do vídeo ${videoId} — pode não ter legendas disponíveis ou estar indisponível.` },
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
      { briefingId, tenantId, sourceName: `YouTube: ${videoId}` }
    );

    return NextResponse.json({
      success: true,
      briefingId,
      sourceName: `YouTube: ${videoId}`,
      chunksCount: result.chunksCount,
      imagesCount: result.imagesCount,
    });
  } catch (error: any) {
    console.error("Erro ao importar transcrição do YouTube:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
