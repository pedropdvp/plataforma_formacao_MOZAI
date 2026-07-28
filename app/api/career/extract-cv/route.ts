import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { extractPdfContent } from "@/lib/pdf-extract";

const MAX_FILE_B64 = 3_800_000; // ~2.8 MB de ficheiro original

/** POST — Extrai o texto de um CV em PDF carregado, para pré-preencher a análise de carreira. */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const { data } = await req.json();
    if (typeof data !== "string" || !data || data.length > MAX_FILE_B64) {
      return NextResponse.json({ error: "Ficheiro PDF inválido ou demasiado grande." }, { status: 400 });
    }

    const buffer = Buffer.from(data, "base64");
    const pages = await extractPdfContent(buffer);
    const text = pages.map((p) => p.text).join("\n\n").trim();

    if (!text) {
      return NextResponse.json({ error: "Não foi possível extrair texto deste PDF." }, { status: 422 });
    }

    return NextResponse.json({ success: true, text });
  } catch (error: any) {
    console.error("Erro ao extrair CV em PDF:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
