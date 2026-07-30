import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

// POST — Autoriza o upload direto do browser para o Vercel Blob de um dataset
// (CSV/JSON/ZIP/etc.) — o ficheiro nunca passa pelo corpo do nosso pedido, mesmo padrão
// já usado para materiais da Fábrica de Cursos e submissões de Projetos.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        access: "public",
        addRandomSuffix: true,
        maximumSizeInBytes: 80 * 1024 * 1024, // 80MB
      }),
    });

    return NextResponse.json(jsonResponse);
  } catch (error: any) {
    console.error("Erro ao autorizar upload de dataset:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
