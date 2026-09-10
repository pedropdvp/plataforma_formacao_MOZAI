import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { inspectEnv, parseEnvExampleKeys } from "@/lib/env-check";
import { logAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Diagnóstico das variáveis de ambiente do ambiente em execução.
 *
 * Devolve **estado, máscara e avisos** — nunca valores completos de segredos. Os valores
 * completos são pedidos um a um em `env-check/[key]/reveal`, que regista quem revelou o quê.
 *
 * Restrito a `ADMIN`, e não também a `SUPORTE`: saber que variáveis existem e como estão
 * preenchidas é informação de infraestrutura, e o suporte técnico não precisa dela para
 * fazer o seu trabalho.
 */

/** Rede de segurança para o caso de o `.env.example` não chegar ao bundle serverless.
 *  Não é a lista canónica — é o mínimo para a página não abrir vazia. */
const CATALOGO_MINIMO = [
  "MONGODB_URI",
  "MONGODB_DB",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_BASE_DOMAIN",
  "OPENAI_API_KEY",
  "BLOB_READ_WRITE_TOKEN",
  "CRON_SECRET",
  "SECRETS_ENCRYPTION_KEY",
];

async function lerCatalogo(): Promise<{ keys: string[]; origem: string }> {
  try {
    const conteudo = await readFile(join(process.cwd(), ".env.example"), "utf8");
    const keys = parseEnvExampleKeys(conteudo);
    if (keys.length) return { keys, origem: ".env.example" };
  } catch {
    // Ficheiro ausente do bundle — cai na lista mínima abaixo.
  }
  return { keys: CATALOGO_MINIMO, origem: "lista mínima embutida" };
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (activeRole !== "ADMIN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { keys, origem } = await lerCatalogo();
    const variaveis = inspectEnv(keys);

    // Consultar a listagem não revela segredos, mas continua a ser um acto de
    // administração de infraestrutura e fica registado.
    await logAuditEvent(userId, "ENV_CHECK_VIEWED", { count: variaveis.length });

    return NextResponse.json(
      {
        success: true,
        variaveis,
        origem,
        ambiente: process.env.VERCEL_ENV || process.env.NODE_ENV || "desconhecido",
        // Sem token da Vercel não há como revelar valores — a interface esconde o botão
        // em vez de o oferecer e falhar.
        revelacaoDisponivel: Boolean(process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[env-check] falha ao inspecionar variáveis:", error);
    return NextResponse.json({ error: "Erro ao inspecionar as variáveis." }, { status: 500 });
  }
}
