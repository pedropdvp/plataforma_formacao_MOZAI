function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

/** Constrói um ficheiro .srt REAL a partir de segmentos com timestamps reais (do Whisper). */
export function buildSrtFromSegments(segments: { startSecond: number; endSecond: number; text: string }[]): string {
  return segments
    .map((seg, i) => `${i + 1}\n${formatSrtTime(seg.startSecond)} --> ${formatSrtTime(seg.endSecond)}\n${seg.text.trim()}\n`)
    .join("\n");
}
