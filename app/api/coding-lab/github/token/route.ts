import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { encryptSecret } from "@/lib/crypto";
import { logAuditEvent } from "@/lib/audit";

// GET — Indica apenas SE o utilizador já tem um Personal Access Token do GitHub guardado
// (nunca devolve o valor — só é usado internamente, encriptado, para criar Gists).
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const record = await db.collection("user_integrations").findOne({ tenant_id: tenantId, userId, provider: "github" });

    return NextResponse.json({ success: true, configured: !!record });
  } catch (error: any) {
    console.error("Erro ao ler o estado do token GitHub:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Guarda (ou substitui) o Personal Access Token do GitHub do utilizador, encriptado
// (AES-256-GCM, a mesma cifra já usada para as chaves de API da OpenAI por tenant).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { token } = await req.json();
    if (!token?.trim() || !token.trim().startsWith("ghp_") && !token.trim().startsWith("github_pat_")) {
      return NextResponse.json({ error: "Introduza um Personal Access Token do GitHub válido (começa por 'ghp_' ou 'github_pat_')." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    await db.collection("user_integrations").updateOne(
      { tenant_id: tenantId, userId, provider: "github" },
      { $set: { tokenEncrypted: encryptSecret(token.trim()), updatedAt: new Date() } },
      { upsert: true }
    );

    await logAuditEvent(userId, "GITHUB_TOKEN_SAVED", { tenantId });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao guardar o token GitHub:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — Remove o token guardado.
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }
    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    await db.collection("user_integrations").deleteOne({ tenant_id: tenantId, userId, provider: "github" });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
