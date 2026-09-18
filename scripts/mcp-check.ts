import "./load-env";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { hostname } from "node:os";
import { homedir } from "node:os";
import { join } from "node:path";
import { redactSecrets, summarize, type McpProbe, type McpReport, type McpTransport } from "../lib/mcp-status";

/**
 * MCP CHECK: verifica os servidores MCP configurados nesta máquina e, opcionalmente, publica o
 * resultado na plataforma (submenu Configurações > MCPs).
 *
 * A verificação não é uma leitura do ficheiro: cada servidor é arrancado de verdade e tem de
 * responder ao handshake `initialize` do protocolo. Um servidor que esteja mal configurado, sem
 * token ou com o pacote em falta aparece como falhado, que é a única informação que interessa.
 *
 * Executar:  npm run mcp:check            (mostra a tabela)
 *            npm run mcp:check -- --publish  (envia para a plataforma)
 *            npm run mcp:check -- --json     (imprime o relatório)
 *
 * O que é publicado são nomes, estados e mensagens de erro já limpas — nunca comandos,
 * argumentos ou variáveis de ambiente, que é onde vivem os tokens.
 */

const TIMEOUT_MS = Number(process.env.MCP_CHECK_TIMEOUT_MS || 25000);
const CONCORRENCIA = 4;
const PROTOCOL_VERSION = "2024-11-05";

interface ServerConfig {
  type?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

function lerConfiguracao(): Record<string, ServerConfig> {
  const caminho = process.env.MCP_CONFIG_PATH || join(homedir(), ".claude.json");
  let bruto: any;
  try {
    bruto = JSON.parse(readFileSync(caminho, "utf8"));
  } catch (erro: any) {
    console.error(`Não foi possível ler ${caminho}: ${erro?.message}`);
    process.exit(1);
  }

  const servidores: Record<string, ServerConfig> = { ...(bruto.mcpServers || {}) };
  // Um projeto pode ter os seus próprios servidores, a par dos globais.
  for (const projeto of Object.values<any>(bruto.projects || {})) {
    for (const [nome, cfg] of Object.entries<any>(projeto?.mcpServers || {})) {
      if (!servidores[nome]) servidores[nome] = cfg;
    }
  }
  return servidores;
}

const transporteDe = (cfg: ServerConfig): McpTransport => {
  if (cfg.type === "sse") return "sse";
  if (cfg.type === "http" || (!cfg.command && cfg.url)) return "http";
  return "stdio";
};

const pedidoInicial = (id: number) =>
  JSON.stringify({
    jsonrpc: "2.0",
    id,
    method: "initialize",
    params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "mozai-mcp-check", version: "1.0.0" } },
  });

const descreveServidor = (resultado: any): string => {
  const info = resultado?.serverInfo;
  if (!info?.name) return "respondeu ao handshake";
  return [info.name, info.version].filter(Boolean).join(" ");
};

/**
 * No Windows, `npx`, `npm` e afins são ficheiros .cmd: o spawn sem shell não os encontra e
 * devolve ENOENT, o que faria passar por avariado um servidor que está bom. São lançados pelo
 * cmd.exe, como o próprio ficheiro de configuração já faz para alguns servidores. Os
 * argumentos continuam a ir em lista, não numa linha de comando montada por concatenação.
 */
function comandoDaPlataforma(command: string, args: string[]): { ficheiro: string; argumentos: string[] } {
  const precisaDeCmd = process.platform === "win32" && !/\.(exe|cmd|bat)$/i.test(command) && command.toLowerCase() !== "cmd";
  return precisaDeCmd ? { ficheiro: "cmd.exe", argumentos: ["/c", command, ...args] } : { ficheiro: command, argumentos: args };
}

/** Arranca o servidor, faz o handshake e pergunta-lhe as ferramentas. */
function verificarStdio(nome: string, cfg: ServerConfig): Promise<McpProbe> {
  return new Promise((resolve) => {
    const inicio = Date.now();
    const terminar = (state: McpProbe["state"], detail: string, tools: number | null = null) => {
      clearTimeout(cronometro);
      try {
        processo.kill();
      } catch {
        // já morreu
      }
      resolve({ name: nome, transport: "stdio", state, detail: redactSecrets(detail).slice(0, 200), tools, durationMs: Date.now() - inicio });
    };

    let processo: ReturnType<typeof spawn>;
    try {
      const { ficheiro, argumentos } = comandoDaPlataforma(cfg.command!, cfg.args ?? []);
      processo = spawn(ficheiro, argumentos, {
        env: { ...process.env, ...(cfg.env ?? {}) },
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
        windowsHide: true,
      });
    } catch (erro: any) {
      return resolve({ name: nome, transport: "stdio", state: "falhou", detail: redactSecrets(String(erro?.message || erro)).slice(0, 200), tools: null, durationMs: Date.now() - inicio });
    }

    const cronometro = setTimeout(() => terminar("falhou", `não respondeu em ${Math.round(TIMEOUT_MS / 1000)}s`), TIMEOUT_MS);

    let buffer = "";
    let descricao = "";
    let ultimoErro = "";

    processo.stdout?.on("data", (pedaco) => {
      buffer += pedaco.toString();
      let quebra: number;
      while ((quebra = buffer.indexOf("\n")) >= 0) {
        const linha = buffer.slice(0, quebra).trim();
        buffer = buffer.slice(quebra + 1);
        if (!linha) continue;
        let mensagem: any;
        try {
          mensagem = JSON.parse(linha);
        } catch {
          continue; // ruído no stdout, não é do protocolo
        }
        if (mensagem.id === 1) {
          if (mensagem.error) return terminar("falhou", mensagem.error?.message || "recusou o handshake");
          descricao = descreveServidor(mensagem.result);
          processo.stdin?.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
          processo.stdin?.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }) + "\n");
        } else if (mensagem.id === 2) {
          const ferramentas = Array.isArray(mensagem.result?.tools) ? mensagem.result.tools.length : null;
          return terminar("ok", descricao, ferramentas);
        }
      }
    });

    processo.stderr?.on("data", (pedaco) => {
      ultimoErro = pedaco.toString().trim().split("\n").pop() || ultimoErro;
    });

    processo.on("error", (erro: any) => terminar("falhou", erro?.message || "não arrancou"));
    processo.on("exit", (codigo) => {
      if (descricao) return terminar("ok", descricao);
      terminar("falhou", ultimoErro || `terminou com código ${codigo}`);
    });

    processo.stdin?.on("error", () => terminar("falhou", ultimoErro || "fechou a entrada"));
    processo.stdin?.write(pedidoInicial(1) + "\n");
  });
}

async function verificarHttp(nome: string, cfg: ServerConfig, transporte: McpTransport): Promise<McpProbe> {
  const inicio = Date.now();
  try {
    const resposta = await fetch(cfg.url!, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(cfg.headers ?? {}) },
      body: pedidoInicial(1),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const corpo = (await resposta.text()).slice(0, 2000);
    const duracao = Date.now() - inicio;
    if (!resposta.ok) {
      return { name: nome, transport: transporte, state: "falhou", detail: redactSecrets(`HTTP ${resposta.status}: ${corpo}`).slice(0, 200), tools: null, durationMs: duracao };
    }
    const json = corpo.includes("serverInfo") ? corpo : "";
    return { name: nome, transport: transporte, state: "ok", detail: json ? descreveServidor(JSON.parse(corpo.replace(/^data:\s*/m, "")).result) : "respondeu ao handshake", tools: null, durationMs: duracao };
  } catch (erro: any) {
    return { name: nome, transport: transporte, state: "falhou", detail: redactSecrets(String(erro?.message || erro)).slice(0, 200), tools: null, durationMs: Date.now() - inicio };
  }
}

async function verificar(nome: string, cfg: ServerConfig): Promise<McpProbe> {
  const transporte = transporteDe(cfg);
  if (transporte === "stdio") {
    if (!cfg.command) return { name: nome, transport: "stdio", state: "ignorado", detail: "sem comando configurado", tools: null, durationMs: null };
    return verificarStdio(nome, cfg);
  }
  if (!cfg.url) return { name: nome, transport: transporte, state: "ignorado", detail: "sem endereço configurado", tools: null, durationMs: null };
  return verificarHttp(nome, cfg, transporte);
}

async function emLotes<T, R>(itens: T[], tamanho: number, tarefa: (item: T) => Promise<R>): Promise<R[]> {
  const resultados: R[] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    resultados.push(...(await Promise.all(itens.slice(i, i + tamanho).map(tarefa))));
  }
  return resultados;
}

async function publicar(report: McpReport): Promise<void> {
  const base = process.env.MCP_STATUS_URL || "https://plataforma-formacao-mozai.vercel.app";
  const token = process.env.MCP_STATUS_TOKEN;
  if (!token) {
    console.error("\nMCP_STATUS_TOKEN não está definida — nada foi publicado. Ver .env.example.");
    process.exitCode = 1;
    return;
  }

  const resposta = await fetch(`${base.replace(/\/$/, "")}/api/admin/mcp-status`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-mcp-status-token": token },
    body: JSON.stringify(report),
    signal: AbortSignal.timeout(20000),
  });

  const corpo = await resposta.text();
  if (!resposta.ok) {
    console.error(`\nA plataforma recusou o relatório (HTTP ${resposta.status}): ${corpo.slice(0, 200)}`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nRelatório publicado em ${base}/dashboard/admin/mcps`);
}

async function run() {
  const servidores = lerConfiguracao();
  const nomes = Object.keys(servidores).sort();
  if (nomes.length === 0) {
    console.error("Nenhum servidor MCP configurado.");
    process.exit(1);
  }

  console.log(`A verificar ${nomes.length} servidores MCP (até ${Math.round(TIMEOUT_MS / 1000)}s cada)...\n`);
  const sondas = await emLotes(nomes, CONCORRENCIA, (nome) => verificar(nome, servidores[nome]));

  const largura = Math.max(...sondas.map((s) => s.name.length));
  const marca = { ok: "OK    ", falhou: "FALHOU", ignorado: "IGNORA" } as const;
  for (const sonda of sondas.sort((a, b) => a.name.localeCompare(b.name, "pt"))) {
    const tempo = sonda.durationMs === null ? "" : `${(sonda.durationMs / 1000).toFixed(1)}s`;
    const ferramentas = sonda.tools === null ? "" : `${sonda.tools} ferramentas`;
    console.log(`${marca[sonda.state]}  ${sonda.name.padEnd(largura)}  ${sonda.transport.padEnd(5)}  ${tempo.padStart(6)}  ${ferramentas.padEnd(16)}  ${sonda.detail}`);
  }

  const resumo = summarize(sondas);
  console.log(`\n${resumo.ok} a responder, ${resumo.falhou} a falhar, ${resumo.ignorado} ignorados.`);

  const report: McpReport = { checkedAt: new Date().toISOString(), host: hostname(), servers: sondas };

  if (process.argv.includes("--json")) console.log("\n" + JSON.stringify(report, null, 2));
  if (process.argv.includes("--publish")) await publicar(report);
  if (resumo.falhou > 0) process.exitCode = 1;
}

run().catch((erro) => {
  console.error("Erro inesperado:", erro?.message || erro);
  process.exit(1);
});
