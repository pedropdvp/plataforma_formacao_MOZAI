import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Carrega variáveis de ambiente de .env.local (e .env) para process.env,
 * sem depender do pacote dotenv. Deve ser importado ANTES de qualquer módulo
 * que leia process.env no topo (ex.: lib/mongodb, lib/sanity).
 */
export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const raw = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        // Remove aspas envolventes
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = value;
      }
    } catch {
      // Ficheiro ausente — ignora
    }
  }
}

loadEnv();
