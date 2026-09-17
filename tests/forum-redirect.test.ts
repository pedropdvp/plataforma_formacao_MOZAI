import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O Fórum era uma maqueta — fóruns escritos no código, contagens de tópicos fixas e um botão
 * que só mostrava um aviso. Passou a encaminhar para os Grupos, onde as discussões existem
 * mesmo. Estes testes impedem que a maqueta volte sem que alguém repare.
 */

const ROOT = process.cwd();
const read = (...caminho: string[]) => readFileSync(join(ROOT, ...caminho), "utf8");

describe("a página do Fórum encaminha para os Grupos", () => {
  const pagina = read("app", "dashboard", "forum", "page.tsx");

  it("é uma página de servidor que redireciona", () => {
    assert.ok(!/^\s*["']use client["']/.test(pagina), "não pode ser um componente de cliente");
    assert.match(pagina, /redirect\(["']\/dashboard\/groups["']\)/);
  });

  it("não volta a prometer o que não cumpre", () => {
    assert.ok(!/threadsCount/.test(pagina), "as contagens de tópicos eram inventadas");
    assert.ok(!/Aceder ao Fórum/.test(pagina), "o botão de entrar não tinha destino");
  });
});

describe("o menu", () => {
  const registo = read("lib", "menu-registry.ts");
  const barra = read("components", "sidebar-nav.tsx");

  it("já não oferece o Fórum", () => {
    assert.ok(!registo.includes("/dashboard/forum"), "menu-registry.ts ainda aponta para o Fórum");
    assert.ok(!barra.includes("/dashboard/forum"), "sidebar-nav.tsx ainda aponta para o Fórum");
  });

  it("continua a oferecer os Grupos, que é para onde as discussões foram", () => {
    assert.ok(registo.includes("/dashboard/groups"));
    assert.ok(barra.includes("/dashboard/groups"));
  });
});
