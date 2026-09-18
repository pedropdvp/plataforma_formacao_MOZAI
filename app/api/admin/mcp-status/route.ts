import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { findTenantScoped, insertTenantScoped, updateTenantScoped } from "@/lib/mongodb";
import { parseReport } from "@/lib/mcp-status";
import { canActiveRoleOpen, getTenantId } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Estado dos servidores MCP das máquinas de quem desenvolve.
 *
 * POST — recebe o relatório do `npm run mcp:check`. Não tem sessão nem a pode ter: quem o envia
 * é um script no terminal, não um browser. A autenticação é a chave MCP_STATUS_TOKEN, comparada
 * em tempo constante. Sem a chave configurada no servidor, a rota responde 503 em vez de aceitar
 * seja o que for.
 *
 * O corpo passa por parseReport (lib/mcp-status.ts), que o reduz aos campos conhecidos: o
 * ficheiro de onde o relatório nasce guarda tokens, e nada além de nome, estado e mensagem
 * limpa entra na base de dados.
 *
 * GET — serve a página /dashboard/admin/mcps e exige o mesmo perfil que a abre.
 */

const TOKEN_HEADER = "x-mcp-status-token";
const COLECAO = "mcp_status";

function tokenValido(recebido: string | null, esperado: string): boolean {
  if (!recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const esperado = process.env.MCP_STATUS_TOKEN;
  if (!esperado || esperado.length < 16) {
    console.error("Relatório de MCP recusado: MCP_STATUS_TOKEN não está configurada.");
    return NextResponse.json({ error: "Recolha de estado dos MCP não configurada." }, { status: 503 });
  }

  if (!tokenValido(req.headers.get(TOKEN_HEADER), esperado)) {
    return NextResponse.json({ error: "Chave inválida." }, { status: 401 });
  }

  const corpo = await req.json().catch(() => null);
  const resultado = parseReport(corpo);
  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: 400 });
  }

  try {
    // Sem sessão, getTenantId devolve o tenant pedido — e um script não manda cookie nenhuma,
    // por isso o relatório fica na raiz, que é onde a plataforma se administra a si própria.
    const tenantId = await getTenantId();
    const { report } = resultado;
    const documento = { host: report.host, checkedAt: report.checkedAt, servers: report.servers, receivedAt: new Date().toISOString() };

    const atualizacao = await updateTenantScoped(COLECAO, tenantId, { host: report.host }, { $set: documento });
    if (atualizacao.matchedCount === 0) await insertTenantScoped(COLECAO, tenantId, documento);

    return NextResponse.json({ success: true, servers: report.servers.length });
  } catch (error: any) {
    console.error("Erro ao guardar o estado dos MCP:", error?.message);
    return NextResponse.json({ error: "Não foi possível guardar o relatório." }, { status: 500 });
  }
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }
  if (!(await canActiveRoleOpen("/dashboard/admin/mcps"))) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  try {
    const tenantId = await getTenantId();
    const relatorios = await findTenantScoped(COLECAO, tenantId);
    return NextResponse.json({
      success: true,
      configured: Boolean(process.env.MCP_STATUS_TOKEN),
      reports: relatorios
        .map((r: any) => ({ host: r.host, checkedAt: r.checkedAt, receivedAt: r.receivedAt, servers: r.servers ?? [] }))
        .sort((a: any, b: any) => String(b.checkedAt).localeCompare(String(a.checkedAt))),
    });
  } catch (error: any) {
    console.error("Erro ao ler o estado dos MCP:", error?.message);
    return NextResponse.json({ error: "Não foi possível ler os relatórios." }, { status: 500 });
  }
}
