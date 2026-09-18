/**
 * Estado dos servidores MCP da máquina de quem desenvolve.
 *
 * A plataforma corre em serverless: não tem como espreitar o `~/.claude.json` de ninguém. Quem
 * verifica é o `scripts/mcp-check.ts`, que corre nessa máquina e publica o resultado em
 * POST /api/admin/mcp-status; a página mostra o último relatório recebido e a sua idade.
 *
 * O ficheiro de configuração dos MCP guarda segredos — é lá que está, por exemplo, o token da
 * Hostinger. Por isso o relatório é reduzido aqui aos campos conhecidos, e só a esses: um
 * campo novo que apareça no corpo do pedido não passa desta função. As mensagens de erro
 * também são limpas, porque um erro de arranque costuma trazer a linha de comando inteira.
 *
 * Módulo puro, sem base de dados nem rede, para se poder testar isoladamente.
 */

export const MCP_TRANSPORTS = ["stdio", "http", "sse"] as const;
export type McpTransport = (typeof MCP_TRANSPORTS)[number];

/** `ok` responde ao handshake; `falhou` não respondeu; `ignorado` nem chegou a ser testado. */
export const MCP_STATES = ["ok", "falhou", "ignorado"] as const;
export type McpState = (typeof MCP_STATES)[number];

export interface McpProbe {
  name: string;
  transport: McpTransport;
  state: McpState;
  /** Versão anunciada pelo servidor, ou a razão da falha. Nunca a linha de comando. */
  detail: string;
  /** Ferramentas anunciadas no handshake. */
  tools: number | null;
  durationMs: number | null;
}

export interface McpReport {
  checkedAt: string;
  /** Máquina de onde veio o relatório, para distinguir dois computadores. */
  host: string;
  servers: McpProbe[];
}

const LIMITE_NOME = 60;
const LIMITE_DETALHE = 200;
const LIMITE_SERVIDORES = 60;

/**
 * Tira do texto o que costuma ser segredo: caminhos com o nome do utilizador, valores de
 * variáveis de ambiente e sequências longas sem espaços, que são quase sempre chaves.
 */
export function redactSecrets(texto: string): string {
  return texto
    .replace(/[A-Za-z]:\\Users\\[^\\\s"']+/gi, "<caminho>")
    .replace(/\/(?:home|Users)\/[^/\s"']+/gi, "<caminho>")
    .replace(/\b(?:Bearer\s+)?[A-Za-z0-9_-]{32,}\b/g, "<oculto>")
    .replace(/\b([A-Z0-9_]*(?:TOKEN|KEY|SECRET|PASSWORD|PWD)[A-Z0-9_]*)\s*=\s*\S+/gi, "$1=<oculto>");
}

const texto = (valor: unknown, limite: number): string =>
  typeof valor === "string" ? redactSecrets(valor).trim().slice(0, limite) : "";

const inteiro = (valor: unknown): number | null =>
  typeof valor === "number" && Number.isFinite(valor) && valor >= 0 ? Math.round(valor) : null;

/**
 * Uma sonda com apenas os campos conhecidos, ou `null` se não tiver nome. Tudo o que venha a
 * mais no corpo do pedido — `env`, `args`, `command` — fica de fora por não ser copiado.
 */
export function sanitizeProbe(raw: unknown): McpProbe | null {
  if (!raw || typeof raw !== "object") return null;
  const bruto = raw as Record<string, unknown>;

  const name = texto(bruto.name, LIMITE_NOME);
  if (!name) return null;

  const transport = MCP_TRANSPORTS.includes(bruto.transport as McpTransport)
    ? (bruto.transport as McpTransport)
    : "stdio";
  const state = MCP_STATES.includes(bruto.state as McpState) ? (bruto.state as McpState) : "falhou";

  return { name, transport, state, detail: texto(bruto.detail, LIMITE_DETALHE), tools: inteiro(bruto.tools), durationMs: inteiro(bruto.durationMs) };
}

export type ParseResult = { report: McpReport } | { error: string };

/** Relatório validado a partir do corpo do pedido. */
export function parseReport(raw: unknown, agora: Date = new Date()): ParseResult {
  if (!raw || typeof raw !== "object") return { error: "O relatório tem de ser um objeto." };
  const bruto = raw as Record<string, unknown>;

  if (!Array.isArray(bruto.servers)) return { error: "O relatório tem de trazer a lista de servidores." };
  if (bruto.servers.length > LIMITE_SERVIDORES) return { error: "Servidores a mais no relatório." };

  const servers = bruto.servers.map(sanitizeProbe).filter((s): s is McpProbe => s !== null);
  if (servers.length === 0) return { error: "Nenhum servidor reconhecido no relatório." };

  const quandoPedido = typeof bruto.checkedAt === "string" ? new Date(bruto.checkedAt) : new Date(NaN);
  const checkedAt = Number.isNaN(quandoPedido.getTime()) ? agora : quandoPedido;

  return { report: { checkedAt: checkedAt.toISOString(), host: texto(bruto.host, LIMITE_NOME) || "desconhecido", servers } };
}

export interface McpSummary {
  total: number;
  ok: number;
  falhou: number;
  ignorado: number;
}

export function summarize(servers: McpProbe[]): McpSummary {
  return {
    total: servers.length,
    ok: servers.filter((s) => s.state === "ok").length,
    falhou: servers.filter((s) => s.state === "falhou").length,
    ignorado: servers.filter((s) => s.state === "ignorado").length,
  };
}

/**
 * Um relatório velho é pior do que nenhum: mostra tudo verde de uma verificação de há uma
 * semana. A página usa isto para o dizer em vez de o esconder.
 */
export function reportAgeMinutes(checkedAt: string, agora: Date = new Date()): number | null {
  const quando = new Date(checkedAt);
  if (Number.isNaN(quando.getTime())) return null;
  return Math.max(0, Math.round((agora.getTime() - quando.getTime()) / 60000));
}

export const STALE_AFTER_MINUTES = 60;

export function isStale(checkedAt: string, agora: Date = new Date()): boolean {
  const idade = reportAgeMinutes(checkedAt, agora);
  return idade === null || idade > STALE_AFTER_MINUTES;
}
