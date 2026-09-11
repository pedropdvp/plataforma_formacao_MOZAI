import "./load-env";
import { getDb } from "../lib/mongodb";
import { PERMISSIONS_DATA, ROLES_DATA } from "../lib/seeder";

/**
 * Alinha o catálogo de permissões e os perfis de acesso da base de dados com o que está
 * definido em lib/seeder.ts, SEM apagar nada que já exista.
 *
 * Existe porque `seedSecurityData()` faz `deleteMany({})` às três coleções — incluindo
 * `users` — e por isso não pode ser corrido numa base de dados com contas reais. Sem uma
 * alternativa não-destrutiva, permissões novas acrescentadas ao seeder nunca chegavam à
 * produção: era assim que PROJECTS_SUBMIT e PROJECTS_REVIEW estavam declaradas no código,
 * exigidas pelo menu, e ausentes da base de dados — logo invisíveis para todos os perfis.
 *
 * É idempotente: correr duas vezes seguidas não muda nada na segunda.
 *
 * Executar:  npm run perms:sync        (pré-visualizar)
 *            npm run perms:sync -- --apply   (escrever)
 */
async function main() {
  const apply = process.argv.includes("--apply");
  const db = await getDb();

  const dbPerms = await db.collection("permissions").find({}).toArray();
  const dbPermIds = new Set(dbPerms.map((p: any) => String(p._id)));
  const missingPerms = PERMISSIONS_DATA.filter((p: any) => !dbPermIds.has(p._id));

  console.log(`Catálogo: ${PERMISSIONS_DATA.length} no código, ${dbPermIds.size} na base de dados.`);
  for (const p of missingPerms) console.log(`  + permissão em falta: ${p._id} (${p.name})`);
  if (!missingPerms.length) console.log("  (catálogo já sincronizado)");

  const rolePatches: { id: string; add: string[] }[] = [];
  for (const role of ROLES_DATA) {
    const dbRole = await db.collection("roles").findOne({ _id: role._id as never });
    if (!dbRole) {
      rolePatches.push({ id: role._id, add: role.permissions });
      console.log(`  + perfil ausente da base de dados: ${role._id}`);
      continue;
    }
    const current = new Set<string>(dbRole.permissions || []);
    // Só acrescenta. Permissões retiradas a um perfil pelo ecrã "Perfis de acesso" são uma
    // decisão do administrador, e não é este script que a desfaz.
    const add = role.permissions.filter((p: string) => !current.has(p));
    if (add.length) {
      rolePatches.push({ id: role._id, add });
      console.log(`  + perfil ${role._id}: acrescentar ${add.join(", ")}`);
    }
  }
  if (!rolePatches.length) console.log("  (perfis já sincronizados)");

  if (!apply) {
    console.log("\nPré-visualização apenas. Repetir com --apply para escrever.");
    process.exit(0);
  }

  if (missingPerms.length) {
    await db.collection("permissions").insertMany(missingPerms);
    console.log(`\n✔ ${missingPerms.length} permissão(ões) inserida(s) no catálogo.`);
  }
  for (const patch of rolePatches) {
    await db.collection("roles").updateOne(
      { _id: patch.id as never },
      {
        $addToSet: { permissions: { $each: patch.add } },
        $setOnInsert: { name: patch.id, description: "" },
      },
      { upsert: true }
    );
    console.log(`✔ perfil ${patch.id}: +${patch.add.length} permissão(ões).`);
  }
  if (!missingPerms.length && !rolePatches.length) console.log("\nNada a fazer.");
  process.exit(0);
}

main();
