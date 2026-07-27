import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { extractPdfContent } from "@/lib/pdf-extract";
import { ingestExtractedPages } from "@/lib/ai/ingest";
import { getChatbotBriefingId, setChatbotDocument, clearChatbotDocument } from "@/lib/chatbot-documents";
import { logAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_ROLES = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA"];

/**
 * POST — Carrega (ou substitui) o PDF de conhecimento do ChatBot do tenant do chamador.
 * ADMIN/SUPORTE carregam sempre para "root" (âmbito plataforma); GESTOR_EMPRESA carrega
 * sempre para a SUA PRÓPRIA empresa (derivada do servidor via x-tenant-id, nunca do corpo
 * do pedido) — nunca podem carregar/substituir o PDF de outra empresa ou da plataforma.
 * Só um ficheiro por tenant: um novo upload substitui por completo o anterior (chunks
 * antigos são apagados antes de indexar os novos).
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    if (!activeRole || !ALLOWED_ROLES.includes(activeRole)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const isCompanyScoped = activeRole === "GESTOR_EMPRESA";
    const targetTenantId = isCompanyScoped ? req.headers.get("x-tenant-id") || "" : "root";
    if (isCompanyScoped && !targetTenantId) {
      return NextResponse.json({ error: "Empresa não identificada." }, { status: 400 });
    }

    const body = await req.json();
    const blobUrl: string = body.blobUrl;
    const filename: string = body.filename;
    const size: number = body.size || 0;
    if (!blobUrl || !filename) {
      return NextResponse.json({ error: "Ficheiro em falta." }, { status: 400 });
    }
    if (!filename.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Só são aceites ficheiros PDF." }, { status: 400 });
    }

    let buffer: Buffer;
    try {
      const blobRes = await fetch(blobUrl, {
        headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
      });
      if (!blobRes.ok) throw new Error(`HTTP ${blobRes.status}`);
      buffer = Buffer.from(await blobRes.arrayBuffer());
    } catch (err: any) {
      return NextResponse.json({ error: `Não foi possível descarregar o ficheiro carregado: ${err?.message || err}` }, { status: 502 });
    }

    let pages;
    try {
      pages = await extractPdfContent(buffer);
    } catch (err: any) {
      return NextResponse.json({ error: `Falha ao ler o PDF: ${err?.message || "formato inválido ou corrompido"}` }, { status: 400 });
    }

    if (pages.length === 0 || pages.every((p) => !p.text.trim())) {
      return NextResponse.json({ error: "Não foi possível extrair texto deste PDF (pode estar vazio, protegido ou ser apenas imagens)." }, { status: 400 });
    }

    // Substituição total: remove o conteúdo indexado anteriormente para este tenant antes
    // de indexar o novo ficheiro — só existe um PDF de conhecimento ativo por tenant.
    await clearChatbotDocument(targetTenantId);

    const briefingId = getChatbotBriefingId(targetTenantId);
    const result = await ingestExtractedPages(pages, { briefingId, tenantId: targetTenantId, sourceName: filename });

    if (result.chunksCount === 0) {
      return NextResponse.json({ error: "Não foi possível processar o conteúdo deste PDF." }, { status: 400 });
    }

    await setChatbotDocument(targetTenantId, {
      fileName: filename,
      sizeBytes: size,
      chunksCount: result.chunksCount,
      uploadedBy: userId,
    });

    await logAuditEvent(userId, "CHATBOT_DOCUMENT_UPLOADED", {
      tenantId: targetTenantId,
      fileName: filename,
      chunksCount: result.chunksCount,
    });

    return NextResponse.json({ success: true, fileName: filename, chunksCount: result.chunksCount });
  } catch (error: any) {
    console.error("Erro no upload do PDF do ChatBot:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
