import { getDb } from "@/lib/mongodb";

export interface ForumEntry {
  id: string;
  title: string;
  category: string;
  threadsCount: number;
}

/** Fóruns de exemplo mostrados enquanto a empresa não tiver nenhum fórum criado. */
const DEFAULT_FORUMS: Omit<ForumEntry, "id">[] = [
  { title: "Engenharia de IA e RAG Avançado", category: "Inteligência Artificial", threadsCount: 24 },
  { title: "Next.js 16 e Arquiteturas Composable SaaS", category: "Programação / Frontend", threadsCount: 15 },
  { title: "Prompt Engineering Essentials", category: "Inteligência Artificial", threadsCount: 8 },
];

export async function getForums(tenantId: string): Promise<ForumEntry[]> {
  const db = await getDb();
  const rows = await db
    .collection("forums")
    .find({ tenant_id: tenantId })
    .sort({ createdAt: 1 })
    .toArray();

  if (rows.length === 0) {
    return DEFAULT_FORUMS.map((f, i) => ({ id: `default-${i}`, ...f }));
  }

  return rows.map((r: any) => ({
    id: r._id.toString(),
    title: r.title,
    category: r.category,
    threadsCount: r.threadsCount || 0,
  }));
}

export async function createForum(tenantId: string, title: string, category: string): Promise<string> {
  const db = await getDb();
  const result = await db.collection("forums").insertOne({
    tenant_id: tenantId,
    title,
    category,
    threadsCount: 0,
    createdAt: new Date(),
  });
  return result.insertedId.toString();
}

/** Retorna false se o fórum não existir (ou não pertencer a este tenant) — inclui os defaults não persistidos. */
export async function deleteForum(tenantId: string, id: string): Promise<boolean> {
  if (id.startsWith("default-")) return false;
  const db = await getDb();
  const { ObjectId } = await import("mongodb");
  let objectId;
  try {
    objectId = new ObjectId(id);
  } catch {
    return false;
  }
  const result = await db.collection("forums").deleteOne({ _id: objectId, tenant_id: tenantId });
  return result.deletedCount > 0;
}
