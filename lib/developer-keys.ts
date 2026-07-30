import { randomBytes, createHash } from "crypto";

/** Gera uma nova chave de API real: "mozai_" + 32 bytes aleatórios em hex. */
export function generateApiKey(): { plaintext: string; prefix: string } {
  const raw = randomBytes(24).toString("hex");
  const plaintext = `mozai_${raw}`;
  const prefix = plaintext.slice(0, 12); // ex: "mozai_ab12cd" — só para identificação visual, nunca a chave toda
  return { plaintext, prefix };
}

/** Hash unidirecional (SHA-256) da chave — nunca guardamos o valor em texto simples. */
export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}
