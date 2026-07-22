import { MongoClient } from "mongodb";
import { EJSON } from "bson";
import { put, list, del, get } from "@vercel/blob";
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import path from "node:path";

async function streamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}

/**
 * Backup/restore da base de dados partilhada (mozai_ai_edu_platform), usada tanto
 * em desenvolvimento local como em produção (Vercel) — é a MESMA base de dados,
 * por isso um backup cobre sempre os dois ambientes.
 *
 * Formato: um único ficheiro EJSON por backup (preserva ObjectId/Date sem perdas),
 * guardado localmente em `backups/` (gitignored) e, se BLOB_READ_WRITE_TOKEN existir,
 * também no Vercel Blob (armazenamento privado) como cópia duradoura/partilhada.
 */

const BLOB_PREFIX = "db-backups/";
export const LOCAL_BACKUP_DIR = path.resolve(process.cwd(), "backups");

export interface BackupManifest {
  id: string;
  createdAt: string;
  dbName: string;
  collections: Record<string, number>;
  sizeBytes: number;
  trigger: "manual" | "cron" | "pre-restore-safety";
}

async function connectDirect(): Promise<{ client: MongoClient; dbName: string }> {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  if (!uri || !dbName) {
    throw new Error("MONGODB_URI/MONGODB_DB não configurados — não é possível fazer backup/restore.");
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  // Confirma que é uma ligação REAL (getDb() da app cai silenciosamente para um mock
  // offline; aqui isso seria catastrófico — um backup "vazio" a substituir um bom).
  await client.db(dbName).command({ ping: 1 });
  return { client, dbName };
}

function blobEnabled(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/**
 * Cria um novo backup completo de todas as coleções da base de dados.
 */
export async function createBackup(opts: {
  trigger: BackupManifest["trigger"];
  saveLocal?: boolean;
  saveBlob?: boolean;
}): Promise<BackupManifest> {
  const { client, dbName } = await connectDirect();
  try {
    const db = client.db(dbName);
    const collectionInfos = await db.listCollections().toArray();

    const data: Record<string, any[]> = {};
    const counts: Record<string, number> = {};
    for (const { name } of collectionInfos) {
      if (name.startsWith("system.")) continue;
      const docs = await db.collection(name).find({}).toArray();
      data[name] = docs;
      counts[name] = docs.length;
    }

    const id = new Date().toISOString().replace(/[:.]/g, "-");
    const dataPayload = EJSON.stringify(data, undefined, 0, { relaxed: false });
    const manifest: BackupManifest = {
      id,
      createdAt: new Date().toISOString(),
      dbName,
      collections: counts,
      sizeBytes: Buffer.byteLength(dataPayload, "utf8"),
      trigger: opts.trigger,
    };

    const finalPayload = EJSON.stringify({ manifest, data }, undefined, 0, { relaxed: false });

    // No Vercel o sistema de ficheiros do projeto é só de leitura (exceto /tmp,
    // que é efémero) — não faz sentido escrever localmente nesse ambiente.
    const runningOnVercel = !!process.env.VERCEL;
    const saveLocal = opts.saveLocal ?? !runningOnVercel;
    const saveBlob = (opts.saveBlob ?? true) && blobEnabled();

    if (saveLocal) {
      await mkdir(LOCAL_BACKUP_DIR, { recursive: true });
      await writeFile(path.join(LOCAL_BACKUP_DIR, `${id}.json`), finalPayload, "utf8");
    }

    if (saveBlob) {
      // Guardado em dois objetos: o manifesto (pequeno) permite listar backups sem
      // ter de transferir o dump completo de cada um; os dados só são pedidos
      // quando um backup específico é efetivamente restaurado.
      await put(`${BLOB_PREFIX}${id}.manifest.json`, JSON.stringify(manifest), {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
      });
      await put(`${BLOB_PREFIX}${id}.data.json`, dataPayload, {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
      });
    }

    return manifest;
  } finally {
    await client.close();
  }
}

/**
 * Lista os backups disponíveis no Vercel Blob (fonte de verdade partilhada/duradoura).
 */
export async function listBlobBackups(): Promise<BackupManifest[]> {
  if (!blobEnabled()) return [];
  const { blobs } = await list({ prefix: BLOB_PREFIX });
  const manifestBlobs = blobs
    .filter((b) => b.pathname.endsWith(".manifest.json"))
    .sort((a, b) => (a.pathname < b.pathname ? 1 : -1));

  const manifests: BackupManifest[] = [];
  for (const blob of manifestBlobs) {
    try {
      const result = await get(blob.pathname, { access: "private" });
      if (!result?.stream) continue;
      const text = await streamToText(result.stream);
      manifests.push(JSON.parse(text) as BackupManifest);
    } catch (e) {
      console.warn("Manifesto de backup ilegível ignorado:", blob.pathname, e);
    }
  }
  return manifests;
}

/**
 * Lista os backups guardados localmente (pasta backups/).
 */
export async function listLocalBackups(): Promise<BackupManifest[]> {
  try {
    const files = await readdir(LOCAL_BACKUP_DIR);
    const manifests: BackupManifest[] = [];
    for (const file of files.filter((f) => f.endsWith(".json")).sort().reverse()) {
      try {
        const raw = await readFile(path.join(LOCAL_BACKUP_DIR, file), "utf8");
        const parsed = EJSON.parse(raw) as { manifest: BackupManifest };
        manifests.push(parsed.manifest);
      } catch (e) {
        console.warn("Backup local ilegível ignorado:", file, e);
      }
    }
    return manifests;
  } catch {
    return [];
  }
}

async function loadBackupPayload(id: string): Promise<{ manifest: BackupManifest; data: Record<string, any[]> }> {
  // Tenta local primeiro (mais rápido), depois Blob.
  try {
    const raw = await readFile(path.join(LOCAL_BACKUP_DIR, `${id}.json`), "utf8");
    return EJSON.parse(raw) as any;
  } catch {
    // ignora, tenta Blob
  }

  if (blobEnabled()) {
    const [manifestResult, dataResult] = await Promise.all([
      get(`${BLOB_PREFIX}${id}.manifest.json`, { access: "private" }).catch(() => null),
      get(`${BLOB_PREFIX}${id}.data.json`, { access: "private" }).catch(() => null),
    ]);
    if (manifestResult?.stream && dataResult?.stream) {
      const [manifestText, dataText] = await Promise.all([
        streamToText(manifestResult.stream),
        streamToText(dataResult.stream),
      ]);
      return {
        manifest: JSON.parse(manifestText) as BackupManifest,
        data: EJSON.parse(dataText) as Record<string, any[]>,
      };
    }
  }

  throw new Error(`Backup "${id}" não encontrado (nem localmente, nem no Blob).`);
}

/**
 * Restaura um backup: substitui o conteúdo atual de cada coleção presente no backup
 * pelo conteúdo guardado nesse momento. Cria SEMPRE um backup de segurança do estado
 * atual antes de mexer em qualquer coisa, para que a restauração seja reversível.
 */
export async function restoreBackup(id: string): Promise<{
  safetyBackupId: string;
  restoredCollections: Record<string, number>;
}> {
  const { data } = await loadBackupPayload(id);

  // Salvaguarda: nunca restaurar sem primeiro guardar o estado atual.
  const safety = await createBackup({ trigger: "pre-restore-safety" });

  const { client, dbName } = await connectDirect();
  try {
    const db = client.db(dbName);
    const restoredCollections: Record<string, number> = {};

    for (const [collectionName, docs] of Object.entries(data)) {
      const col = db.collection(collectionName);
      await col.deleteMany({});
      if (docs.length > 0) {
        await col.insertMany(docs, { ordered: false });
      }
      restoredCollections[collectionName] = docs.length;
    }

    return { safetyBackupId: safety.id, restoredCollections };
  } finally {
    await client.close();
  }
}

/**
 * Apaga backups antigos, mantendo apenas os `keep` mais recentes (local e Blob).
 */
export async function pruneOldBackups(keep = 30): Promise<void> {
  if (blobEnabled()) {
    const { blobs } = await list({ prefix: BLOB_PREFIX });
    // Cada backup ocupa 2 objetos (.manifest.json + .data.json) — agrupar por
    // id de backup antes de decidir quais manter, para nunca cortar um par ao meio.
    const byId = new Map<string, string[]>();
    for (const b of blobs) {
      const id = b.pathname.replace(BLOB_PREFIX, "").replace(/\.(manifest|data)\.json$/, "");
      const urls = byId.get(id) || [];
      urls.push(b.url);
      byId.set(id, urls);
    }
    const idsNewestFirst = [...byId.keys()].sort((a, b) => (a < b ? 1 : -1));
    const idsToDelete = idsNewestFirst.slice(keep);
    const toDelete = idsToDelete.flatMap((id) => byId.get(id) || []);
    if (toDelete.length > 0) await del(toDelete);
  }

  try {
    const files = (await readdir(LOCAL_BACKUP_DIR)).filter((f) => f.endsWith(".json")).sort().reverse();
    const toDelete = files.slice(keep);
    const { unlink } = await import("node:fs/promises");
    for (const f of toDelete) {
      await unlink(path.join(LOCAL_BACKUP_DIR, f)).catch(() => {});
    }
  } catch {
    // pasta local pode não existir ainda
  }
}
