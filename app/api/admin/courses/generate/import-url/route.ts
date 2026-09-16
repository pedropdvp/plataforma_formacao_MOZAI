import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ingestExtractedPages } from "@/lib/ai/ingest";
import { getTenantId, canActiveRoleOpen } from "@/lib/session";
import { fetchPublicUrl } from "@/lib/safe-fetch";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST — Importa o conteúdo principal de uma página web (artigo/documentação) como material de curso.
// Usa jsdom + Readability (o mesmo motor do "Modo de Leitura" do Firefox) para extrair só o texto
// relevante, sem menus, rodapés ou anúncios.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }
    if (!(await canActiveRoleOpen("/dashboard/admin/content-factory"))) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const tenantId = await getTenantId();
    const body = await req.json();
    const { url, briefingId: rawBriefingId } = body;
    const briefingId = rawBriefingId || Math.random().toString(36).substring(7);

    // O endereço vem de quem cria o curso: sem validação, a plataforma faria pedidos à rede
    // interna por conta de terceiros (SSRF). Ver lib/safe-fetch.ts.
    const attempt = await fetchPublicUrl((url || "").trim(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MozAIBot/1.0; +https://plataforma-formacao-mozai.vercel.app)" },
      signal: AbortSignal.timeout(20000),
    });
    if (!attempt.ok) {
      return NextResponse.json({ error: attempt.reason }, { status: 400 });
    }

    let html: string;
    try {
      const res = attempt.response;
      if (!res.ok) {
        return NextResponse.json({ error: `Não foi possível aceder ao URL (HTTP ${res.status}).` }, { status: 400 });
      }
      html = await res.text();
    } catch {
      return NextResponse.json({ error: "Não foi possível ler o conteúdo deste endereço." }, { status: 400 });
    }

    const { JSDOM } = await import("jsdom");
    const { Readability } = await import("@mozilla/readability");

    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();

    if (!article || !article.textContent || !article.textContent.trim()) {
      return NextResponse.json({ error: "Não foi possível extrair conteúdo legível desta página." }, { status: 400 });
    }

    const sourceName = article.title || new URL(url).hostname;
    const result = await ingestExtractedPages(
      [{ text: article.textContent.trim(), images: [] }],
      { briefingId, tenantId, sourceName }
    );

    return NextResponse.json({
      success: true,
      briefingId,
      sourceName,
      sourceId: result.sourceId,
      chunksCount: result.chunksCount,
      imagesCount: result.imagesCount,
    });
  } catch (error: any) {
    console.error("Erro ao importar URL:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
