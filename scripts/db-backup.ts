import "./load-env";
import { createBackup, pruneOldBackups } from "../lib/backup/core";

/**
 * Cria um backup completo da base de dados (users, courses, user_progress, etc.),
 * guardado localmente em backups/ e, se BLOB_READ_WRITE_TOKEN estiver definido,
 * também no Vercel Blob (armazenamento duradouro e partilhado com a produção,
 * já que local e Vercel usam a MESMA base de dados).
 *
 * Executar:  npm run db:backup
 */
async function main() {
  console.log("A ligar à base de dados e a criar backup...");
  const manifest = await createBackup({ trigger: "manual" });

  console.log(`\n✔ Backup "${manifest.id}" criado com sucesso.`);
  console.log(`  Base de dados: ${manifest.dbName}`);
  console.log(`  Tamanho: ${(manifest.sizeBytes / 1024).toFixed(1)} KB`);
  console.log("  Coleções:");
  for (const [name, count] of Object.entries(manifest.collections)) {
    console.log(`    - ${name}: ${count} documentos`);
  }

  await pruneOldBackups(30);
  console.log("\nBackups antigos (além dos 30 mais recentes) foram removidos.");
}

// Não força process.exit(0) no sucesso: numa saída abrupta no Windows, handles
// nativos ainda a fechar (ligação Mongo/fetch do upload ao Blob) podem despoletar
// um assertion crash no libuv. Deixamos o processo terminar sozinho quando o
// event loop ficar vazio; só forçamos saída (código 1) em caso de erro real.
main().catch((err) => {
  console.error("\n✘ Falha ao criar backup:", err.message);
  process.exit(1);
});
