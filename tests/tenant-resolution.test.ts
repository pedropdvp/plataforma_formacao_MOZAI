import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { authorizeTenant, resolveTenantId } from "@/lib/tenant-resolution";

describe("resolveTenantId", () => {
  it("a cookie da empresa escolhida tem prioridade sobre o host", () => {
    assert.equal(resolveTenantId({ tenantCookie: "acme", host: "outra.mozai.education" }), "acme");
  });

  it("localhost é o tenant raiz em qualquer porta", () => {
    assert.equal(resolveTenantId({ host: "localhost:3000" }), "root");
    assert.equal(resolveTenantId({ host: "localhost:3001" }), "root");
  });

  it("os subdomínios de teste funcionam em qualquer porta", () => {
    assert.equal(resolveTenantId({ host: "acme.localhost:3000" }), "acme");
    assert.equal(resolveTenantId({ host: "acme.localhost:3001" }), "acme");
  });

  it("o subdomínio do domínio base é o tenant", () => {
    assert.equal(resolveTenantId({ host: "acme.mozai.education" }), "acme");
    assert.equal(resolveTenantId({ host: "acme.mozai-demo.vercel.app", baseDomain: "mozai-demo.vercel.app" }), "acme");
  });

  it("o próprio domínio base é o tenant raiz", () => {
    assert.equal(resolveTenantId({ host: "mozai.education" }), "root");
    assert.equal(resolveTenantId({ host: "mozai-demo.vercel.app", baseDomain: "mozai-demo.vercel.app" }), "root");
  });

  it("um host de outro domínio não inventa um tenant", () => {
    assert.equal(resolveTenantId({ host: "evil.com" }), "root");
    assert.equal(resolveTenantId({ host: "acme.mozai.education.evil.com" }), "root");
  });

  it("sem host é o tenant raiz", () => {
    assert.equal(resolveTenantId({ host: null }), "root");
    assert.equal(resolveTenantId({}), "root");
  });
});

describe("authorizeTenant", () => {
  const gestorAcme = {
    memberships: [{ tenantId: "acme", roles: ["GESTOR_EMPRESA"] }],
    assignedRoles: ["GESTOR_EMPRESA"],
    activeRole: "GESTOR_EMPRESA",
  };

  it("aceita uma empresa a que o utilizador pertence", () => {
    assert.equal(authorizeTenant({ ...gestorAcme, requestedTenantId: "acme" }), "acme");
  });

  it("não deixa mudar para outra empresa pela cookie ou por parâmetro", () => {
    assert.equal(authorizeTenant({ ...gestorAcme, requestedTenantId: "concorrente" }), "acme");
    assert.equal(authorizeTenant({ ...gestorAcme, requestedTenantId: "all" }), "acme");
  });

  it("quem não pertence à raiz também não cai nela por omissão", () => {
    assert.equal(authorizeTenant({ ...gestorAcme, requestedTenantId: "root" }), "acme");
  });

  it("fica na empresa do perfil ativo quando pertence a várias", () => {
    const pessoa = {
      memberships: [
        { tenantId: "root", roles: ["ALUNO"] },
        { tenantId: "acme", roles: ["GESTOR_EMPRESA"] },
      ],
      assignedRoles: ["ALUNO", "GESTOR_EMPRESA"],
    };
    assert.equal(authorizeTenant({ ...pessoa, activeRole: "GESTOR_EMPRESA", requestedTenantId: "outra" }), "acme");
    assert.equal(authorizeTenant({ ...pessoa, activeRole: "ALUNO", requestedTenantId: "outra" }), "root");
  });

  it("os perfis da plataforma operam sobre qualquer empresa", () => {
    const admin = { memberships: [{ tenantId: "root", roles: ["ADMIN"] }], assignedRoles: ["ADMIN"] };
    assert.equal(authorizeTenant({ ...admin, activeRole: "ADMIN", requestedTenantId: "acme" }), "acme");
    // Mesmo a experimentar outro perfil: é o mesmo Administrador.
    assert.equal(authorizeTenant({ ...admin, activeRole: "GESTOR_EMPRESA", requestedTenantId: "acme" }), "acme");
    const suporte = { memberships: [{ tenantId: "root", roles: ["SUPORTE"] }], assignedRoles: ["SUPORTE"] };
    assert.equal(authorizeTenant({ ...suporte, activeRole: "SUPORTE", requestedTenantId: "all" }), "all");
  });

  it("sem empresas associadas é o tenant raiz", () => {
    assert.equal(
      authorizeTenant({ memberships: [], assignedRoles: [], requestedTenantId: "acme" }),
      "root"
    );
  });
});
