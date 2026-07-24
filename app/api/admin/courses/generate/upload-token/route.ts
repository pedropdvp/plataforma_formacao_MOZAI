import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

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
        // SEM allowedContentTypes: o MIME-type reportado pelo browser para .pptx/.pdf é
        // pouco fiável (especialmente no Windows sem o Office/leitor associado — chega a
        // vir vazio ou incorreto), e a Vercel Blob rejeita o PUT silenciosamente quando não
        // bate certo com a lista — sem qualquer erro visível nos nossos logs de servidor
        // (foi exatamente isto que impedia o upload de PPTX/PDF em produção). A validação
        // de tipo de ficheiro já é feita de forma fiável pela extensão, tanto no atributo
        // "accept" do <input> como em extractFileContent() no servidor — não pela MIME type.
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
