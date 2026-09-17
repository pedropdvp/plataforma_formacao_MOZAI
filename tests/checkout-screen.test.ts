import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O ecrã de pagamento simulado anunciava uma repartição de receita — 80% criador, 10%
 * afiliado, 10% plataforma — que o código nunca fez: /api/checkout cria uma sessão normal e o
 * valor vai todo para a conta da plataforma. Prometer no ecrã o que o sistema não faz é o
 * género de pormenor que quem avalia a plataforma vai testar, por isso fica um teste a
 * guardar a porta.
 */

const catalogo = readFileSync(join(process.cwd(), "app", "dashboard", "catalog", "page.tsx"), "utf8");

describe("ecrã de pagamento simulado", () => {
  it("não anuncia repartição de receita que o checkout não faz", () => {
    for (const promessa of ["Creator Share", "Affiliate", "Application Fee", "Split Connect", "Divisão de Lucros"]) {
      assert.ok(!catalogo.includes(promessa), `o ecrã voltou a prometer "${promessa}"`);
    }
    assert.ok(!/\*\s*0\.8|\*\s*0\.1/.test(catalogo), "voltou a haver cálculo de percentagens de repartição");
  });

  it("não pede dados de cartão, que não vão a lado nenhum", () => {
    assert.ok(!/card(Name|Number)/i.test(catalogo), "voltaram os campos de cartão");
    assert.ok(!catalogo.includes("4242"), "voltou o número de cartão de exemplo");
  });

  it("diz que é uma simulação e quem recebe o dinheiro", () => {
    assert.match(catalogo, /Pagamento simulado/);
    assert.match(catalogo, /nada é cobrado/i);
    assert.match(catalogo, /valor integral/i);
  });
});

describe("a repartição fica registada como roteiro", () => {
  const deployment = readFileSync(join(process.cwd(), "docs", "DEPLOYMENT.md"), "utf8");

  it("o runbook explica que o Connect não está implementado", () => {
    assert.match(deployment, /Stripe Connect\)? — roteiro, não implementado/);
  });

  it("e avisa do que falta antes de vender a sério", () => {
    assert.match(deployment, /Reembolsos/);
    // o runbook quebra as linhas aos 95 caracteres, por isso a frase pode vir partida
    assert.match(deployment, /não\s+inclui Moçambique/);
  });
});
