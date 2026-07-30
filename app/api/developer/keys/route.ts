import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { generateApiKey, hashApiKey } from "@/lib/developer-keys";
import { logAuditEvent } from "@/lib/audit";

// GET — Lista as chaves de API do utilizador autenticado (nunca o valor completo, só o prefixo).
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const keys = await db
      .collection("developer_api_keys")
      .find({ tenant_id: tenantId, userId })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      keys: keys.map((k: any) => ({
        id: k._id.toString(),
        name: k.name,
        prefix: k.prefix,
        revoked: !!k.revoked,
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt,
      })),
    });
  } catch (error: any) {
    console.error("Erro ao listar chaves de developer:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Gera uma nova chave de API real. O valor completo só é devolvido nesta resposta —
// a partir daqui, só o hash (SHA-256) é guardado, nunca o texto simples.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { name } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Dê um nome à chave (ex: 'Integração Zapier')." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const activeCount = await db.collection("developer_api_keys").countDocuments({ tenant_id: tenantId, userId, revoked: { $ne: true } });
    if (activeCount >= 10) {
      return NextResponse.json({ error: "Limite de 10 chaves ativas atingido. Revogue uma chave antiga primeiro." }, { status: 400 });
    }

    const { plaintext, prefix } = generateApiKey();
    const keyHash = hashApiKey(plaintext);

    const result = await db.collection("developer_api_keys").insertOne({
      tenant_id: tenantId,
      userId,
      name: name.trim(),
      keyHash,
      prefix,
      revoked: false,
      createdAt: new Date(),
      lastUsedAt: null,
    });

    await logAuditEvent(userId, "DEVELOPER_API_KEY_CREATED", { tenantId, keyId: result.insertedId?.toString(), name: name.trim() });

    return NextResponse.json({ success: true, keyId: result.insertedId?.toString(), apiKey: plaintext, prefix });
  } catch (error: any) {
    console.error("Erro ao criar chave de developer:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
