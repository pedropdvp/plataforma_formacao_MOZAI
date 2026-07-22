import "./load-env";
import { createInterface } from "node:readline/promises";
import { listLocalBackups, listBlobBackups, restoreBackup } from "../lib/backup/core";

/**
 * Restaura a base de dados a partir de um backup anterior. Substitui o conteúdo
 * atual de cada coleção pelo estado guardado nesse backup. Cria automaticamente
 * um backup de segurança do estado atual antes de mexer em qualquer coisa.
 *
 * Executar:
 *   npm run db:restore                 -> lista os backups disponíveis
 *   npm run db:restore -- <id>         -> restaura esse backup (pede confirmação)
 *   npm run db:restore -- <id> --yes   -> restaura sem pedir confirmação
 */
async function listAvailable() {
  const [local, blob] = await Promise.all([listLocalBackups(), listBlobBackups()]);
  const byId = new Map<string, { local: boolean; blob: boolean; manifest: any }>();
  for (const m of local) byId.set(m.id, { local: true, blob: false, manifest: m });
  for (const m of blob) {
    const existing = byId.get(m.id);
    if (existing) existing.blob = true;
    else byId.set(m.id, { local: false, blob: true, manifest: m });
  }

  const entries = [...byId.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  if (entries.length === 0) {
    console.log("Nenhum backup encontrado (nem local, nem no Blob). Corre primeiro: npm run db:backup");
    return;
  }

  console.log("Backups disponíveis (mais recente primeiro):\n");
  for (const [id, info] of entries) {
    const where = [info.local && "local", info.blob && "blob"].filter(Boolean).join(" + ");
    const totalDocs = Object.values(info.manifest.collections as Record<string, number>).reduce((a, b) => a + b, 0);
    console.log(`  ${id}  [${where}]  ${totalDocs} documentos  (${info.manifest.trigger})`);
  }
  console.log("\nPara restaurar: npm run db:restore -- <id>");
}

async function main() {
  const args = process.argv.slice(2);
  const id = args.find((a) => !a.startsWith("--"));
  const skipConfirm = args.includes("--yes");

  if (!id) {
    await listAvailable();
    return;
  }

  if (!skipConfirm) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(
      `\n⚠ Isto vai APAGAR os dados atuais de cada coleção presente no backup "${id}" e substituí-los pelo conteúdo desse backup.\n` +
      `Um backup de segurança do estado atual é criado automaticamente antes.\n` +
      `Escreve CONFIRMAR para continuar: `
    );
    rl.close();
    if (answer.trim() !== "CONFIRMAR") {
      console.log("Cancelado.");
      return;
    }
  }

  console.log(`\nA restaurar backup "${id}"...`);
  const result = await restoreBackup(id);

  console.log(`\n✔ Restauro concluído.`);
  console.log(`  Backup de segurança do estado anterior: "${result.safetyBackupId}"`);
  console.log("  Coleções restauradas:");
  for (const [name, count] of Object.entries(result.restoredCollections)) {
    console.log(`    - ${name}: ${count} documentos`);
  }
}

// Ver nota em db-backup.ts sobre não forçar process.exit(0) no sucesso.
main().catch((err) => {
  console.error("\n✘ Falha ao restaurar backup:", err.message);
  process.exit(1);
});
