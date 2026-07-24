import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "text/plain",
  "text/markdown",
  "application/octet-stream", // fallback — alguns browsers não identificam .md/.pptx corretamente
];

// POST — Autoriza o upload direto do browser para o Vercel Blob (o ficheiro nunca passa
// pelo nosso servidor nesta fase), usado pelos materiais auxiliares da Fábrica de Cursos
// para evitar limites de tamanho/parsing do corpo do pedido em ficheiros grandes.
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
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        addRandomSuffix: true,
        maximumSizeInBytes: 50 * 1024 * 1024, // 50MB
      }),
    });

    return NextResponse.json(jsonResponse);
  } catch (error: any) {
    console.error("Erro ao autorizar upload direto para o Blob:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
