#!/usr/bin/env node
/**
 * CLI real da MOZAI — chama a API pública diretamente via fetch nativo do Node (18+),
 * sem dependências externas. Distribuído como script no repositório (não publicado no npm).
 *
 * Uso:
 *   MOZAI_API_KEY=mozai_... node cli/mozai-cli.js run-prompt <promptId> '{"tema":"vendas"}'
 */

const BASE_URL = process.env.MOZAI_BASE_URL || "https://plataforma-formacao-mozai.vercel.app";

async function runPrompt(promptId, variablesJson) {
  const apiKey = process.env.MOZAI_API_KEY;
  if (!apiKey || !apiKey.startsWith("mozai_")) {
    console.error("Erro: defina MOZAI_API_KEY (gerada em /dashboard/marketplace > APIs).");
    process.exit(1);
  }
  if (!promptId) {
    console.error("Uso: mozai-cli run-prompt <promptId> ['{\"var\":\"valor\"}']");
    process.exit(1);
  }

  let variables = {};
  if (variablesJson) {
    try {
      variables = JSON.parse(variablesJson);
    } catch {
      console.error("Erro: o segundo argumento deve ser JSON válido.");
      process.exit(1);
    }
  }

  const res = await fetch(`${BASE_URL}/api/public/v1/prompts/${promptId}/run`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ variables }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error(`Erro (HTTP ${res.status}): ${data.error}`);
    process.exit(1);
  }

  console.log(data.result);
  console.error(`\n[Créditos IA restantes: ${data.creditsRemaining}]`);
}

const [, , command, ...args] = process.argv;

switch (command) {
  case "run-prompt":
    runPrompt(args[0], args[1]);
    break;
  default:
    console.log("Comandos disponíveis:\n  run-prompt <promptId> ['{\"var\":\"valor\"}']");
    process.exit(command ? 1 : 0);
}
