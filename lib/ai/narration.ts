/**
 * Narração por voz sintética (ElevenLabs) — exceção pontual autorizada à stack,
 * confirmada explicitamente pelo utilizador. Degradação graciosa quando
 * ELEVENLABS_API_KEY não está configurada: devolve null em vez de rebentar,
 * o mesmo padrão já usado para MUX_TOKEN_ID/OPENAI_API_KEY em falta.
 */

const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";
// Voz "Rachel" (pré-definida, multilingue) — usada como voz por omissão da narração.
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

export function isNarrationConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}

/**
 * Gera narração em áudio (MP3) para um texto. Devolve `null` de forma graciosa
 * se a integração não estiver configurada ou se a chamada falhar — nunca lança
 * para o chamador tratar como um erro bloqueante.
 */
export async function generateNarration(text: string): Promise<Buffer | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.warn("generateNarration: ELEVENLABS_API_KEY não configurada.");
    return null;
  }

  try {
    const res = await fetch(`${ELEVENLABS_API_BASE}/text-to-speech/${DEFAULT_VOICE_ID}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      console.warn(`generateNarration: ElevenLabs devolveu ${res.status}: ${await res.text()}`);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error: any) {
    console.warn("generateNarration: falha ao gerar áudio:", error?.message);
    return null;
  }
}
