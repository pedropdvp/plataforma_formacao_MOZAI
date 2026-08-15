import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export const runtime = "nodejs";

// GET — Serve o Material Original (PDF) anexado a uma lição. O ficheiro vive no Vercel
// Blob como "private" (mesmo store dos materiais da Fábrica de Cursos), pelo que nunca é
// servido diretamente ao browser — esta rota descarrega-o no servidor com o token de
// leitura/escrita e devolve o conteúdo com o Content-Type correto. O URL do Blob nunca é
// aceite vindo do cliente: é sempre lido do próprio registo da lição na base de dados,
// para nunca funcionar como proxy aberto a qualquer URL arbitrário.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const courseId = req.nextUrl.searchParams.get("courseId");
    const lessonSlug = req.nextUrl.searchParams.get("lessonSlug");
    if (!courseId || !lessonSlug) {
      return NextResponse.json({ error: "courseId e lessonSlug são obrigatórios." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    let queryId: any = courseId;
    try {
      queryId = new ObjectId(courseId);
    } catch {}

    const course = await db.collection("courses").findOne({ _id: queryId, tenant_id: tenantId });
    if (!course) {
      return NextResponse.json({ error: "Curso não encontrado." }, { status: 404 });
    }

    const lesson = (course.modules || [])
      .flatMap((m: any) => m.lessons || [])
      .find((l: any) => (l.slug || l.id) === lessonSlug);

    if (!lesson?.materialUrl) {
      return NextResponse.json({ error: "Esta lição não tem material original anexado." }, { status: 404 });
    }

    const blobRes = await fetch(lesson.materialUrl, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    });
    if (!blobRes.ok) {
      return NextResponse.json({ error: "Não foi possível obter o material original." }, { status: 502 });
    }

    const buffer = await blobRes.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${(lesson.materialName || "material.pdf").replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: any) {
    console.error("Erro ao servir material original da lição:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
