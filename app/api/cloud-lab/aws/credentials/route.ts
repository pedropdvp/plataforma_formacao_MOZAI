import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { logAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 15;

// GET — Estado real da ligação AWS: se configurada, confirma as credenciais com uma chamada
// STS GetCallerIdentity real (a forma padrão de "testar" credenciais AWS sem side-effects) e
// devolve a identidade real da conta — nunca inventa um estado "ligado".
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const record = await db.collection("user_integrations").findOne({ tenant_id: tenantId, userId, provider: "aws" });

    if (!record) {
      return NextResponse.json({ success: true, configured: false });
    }

    const accessKeyId = decryptSecret(record.accessKeyIdEncrypted);
    const secretAccessKey = decryptSecret(record.secretAccessKeyEncrypted);
    const region = record.region || "us-east-1";

    const sts = new STSClient({ region, credentials: { accessKeyId, secretAccessKey } });
    try {
      const identity = await sts.send(new GetCallerIdentityCommand({}));
      return NextResponse.json({ success: true, configured: true, valid: true, account: identity.Account, arn: identity.Arn, region });
    } catch (err: any) {
      return NextResponse.json({ success: true, configured: true, valid: false, error: err.message, region });
    }
  } catch (error: any) {
    console.error("Erro ao ler ligação AWS:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Guarda as credenciais AWS do utilizador (Access Key ID + Secret Access Key),
// encriptadas (AES-256-GCM). Recomenda-se explicitamente um utilizador IAM só de leitura.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { accessKeyId, secretAccessKey, region } = await req.json();
    if (!accessKeyId?.trim() || !secretAccessKey?.trim()) {
      return NextResponse.json({ error: "Access Key ID e Secret Access Key são obrigatórios." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    await db.collection("user_integrations").updateOne(
      { tenant_id: tenantId, userId, provider: "aws" },
      {
        $set: {
          accessKeyIdEncrypted: encryptSecret(accessKeyId.trim()),
          secretAccessKeyEncrypted: encryptSecret(secretAccessKey.trim()),
          region: region?.trim() || "us-east-1",
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    await logAuditEvent(userId, "CLOUD_LAB_AWS_CREDENTIALS_SAVED", { tenantId });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao guardar credenciais AWS:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — Remove as credenciais AWS guardadas.
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }
    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    await db.collection("user_integrations").deleteOne({ tenant_id: tenantId, userId, provider: "aws" });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
