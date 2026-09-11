import { currentUser } from "@clerk/nextjs/server";
import { getDb } from "./mongodb";

export const USERS_COLLECTION = "users";

export interface UserTenantMembership {
  tenantId: string;
  roles: string[];
}

export interface UserRecord {
  _id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  tenants?: UserTenantMembership[];
  globalAdmin?: boolean;
  nameSyncedAt?: Date;
  [key: string]: unknown;
}

/**
 * A coleção `users` é, por desenho, global: os documentos não têm `tenant_id` e por isso
 * não passam pelos helpers *TenantScoped de lib/mongodb.ts, que filtram exatamente por
 * esse campo — filtrá-los assim não devolveria nada. A identidade de uma pessoa atravessa
 * empresas (o mesmo utilizador pode ser ALUNO no tenant "root" e GESTOR_EMPRESA em duas
 * empresas) e o âmbito multi-tenant vive no array `tenants` de cada documento.
 *
 * Centralizar aqui a leitura evita que cada página vá à coleção por sua conta e tenha de
 * redescobrir esta exceção — e dá um único sítio onde mudar se o modelo evoluir.
 */
export async function getUserRecord(userId: string): Promise<UserRecord | null> {
  const db = await getDb();
  return db.collection(USERS_COLLECTION).findOne({ _id: userId });
}

/**
 * Nome a mostrar na interface. O fallback existe porque um registo pode não ter nome
 * nenhum (conta criada no Clerk sem nome preenchido), e "undefined undefined" no ecrã
 * é pior do que um genérico honesto.
 */
export function formatUserName(record: UserRecord | null, fallback = "Aluno"): string {
  const name = `${record?.firstName || ""} ${record?.lastName || ""}`.trim();
  return name || fallback;
}

/**
 * Quem manda no nome é o Clerk — é lá que o utilizador o edita. Sem isto, o nome era
 * copiado uma única vez, na criação do registo, e qualquer divergência posterior ficava
 * congelada na base de dados sem forma de se corrigir pela aplicação.
 *
 * A consulta ao Clerk é um pedido à API deles, por isso é limitada a uma vez por dia e
 * por utilizador (`nameSyncedAt`): o nome de uma pessoa não muda ao ponto de justificar
 * um pedido em cada carregamento de página.
 */
const NAME_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function syncUserNameFromClerk(record: UserRecord): Promise<UserRecord> {
  const lastSync = record.nameSyncedAt ? new Date(record.nameSyncedAt).getTime() : 0;
  if (Date.now() - lastSync < NAME_SYNC_INTERVAL_MS) return record;

  let clerkFirstName: string | undefined;
  let clerkLastName: string | undefined;
  try {
    const clerkUser = await currentUser();
    clerkFirstName = clerkUser?.firstName?.trim() || undefined;
    clerkLastName = clerkUser?.lastName?.trim() || undefined;
  } catch (error) {
    // Um problema de rede com o Clerk não pode derrubar a sessão: fica o nome já gravado.
    console.error("Falha ao sincronizar o nome com o Clerk:", error);
    return record;
  }

  const patch: Record<string, unknown> = { nameSyncedAt: new Date() };
  // Um perfil do Clerk sem nome preenchido não corrige nada — sobrescrever com vazio
  // deixaria o utilizador sem nome nenhum na interface.
  if (clerkFirstName && clerkFirstName !== record.firstName) patch.firstName = clerkFirstName;
  if (clerkLastName && clerkLastName !== record.lastName) patch.lastName = clerkLastName;
  if (patch.firstName || patch.lastName) patch.updatedAt = new Date();

  const db = await getDb();
  await db.collection(USERS_COLLECTION).updateOne({ _id: record._id }, { $set: patch });

  return { ...record, ...patch } as UserRecord;
}
