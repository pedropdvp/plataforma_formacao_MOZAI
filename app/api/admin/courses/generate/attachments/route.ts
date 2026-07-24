import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { deleteIngestedSource } from "@/lib/ai/ingest";

export const runtime = "nodejs";

// DELETE ?briefingId=&sourceId= — Remove os chunks RAG de um único anexo (ficheiro, site ou transcrição),
// sem afetar os restantes materiais do mesmo briefing. Usado tanto para apagar como, ao editar um
// link, para substituir o anexo antigo antes de reimportar com o novo URL.
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const briefingId = searchParams.get("briefingId");
    const sourceId = searchParams.get("sourceId");

    if (!briefingId || !sourceId) {
      return NextResponse.json({ error: "briefingId e sourceId são obrigatórios." }, { status: 400 });
    }

    const deletedCount = await deleteIngestedSource(briefingId, sourceId);
    return NextResponse.json({ success: true, deletedCount });
  } catch (error: any) {
    console.error("Erro ao apagar anexo:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
