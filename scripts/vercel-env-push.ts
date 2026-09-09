/**
 * Envia as variáveis de .env.local para o ambiente Production da Vercel.
 *
 * Colar 28 variáveis à mão no painel é onde se perdem deploys: basta uma
 * colada com um espaço no fim, ou uma esquecida, para a aplicação arrancar e
 * falhar só na primeira consulta. Isto lê a fonte de verdade que já existe
 * no disco e escreve-a de uma vez.
 *
 *     npx vercel login          # uma vez, na máquina
 *     npx tsx scripts/vercel-env-push.ts --dry-run
 *     npx tsx scripts/vercel-env-push.ts
 *
 * Os valores NUNCA são impressos — só os nomes das chaves.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

/** Gerada pela própria Vercel em cada build; enviá-la partiria a autenticação OIDC. */
const IGNORADAS = new Set(["VERCEL_OIDC_TOKEN"]);

const AMBIENTE = process.env.VERCEL_TARGET_ENV || "production";
const dryRun = process.argv.includes("--dry-run");

function lerEnvLocal(): Map<string, string> {
  const caminho = resolve(process.cwd(), ".env.local");
  let bruto: string;
  try {
    bruto = readFileSync(caminho, "utf8");
  } catch {
    console.error(`✖ Não encontrei ${caminho}. Este script lê de .env.local.`);
    process.exit(1);
  }

  const vars = new Map<string, string>();
  for (const linha of bruto.split("\n")) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith("#")) continue;
    const eq = limpa.indexOf("=");
    if (eq === -1) continue;
    const chave = limpa.slice(0, eq).trim();
    let valor = limpa.slice(eq + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (!chave || IGNORADAS.has(chave)) continue;
    if (!valor) {
      console.warn(`⚠ ${chave} está vazia em .env.local — ignorada.`);
      continue;
    }
    vars.set(chave, valor);
  }
  return vars;
}

function enviar(chave: string, valor: string): boolean {
  // `vercel env add` recusa uma chave que já exista: remove-se primeiro, para
  // o script poder correr outra vez sem obrigar a limpar o painel à mão.
  spawnSync("npx", ["vercel", "env", "rm", chave, AMBIENTE, "--yes"], {
    stdio: "ignore",
    shell: true,
  });

  const r = spawnSync("npx", ["vercel", "env", "add", chave, AMBIENTE], {
    input: valor,
    stdio: ["pipe", "ignore", "pipe"],
    shell: true,
    encoding: "utf8",
  });

  if (r.status !== 0) {
    console.error(`✖ ${chave}: ${(r.stderr || "").trim().split("\n").pop()}`);
    return false;
  }
  return true;
}

const vars = lerEnvLocal();
console.log(`${vars.size} variáveis para o ambiente "${AMBIENTE}".\n`);

if (!vars.has("NEXT_PUBLIC_BASE_DOMAIN")) {
  console.warn(
    "⚠ NEXT_PUBLIC_BASE_DOMAIN não está em .env.local. Sem ela o middleware\n" +
      "  assume mozai.education e pode ler o host do deployment como um tenant.\n" +
      "  Acrescenta-a com o host real (ex.: mozai-demo.vercel.app).\n",
  );
}

if (dryRun) {
  for (const chave of vars.keys()) console.log(`  (simulação) ${chave}`);
  console.log("\nNada foi enviado. Retira --dry-run para enviar.");
  process.exit(0);
}

let ok = 0;
for (const [chave, valor] of vars) {
  if (enviar(chave, valor)) {
    ok++;
    console.log(`  ✓ ${chave}`);
  }
}

console.log(`\n${ok}/${vars.size} enviadas.`);
if (ok < vars.size) process.exit(1);
