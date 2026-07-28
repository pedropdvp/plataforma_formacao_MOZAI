import { getDb } from "@/lib/mongodb";

/** Saldo inicial oferecido a um utilizador que ainda não tem registo de créditos IA. */
const DEFAULT_STARTING_CREDITS = 150;

interface AiCreditsDoc {
  tenant_id: string;
  userId: string;
  balance: number;
  updatedAt: Date;
}

/** Garante que existe um documento de créditos para este utilizador, criando-o com o saldo inicial se necessário. */
async function ensureAccount(tenantId: string, userId: string): Promise<AiCreditsDoc> {
  const db = await getDb();
  const existing = await db.collection("ai_credits").findOne({ tenant_id: tenantId, userId });
  if (existing) return existing as AiCreditsDoc;

  const doc: AiCreditsDoc = {
    tenant_id: tenantId,
    userId,
    balance: DEFAULT_STARTING_CREDITS,
    updatedAt: new Date(),
  };
  await db.collection("ai_credits").insertOne(doc);
  return doc;
}

export async function getCreditBalance(tenantId: string, userId: string): Promise<number> {
  const account = await ensureAccount(tenantId, userId);
  return account.balance;
}

/** Recarrega o saldo (simulação de compra — sem gateway de pagamento real). Devolve o novo saldo. */
export async function addCredits(tenantId: string, userId: string, amount: number): Promise<number> {
  await ensureAccount(tenantId, userId);
  const db = await getDb();
  const result = await db.collection("ai_credits").findOneAndUpdate(
    { tenant_id: tenantId, userId },
    { $inc: { balance: amount }, $set: { updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  return result?.balance ?? result?.value?.balance ?? 0;
}

/**
 * Debita créditos do saldo real, de forma atómica: só desconta se o saldo for suficiente.
 * Devolve o novo saldo em caso de sucesso, ou `null` se o saldo for insuficiente.
 */
export async function debitCredits(tenantId: string, userId: string, amount = 1): Promise<number | null> {
  await ensureAccount(tenantId, userId);
  const db = await getDb();
  const result = await db.collection("ai_credits").findOneAndUpdate(
    { tenant_id: tenantId, userId, balance: { $gte: amount } },
    { $inc: { balance: -amount }, $set: { updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  const updated = result?.balance !== undefined ? result : result?.value;
  return updated ? updated.balance : null;
}
