import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isStale, parseReport, redactSecrets, reportAgeMinutes, sanitizeProbe, summarize } from "@/lib/mcp-status";

/**
 * O relatório dos MCP nasce no ficheiro de configuração de quem desenvolve, que guarda tokens.
 * Estes testes guardam a fronteira: o que chega ao servidor é reduzido aos campos conhecidos e
 * limpo de segredos, e um relatório velho nunca passa por fresco.
 */

describe("redactSecrets", () => {
  it("apaga caminhos com o nome do utilizador", () => {
    assert.equal(redactSecrets("falhou em C:\\Users\\Nitropc\\.claude.json"), "falhou em <caminho>\\.claude.json");
    assert.equal(redactSecrets("ENOENT /home/pedro/bin/uvx"), "ENOENT <caminho>/bin/uvx");
  });

  it("apaga chaves e sequências longas", () => {
    assert.match(redactSecrets("Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789"), /<oculto>/);
    assert.equal(redactSecrets("HOSTINGER_API_TOKEN=abc123"), "HOSTINGER_API_TOKEN=<oculto>");
    // o espaço à volta do = desaparece com a substituição, e isso é indiferente
    assert.equal(redactSecrets("api_key = xyz"), "api_key=<oculto>");
  });

  it("deixa em paz uma mensagem de erro normal", () => {
    assert.equal(redactSecrets("spawn npx ENOENT"), "spawn npx ENOENT");
  });
});

describe("sanitizeProbe", () => {
  it("guarda só os campos conhecidos", () => {
    const probe = sanitizeProbe({
      name: "hostinger-api",
      transport: "stdio",
      state: "ok",
      detail: "hostinger-api 1.2.0",
      tools: 214,
      durationMs: 1200,
      // tudo o que se segue vem do ficheiro de configuração e não pode passar
      command: "cmd",
      args: ["/c", "npx", "hostinger-api-mcp"],
      env: { HOSTINGER_API_TOKEN: "segredo-verdadeiro" },
    });

    assert.deepEqual(probe, {
      name: "hostinger-api",
      transport: "stdio",
      state: "ok",
      detail: "hostinger-api 1.2.0",
      tools: 214,
      durationMs: 1200,
    });
    assert.ok(!JSON.stringify(probe).includes("segredo-verdadeiro"));
  });

  it("limpa a mensagem de erro que traz a linha de comando", () => {
    const probe = sanitizeProbe({ name: "github", state: "falhou", detail: "falhou: C:\\Users\\Nitropc\\npx GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz012345" });
    assert.ok(!probe!.detail.includes("Nitropc"));
    assert.ok(!probe!.detail.includes("ghp_"));
  });

  it("recusa o que não tem nome e assume o pior estado quando é inválido", () => {
    assert.equal(sanitizeProbe({ state: "ok" }), null);
    assert.equal(sanitizeProbe("nem por sombras"), null);
    assert.equal(sanitizeProbe({ name: "x", state: "inventado" })!.state, "falhou");
    assert.equal(sanitizeProbe({ name: "x", transport: "carteiro" })!.transport, "stdio");
  });
});

describe("parseReport", () => {
  const agora = new Date("2026-09-18T10:00:00.000Z");

  it("aceita um relatório bem formado", () => {
    const resultado = parseReport(
      { checkedAt: "2026-09-18T09:55:00.000Z", host: "NITROPC", servers: [{ name: "memory", state: "ok", transport: "stdio" }] },
      agora
    );
    assert.ok("report" in resultado);
    assert.equal(resultado.report.servers.length, 1);
    assert.equal(resultado.report.host, "NITROPC");
  });

  it("recusa corpos que não trazem servidores", () => {
    assert.ok("error" in parseReport({}, agora));
    assert.ok("error" in parseReport({ servers: [] }, agora));
    assert.ok("error" in parseReport({ servers: [{ semNome: true }] }, agora));
    assert.ok("error" in parseReport(null, agora));
  });

  it("recusa uma lista absurdamente grande", () => {
    const servers = Array.from({ length: 61 }, (_, i) => ({ name: `s${i}`, state: "ok" }));
    assert.ok("error" in parseReport({ servers }, agora));
  });

  it("usa a hora de chegada quando a data vem estragada", () => {
    const resultado = parseReport({ checkedAt: "ontem à tarde", servers: [{ name: "memory", state: "ok" }] }, agora);
    assert.ok("report" in resultado);
    assert.equal(resultado.report.checkedAt, agora.toISOString());
  });
});

describe("idade do relatório", () => {
  const agora = new Date("2026-09-18T10:00:00.000Z");

  it("conta os minutos desde a verificação", () => {
    assert.equal(reportAgeMinutes("2026-09-18T09:30:00.000Z", agora), 30);
    assert.equal(reportAgeMinutes("data inválida", agora), null);
  });

  it("um relatório de ontem não passa por fresco", () => {
    assert.ok(!isStale("2026-09-18T09:30:00.000Z", agora));
    assert.ok(isStale("2026-09-17T10:00:00.000Z", agora));
  });
});

describe("a rota que recebe os relatórios", () => {
  const rota = readFileSync(join(process.cwd(), "app", "api", "admin", "mcp-status", "route.ts"), "utf8");
  const postar = rota.slice(rota.indexOf("export async function POST"), rota.indexOf("export async function GET"));
  const obter = rota.slice(rota.indexOf("export async function GET"));

  it("o POST exige a chave e compara-a em tempo constante", () => {
    assert.match(postar, /MCP_STATUS_TOKEN/);
    assert.match(rota, /timingSafeEqual/);
    assert.match(postar, /status: 401/);
  });

  it("o POST recusa-se a funcionar sem chave configurada, em vez de aceitar tudo", () => {
    assert.match(postar, /status: 503/);
  });

  it("o POST nunca guarda o corpo em cru — passa sempre pelo parseReport", () => {
    assert.match(postar, /parseReport\(/);
    assert.ok(!/insertTenantScoped\([^)]*corpo/.test(postar), "o corpo do pedido não pode ir direto para a base");
  });

  it("o GET exige sessão e o perfil que abre a página", () => {
    assert.match(obter, /auth\(\)/);
    assert.match(obter, /canActiveRoleOpen\("\/dashboard\/admin\/mcps"\)/);
  });

  it("a página está restrita a ADMIN", () => {
    const regras = readFileSync(join(process.cwd(), "lib", "route-access.ts"), "utf8");
    assert.match(regras, /prefix: "\/dashboard\/admin\/mcps", roles: ADMIN_ONLY/);
  });
});

describe("summarize", () => {
  it("conta por estado", () => {
    const resumo = summarize([
      { name: "a", transport: "stdio", state: "ok", detail: "", tools: 1, durationMs: 1 },
      { name: "b", transport: "http", state: "falhou", detail: "", tools: null, durationMs: null },
      { name: "c", transport: "stdio", state: "ignorado", detail: "", tools: null, durationMs: null },
    ]);
    assert.deepEqual(resumo, { total: 3, ok: 1, falhou: 1, ignorado: 1 });
  });
});
