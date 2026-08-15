// Interpreta uma única URL de vídeo colada pelo autor da lição (YouTube, Vimeo, Mux
// player ou um ficheiro de vídeo direto .mp4/.webm/.ogg) e devolve como embutir.
export type VideoEmbed =
  | { type: "youtube"; embedUrl: string }
  | { type: "vimeo"; embedUrl: string }
  | { type: "mux"; embedUrl: string }
  | { type: "file"; fileUrl: string }
  | null;

export function parseVideoEmbed(rawUrl: string | undefined | null): VideoEmbed {
  const url = (rawUrl || "").trim();
  if (!url) return null;

  try {
    // YouTube: watch?v=ID, youtu.be/ID, /embed/ID, /shorts/ID
    const ytMatch = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
    );
    if (ytMatch) {
      return { type: "youtube", embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}` };
    }

    // Vimeo: vimeo.com/ID ou player.vimeo.com/video/ID
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) {
      return { type: "vimeo", embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
    }

    // Mux: já um player.mux.com/ID, ou só o Playback ID em bruto
    const muxMatch = url.match(/player\.mux\.com\/([A-Za-z0-9]+)/);
    if (muxMatch) {
      return { type: "mux", embedUrl: `https://player.mux.com/${muxMatch[1]}` };
    }

    // Ficheiro de vídeo direto (.mp4/.webm/.ogg), incluindo Vercel Blob
    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) {
      return { type: "file", fileUrl: url };
    }

    return null;
  } catch {
    return null;
  }
}
