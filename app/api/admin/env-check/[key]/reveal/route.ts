import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEventStrict } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Revela o valor completo de **uma** variável de ambiente, via API da Vercel.
 *
 * O princípio é o dos cofres de senhas: o valor nunca vem com a listagem. É sempre um
 * pedido à parte, por variável, deliberado e registado.
 *
 * `POST` e não `GET` de propósito. Um `GET` fica no histórico do browser, em registos de
 * proxy e pode ser disparado por um link que alguém clique sem saber o que faz.
 *
 * O que isto **não** protege: um ADMIN comprometido continua a poder ver os segredos —
 * é inerente ao que foi pedido. O que se ganha é a resposta a "quem viu o quê, e quando",
 * e que essa resposta exista depois de um incidente.
 */

/** Segundos entre revelações do mesmo utilizador. Uma varredura de segredos deixa de ser
 *  um script de dez segundos. */
const INTERVALO_MINIMO_S = 60;

interface VercelEnvVar {
  id: string;
  key: string;
  value?: string;
  target?: string[];
  type?: string;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (activeRole !== "ADMIN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const token = process.env.VERCEL_API_TOKEN;
    const projectId = process.env.VERCEL_PROJECT_ID;
    if (!token || !projectId) {
      return NextResponse.json(
        {
          error:
            "A revelação de valores não está configurada. Defina VERCEL_API_TOKEN e VERCEL_PROJECT_ID para a activar.",
        },
        { status: 503 }
      );
    }

    const { key } = await params;
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
      return NextResponse.json({ error: "Nome de variável inválido." }, { status: 400 });
    }

    // --- Limite de ritmo, contado na própria auditoria ---
    const db = await getDb();
    const recente = await db.collection("audit_logs").findOne(
      {
        userId,
        action: "ENV_VAR_REVEALED",
        timestamp: { $gt: new Date(Date.now() - INTERVALO_MINIMO_S * 1000) },
      },
      { sort: { timestamp: -1 } }
    );
    if (recente) {
      return NextResponse.json(
        { error: `Só é possível revelar uma variável por minuto. Tente novamente dentro de instantes.` },
        { status: 429 }
      );
    }

    // --- Auditoria ANTES de revelar ---
    // Se o registo falhar, não se revela. Um segredo mostrado sem rasto é pior do que um
    // segredo não mostrado: quem tiver de auditar um incidente não terá por onde começar.
    try {
      await logAuditEventStrict(userId, "ENV_VAR_REVEALED", {
        key,
        description: `Valor da variável de ambiente ${key} revelado no painel`,
      });
    } catch (error) {
      console.error("[env-check] auditoria falhou — revelação recusada:", error);
      return NextResponse.json(
        { error: "Não foi possível registar a auditoria. Por segurança, o valor não foi revelado." },
        { status: 500 }
      );
    }

    const teamId = process.env.VERCEL_TEAM_ID;
    const sufixo = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";

    const listaRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env${sufixo}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!listaRes.ok) {
      return NextResponse.json(
        { error: "A API da Vercel recusou o pedido. Verifique o VERCEL_API_TOKEN e as suas permissões." },
        { status: 502 }
      );
    }

    const lista = (await listaRes.json()) as { envs?: VercelEnvVar[] };
    const alvo = (lista.envs || []).find((e) => e.key === key);
    if (!alvo) {
      return NextResponse.json({ error: "Variável não encontrada no projecto da Vercel." }, { status: 404 });
    }

    // O valor decifrado só vem no pedido a uma variável concreta.
    const detalheRes = await fetch(
      `https://api.vercel.com/v9/projects/${projectId}/env/${alvo.id}${sufixo}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!detalheRes.ok) {
      return NextResponse.json({ error: "Não foi possível obter o valor da variável." }, { status: 502 });
    }

    const detalhe = (await detalheRes.json()) as VercelEnvVar;
    if (typeof detalhe.value !== "string") {
      return NextResponse.json(
        { error: "A Vercel não devolveu o valor — o token pode não ter permissão para o decifrar." },
        { status: 502 }
      );
    }

    // O valor nunca é escrito em log nem entra na auditoria; e não pode ficar em cache
    // de intermediários nem do Next.
    return NextResponse.json(
      { success: true, key, value: detalhe.value, target: alvo.target || [] },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" } }
    );
  } catch (error) {
    console.error("[env-check] falha ao revelar variável:", error);
    return NextResponse.json({ error: "Erro ao revelar a variável." }, { status: 500 });
  }
}
