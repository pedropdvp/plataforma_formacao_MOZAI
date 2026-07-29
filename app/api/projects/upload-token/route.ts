import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

// POST — Autoriza o upload direto do browser para o Vercel Blob do ficheiro de evidência
// de um projeto prático (zip, PDF, etc.), sem passar pelo nosso servidor.
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
        addRandomSuffix: true,
        maximumSizeInBytes: 100 * 1024 * 1024, // 100MB
      }),
    });

    return NextResponse.json(jsonResponse);
  } catch (error: any) {
    console.error("Erro ao autorizar upload de evidência de projeto:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
