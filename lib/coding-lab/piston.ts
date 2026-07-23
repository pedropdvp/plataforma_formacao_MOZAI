/**
 * Cliente fino para a API pública do Piston (https://github.com/engineer-man/piston),
 * usada para executar código de forma real e isolada — o motor de execução corre na
 * infraestrutura do Piston, não no nosso servidor, evitando o risco de execução
 * arbitrária de código que existia na versão anterior (child_process direto).
 *
 * API pública, gratuita, sem chave — respeitar o rate-limit informal (~5 pedidos/seg).
 */

const PISTON_BASE_URL = "https://emkc.org/api/v2/piston";

export interface PistonRuntime {
  language: string;
  version: string;
  aliases: string[];
}

export interface PistonExecuteResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  compileError?: string;
}

let runtimesCache: { data: PistonRuntime[]; fetchedAt: number } | null = null;
const RUNTIMES_CACHE_TTL_MS = 60 * 60 * 1000; // 1h

/** Lista as linguagens/versões suportadas atualmente pelo Piston (cacheado em memória). */
export async function getPistonRuntimes(): Promise<PistonRuntime[]> {
  if (runtimesCache && Date.now() - runtimesCache.fetchedAt < RUNTIMES_CACHE_TTL_MS) {
    return runtimesCache.data;
  }

  const res = await fetch(`${PISTON_BASE_URL}/runtimes`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) {
    throw new Error(`Piston devolveu ${res.status} ao listar runtimes.`);
  }
  const data: PistonRuntime[] = await res.json();
  runtimesCache = { data, fetchedAt: Date.now() };
  return data;
}

/** Resolve a versão mais recente disponível para uma linguagem (por alias ou nome). */
async function resolveVersion(language: string): Promise<{ language: string; version: string }> {
  const runtimes = await getPistonRuntimes();
  const match = runtimes.find((r) => r.language === language || r.aliases.includes(language));
  if (!match) {
    throw new Error(`Linguagem "${language}" não é suportada pelo Piston.`);
  }
  return { language: match.language, version: match.version };
}

/**
 * Executa código de forma isolada via Piston. Devolve stdout/stderr/exitCode reais —
 * nunca fabrica resultados; um erro de execução real aparece em stderr, tal como
 * aconteceria numa consola real.
 */
export async function executeCode(
  language: string,
  code: string,
  stdin: string = ""
): Promise<PistonExecuteResult> {
  const { language: resolvedLanguage, version } = await resolveVersion(language);

  const res = await fetch(`${PISTON_BASE_URL}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: resolvedLanguage,
      version,
      files: [{ content: code }],
      stdin,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Piston devolveu ${res.status} ao executar o código.`);
  }

  const data = await res.json();

  if (data.compile && data.compile.code !== 0) {
    return {
      stdout: "",
      stderr: data.compile.stderr || data.compile.output || "Erro de compilação.",
      exitCode: data.compile.code,
      compileError: data.compile.stderr || data.compile.output,
    };
  }

  return {
    stdout: data.run?.stdout || "",
    stderr: data.run?.stderr || "",
    exitCode: data.run?.code ?? -1,
  };
}
