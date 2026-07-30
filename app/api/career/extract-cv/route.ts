import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { extractPdfContent } from "@/lib/pdf-extract";

const MAX_FILE_B64 = 3_800_000; // ~2.8 MB de ficheiro original

/** Extrai o texto de um DOCX usando mammoth — mesma abordagem já usada na Fábrica de
 * Cursos (app/api/admin/courses/generate/upload/route.ts) para materiais em Word. */
async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return (result.value || "").trim();
}

/** POST — Extrai o texto de um CV em PDF ou DOCX carregado, para pré-preencher a
 * análise de carreira. A extensão do ficheiro decide o extrator — não o MIME-type
 * reportado pelo browser, que é pouco fiável para .docx (lição já aprendida na
 * Fábrica de Cursos com .pptx/.pdf no Windows). */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const { data, filename } = await req.json();
    if (typeof data !== "string" || !data || data.length > MAX_FILE_B64) {
      return NextResponse.json({ error: "Ficheiro inválido ou demasiado grande (máx. ~2.8MB)." }, { status: 400 });
    }

    const name = (filename || "").toLowerCase();
    const buffer = Buffer.from(data, "base64");

    let text: string;
    if (name.endsWith(".docx")) {
      text = await extractDocxText(buffer);
    } else {
      // Por omissão assume PDF — mantém compatibilidade com chamadas antigas sem 'filename'.
      const pages = await extractPdfContent(buffer);
      text = pages.map((p) => p.text).join("\n\n").trim();
    }

    if (!text) {
      return NextResponse.json({ error: "Não foi possível extrair texto deste ficheiro." }, { status: 422 });
    }

    return NextResponse.json({ success: true, text });
  } catch (error: any) {
    console.error("Erro ao extrair CV:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
