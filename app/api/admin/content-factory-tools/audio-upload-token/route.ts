import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { canActiveRoleOpen } from "@/lib/session";

// POST — Token de upload direto (cliente → Vercel Blob) para os ficheiros de áudio/vídeo
// usados pelas ferramentas de Transcrição/Legendas da Content Factory.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }
    if (!(await canActiveRoleOpen("/dashboard/admin/content-factory-tools"))) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const body = (await req.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        access: "public",
        addRandomSuffix: true,
        maximumSizeInBytes: 60 * 1024 * 1024,
      }),
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(jsonResponse);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
