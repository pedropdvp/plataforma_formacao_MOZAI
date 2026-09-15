import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assignedRolesOf, needsRoleExistenceCheck, resolveActiveRole } from "@/lib/active-role";

describe("assignedRolesOf", () => {
  it("junta os perfis de todas as empresas, sem repetir", () => {
    const user = {
      tenants: [
        { tenantId: "root", roles: ["ALUNO"] },
        { tenantId: "acme", roles: ["GESTOR_EMPRESA", "ALUNO"] },
      ],
    };
    assert.deepEqual(assignedRolesOf(user).sort(), ["ALUNO", "GESTOR_EMPRESA"]);
  });

  it("um registo sem perfis é ALUNO", () => {
    assert.deepEqual(assignedRolesOf({ tenants: [] }), ["ALUNO"]);
    assert.deepEqual(assignedRolesOf({}), ["ALUNO"]);
  });

  it("sem registo não há perfil nenhum", () => {
    assert.deepEqual(assignedRolesOf(null), []);
  });
});

describe("resolveActiveRole", () => {
  it("aceita um perfil atribuído", () => {
    assert.equal(resolveActiveRole("GESTOR_EMPRESA", ["ALUNO", "GESTOR_EMPRESA"]), "GESTOR_EMPRESA");
  });

  it("recusa um perfil escrito na cookie que não está atribuído", () => {
    assert.equal(resolveActiveRole("ADMIN", ["ALUNO"]), undefined);
    // Mesmo que o perfil exista na plataforma: só o Administrador pode experimentar outros.
    assert.equal(resolveActiveRole("ADMIN", ["ALUNO"], true), undefined);
  });

  it("sem cookie não há perfil ativo", () => {
    assert.equal(resolveActiveRole(undefined, ["ADMIN"]), undefined);
    assert.equal(resolveActiveRole("", ["ADMIN"]), undefined);
  });

  it("o Administrador pode experimentar um perfil que existe", () => {
    assert.equal(resolveActiveRole("TUTOR", ["ADMIN"], true), "TUTOR");
  });

  it("o Administrador não pode usar um perfil que não existe", () => {
    assert.equal(resolveActiveRole("SUPER_ADMIN", ["ADMIN"], false), undefined);
  });
});

describe("needsRoleExistenceCheck", () => {
  it("só pede a consulta à base de dados quando a exceção do Administrador está em jogo", () => {
    assert.equal(needsRoleExistenceCheck("TUTOR", ["ADMIN"]), true);
    assert.equal(needsRoleExistenceCheck("ADMIN", ["ADMIN"]), false);
    assert.equal(needsRoleExistenceCheck("ADMIN", ["ALUNO"]), false);
    assert.equal(needsRoleExistenceCheck(undefined, ["ADMIN"]), false);
  });
});
