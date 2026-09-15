import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { allowedRolesForPath, canRoleAccessPath } from "@/lib/route-access";

describe("allowedRolesForPath", () => {
  it("rotas sem regra só exigem sessão e perfil ativo", () => {
    assert.equal(allowedRolesForPath("/dashboard"), null);
    assert.equal(allowedRolesForPath("/dashboard/catalog"), null);
  });

  it("um prefixo não apanha caminhos que só começam pelas mesmas letras", () => {
    assert.equal(allowedRolesForPath("/dashboard/adminx"), null);
    assert.equal(allowedRolesForPath("/dashboard/reportsx"), null);
  });
});

describe("canRoleAccessPath", () => {
  it("a raiz da consola é da empresa, as restantes páginas são da plataforma", () => {
    assert.ok(canRoleAccessPath("GESTOR_EMPRESA", "/dashboard/admin"));
    assert.ok(canRoleAccessPath("FUNCIONARIO", "/dashboard/admin"));
    assert.ok(!canRoleAccessPath("GESTOR_EMPRESA", "/dashboard/admin/menus"));
    assert.ok(canRoleAccessPath("SUPORTE", "/dashboard/admin/menus"));
  });

  it("as variáveis de ambiente são só do ADMIN", () => {
    assert.ok(canRoleAccessPath("ADMIN", "/dashboard/admin/env-check"));
    assert.ok(!canRoleAccessPath("SUPORTE", "/dashboard/admin/env-check"));
  });

  it("content-factory e content-factory-tools são regras distintas, ambas abertas ao aluno", () => {
    assert.ok(canRoleAccessPath("ALUNO", "/dashboard/admin/content-factory"));
    assert.ok(canRoleAccessPath("ALUNO", "/dashboard/admin/content-factory-tools"));
    assert.ok(!canRoleAccessPath("ALUNO", "/dashboard/admin/levels"));
  });

  it("os docentes veem os seus alunos, mas não os relatórios de gestão", () => {
    assert.ok(canRoleAccessPath("TUTOR", "/dashboard/reports/my-students"));
    assert.ok(!canRoleAccessPath("TUTOR", "/dashboard/reports/students"));
    assert.ok(canRoleAccessPath("GESTOR_EMPRESA", "/dashboard/reports/students"));
  });

  it("a auditoria é só da plataforma", () => {
    assert.ok(!canRoleAccessPath("GESTOR_EMPRESA", "/dashboard/reports/audit"));
    assert.ok(canRoleAccessPath("SUPORTE", "/dashboard/reports/audit"));
  });

  it("sem perfil não se entra em rotas restritas", () => {
    assert.ok(!canRoleAccessPath(undefined, "/dashboard/admin"));
    assert.ok(!canRoleAccessPath(null, "/dashboard/reports/students"));
    assert.ok(canRoleAccessPath(undefined, "/dashboard"));
  });
});
