import { MongoClient, Db, Document, Filter, OptionalId, UpdateFilter, WithId } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
const dbName = process.env.MONGODB_DB || "mozai_db";

// Falha rápido em vez de esperar o timeout padrão de 30s
const CONNECT_OPTIONS = { serverSelectionTimeoutMS: 8000 };
let client: MongoClient;
let clientPromise: Promise<MongoClient>;
let cachedDb: Db | null = null;

// Banco de dados em memória local simulado (Dev/Offline fallback)
const mockDatabaseCache: Record<string, any[]> = {};

class MockCollection {
  name: string;

  constructor(name: string) {
    this.name = name;
    if (!mockDatabaseCache[name]) {
      mockDatabaseCache[name] = [];
    }
  }

  find(filter: any = {}) {
    const items = mockDatabaseCache[this.name] || [];
    
    // Filtro básico de chaves
    const filtered = items.filter(item => {
      for (const key in filter) {
        if (key.startsWith("$")) continue; // Ignora filtros avançados globais
        const filterVal = filter[key];
        
        if (filterVal && typeof filterVal === "object") {
          if ("$in" in filterVal && Array.isArray(filterVal.$in)) {
            if (!filterVal.$in.includes(item[key])) return false;
          } else if ("$eq" in filterVal) {
            if (item[key] !== filterVal.$eq) return false;
          } else if ("$regex" in filterVal) {
            const pattern = filterVal.$regex instanceof RegExp ? filterVal.$regex : new RegExp(filterVal.$regex, "i");
            if (!pattern.test(item[key] || "")) return false;
          } else {
            if (item[key] !== filterVal) return false;
          }
        } else {
          if (item[key] !== filterVal) return false;
        }
      }
      return true;
    });

    return {
      limit: (num: number) => {
        const sliced = filtered.slice(0, num);
        return {
          toArray: async () => sliced
        };
      },
      toArray: async () => filtered
    };
  }

  async findOne(filter: any = {}) {
    const res = this.find(filter);
    const arr = await res.toArray();
    return arr[0] || null;
  }

  async insertOne(doc: any) {
    const newDoc = { _id: Math.random().toString(36).substring(7), ...doc };
    mockDatabaseCache[this.name] = mockDatabaseCache[this.name] || [];
    mockDatabaseCache[this.name].push(newDoc);
    return { acknowledged: true, insertedId: newDoc._id };
  }

  async insertMany(docs: any[]) {
    const insertedIds: Record<number, string> = {};
    mockDatabaseCache[this.name] = mockDatabaseCache[this.name] || [];
    
    docs.forEach((doc, idx) => {
      const id = Math.random().toString(36).substring(7);
      const newDoc = { _id: id, ...doc };
      mockDatabaseCache[this.name].push(newDoc);
      insertedIds[idx] = id;
    });

    return { acknowledged: true, insertedCount: docs.length, insertedIds };
  }

  async updateOne(filter: any, update: any) {
    const item = await this.findOne(filter);
    if (item) {
      const setFields = update.$set || update;
      Object.assign(item, setFields);
      return { acknowledged: true, modifiedCount: 1 };
    }
    return { acknowledged: true, modifiedCount: 0 };
  }

  async deleteOne(filter: any) {
    const items = mockDatabaseCache[this.name] || [];
    const index = items.findIndex(item => {
      for (const key in filter) {
        if (item[key] !== filter[key]) return false;
      }
      return true;
    });
    if (index > -1) {
      items.splice(index, 1);
      return { acknowledged: true, deletedCount: 1 };
    }
    return { acknowledged: true, deletedCount: 0 };
  }

  async deleteMany(filter: any = {}) {
    const items = mockDatabaseCache[this.name] || [];
    const remaining = items.filter(item => {
      for (const key in filter) {
        if (item[key] === filter[key]) return false;
      }
      return true;
    });
    const deletedCount = items.length - remaining.length;
    mockDatabaseCache[this.name] = remaining;
    return { acknowledged: true, deletedCount };
  }

  async aggregate(pipeline: any[]) {
    let items = mockDatabaseCache[this.name] || [];
    
    // 1. Procura por um estágio $match no pipeline para filtrar
    const matchStage = pipeline.find(stage => stage.$match);
    if (matchStage && matchStage.$match) {
      const filter = matchStage.$match;
      items = items.filter(item => {
        for (const key in filter) {
          if (item[key] !== filter[key]) return false;
        }
        return true;
      });
    }

    // 2. Procura por pré-filtros dentro do estágio $vectorSearch (Atlas Vector Search)
    const vsStage = pipeline.find(stage => stage.$vectorSearch);
    if (vsStage?. $vectorSearch?.filter) {
      const vsFilter = vsStage.$vectorSearch.filter;
      const conditions: Array<{ key: string; value: any }> = [];

      if (vsFilter.$and && Array.isArray(vsFilter.$and)) {
        vsFilter.$and.forEach((cond: any) => {
          Object.keys(cond).forEach(k => {
            const valObj = cond[k];
            const val = valObj && typeof valObj === "object" && "$eq" in valObj ? valObj.$eq : valObj;
            conditions.push({ key: k, value: val });
          });
        });
      } else {
        Object.keys(vsFilter).forEach(k => {
          const valObj = vsFilter[k];
          const val = valObj && typeof valObj === "object" && "$eq" in valObj ? valObj.$eq : valObj;
          conditions.push({ key: k, value: val });
        });
      }

      if (conditions.length > 0) {
        items = items.filter(item => {
          return conditions.every(cond => item[cond.key] === cond.value);
        });
      }
    }

    return {
      toArray: async () => items
    };
  }
}

class MockDb {
  collection(name: string) {
    return new MockCollection(name);
  }
}

if (process.env.NODE_ENV === "development") {
  // Evitar vazamento de conexões durante HMR
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, CONNECT_OPTIONS);
    globalWithMongo._mongoClientPromise = client.connect().catch(err => {
      console.error("⚠ MongoDB: falha na ligação inicial (tentará reconectar nas operações):", err.message);
      return client;
    });
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  client = new MongoClient(uri, CONNECT_OPTIONS);
  clientPromise = client.connect();
}

export default clientPromise;

/**
 * Retorna a instância do Banco de Dados MongoDB ou um MockDb se estiver offline.
 */
export async function getDb(dbOverride?: string): Promise<any> {
  // Reutiliza a ligação real já validada (sem re-ping em cada chamada)
  if (cachedDb && !dbOverride) return cachedDb;

  try {
    const conn = await clientPromise;
    const db = conn.db(dbOverride || dbName);
    // Confirma que a ligação está viva. Se falhar, cai no mock APENAS nesta chamada
    // (sem "trava" permanente — a próxima chamada volta a tentar o Atlas real).
    await db.command({ ping: 1 });
    if (!dbOverride) cachedDb = db;
    return db;
  } catch (error: any) {
    console.warn("⚠ MongoDB indisponível — a usar Mock Database (os dados NÃO persistem). Detalhe:", error?.message);
    return new MockDb();
  }
}

/**
 * ENFORCEMENT DE MULTI-TENANCY:
 * Métodos utilitários que forçam a filtragem pelo tenant_id
 */
export async function findTenantScoped<T extends Document>(
  collectionName: string,
  tenantId: string,
  filter: Filter<T> = {}
): Promise<any[]> {
  const db = await getDb();
  const scopedFilter = { ...filter, tenant_id: tenantId } as any;
  const cursor = await db.collection(collectionName).find(scopedFilter);
  return cursor.toArray();
}

export async function findOneTenantScoped<T extends Document>(
  collectionName: string,
  tenantId: string,
  filter: Filter<T> = {}
): Promise<any | null> {
  const db = await getDb();
  const scopedFilter = { ...filter, tenant_id: tenantId } as any;
  return db.collection(collectionName).findOne(scopedFilter);
}

export async function insertTenantScoped<T extends Document>(
  collectionName: string,
  tenantId: string,
  doc: any
) {
  const db = await getDb();
  const scopedDoc = { ...doc, tenant_id: tenantId } as any;
  return db.collection(collectionName).insertOne(scopedDoc);
}

export async function updateTenantScoped<T extends Document>(
  collectionName: string,
  tenantId: string,
  filter: Filter<T>,
  update: UpdateFilter<T> | Partial<T>
) {
  const db = await getDb();
  const scopedFilter = { ...filter, tenant_id: tenantId } as any;
  return db.collection(collectionName).updateOne(scopedFilter, update);
}

export async function deleteTenantScoped<T extends Document>(
  collectionName: string,
  tenantId: string,
  filter: Filter<T>
) {
  const db = await getDb();
  const scopedFilter = { ...filter, tenant_id: tenantId } as any;
  return db.collection(collectionName).deleteOne(scopedFilter);
}
