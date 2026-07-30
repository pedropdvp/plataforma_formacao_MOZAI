import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { decryptSecret } from "@/lib/crypto";
import { logAuditEvent } from "@/lib/audit";

// POST — Cria um Gist REAL na conta de GitHub do utilizador (chamada genuína à API do GitHub,
// com o Personal Access Token que ele próprio configurou) a partir do código do Coding Lab.
// Nunca simula a criação — se a API do GitHub falhar, o erro real é devolvido.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { filename, code, description, isPublic } = await req.json();
    if (!filename?.trim() || !code?.trim()) {
      return NextResponse.json({ error: "Nome do ficheiro e código são obrigatórios." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const integration = await db.collection("user_integrations").findOne({ tenant_id: tenantId, userId, provider: "github" });
    if (!integration) {
      return NextResponse.json({ error: "Configure primeiro o seu Personal Access Token do GitHub." }, { status: 400 });
    }

    const token = decryptSecret(integration.tokenEncrypted);

    const res = await fetch("https://api.github.com/gists", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        description: description?.trim() || "Criado a partir do MOZAI Coding Lab",
        public: !!isPublic,
        files: { [filename.trim()]: { content: code } },
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: `GitHub devolveu erro (HTTP ${res.status}): ${errBody.message || "verifique se o token tem o âmbito 'gist'."}` },
        { status: 502 }
      );
    }

    const gist = await res.json();

    await logAuditEvent(userId, "CODING_LAB_GIST_CREATED", { tenantId, gistUrl: gist.html_url });

    return NextResponse.json({ success: true, gistUrl: gist.html_url });
  } catch (error: any) {
    console.error("Erro ao criar Gist no GitHub:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
