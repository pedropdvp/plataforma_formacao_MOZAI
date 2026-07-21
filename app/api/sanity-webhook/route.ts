import { NextRequest, NextResponse } from "next/server";
import { createClient } from "next-sanity";
import { indexLessonContent } from "@/lib/vector-store";

/**
 * Webhook de reindexação: o Sanity chama esta rota quando uma lição/curso é
 * publicado ou alterado. Reindexa o conteúdo afetado no MongoDB Atlas Vector Search.
 *
 * Configurar no Sanity: manage.sanity.io → API → Webhooks → Create Webhook
 *   URL:    https://<o-teu-dominio>/api/sanity-webhook
 *   Trigger: Create, Update, Delete
 *   Secret:  o mesmo valor de SANITY_WEBHOOK_SECRET (enviado no header abaixo)
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "dummy-project-id",
  dataset: process.env.SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: "2023-05-03",
  token: process.env.SANITY_API_WRITE_TOKEN,
  useCdn: false,
});

/** Converte blocos Portable Text em texto plano. */
function portableTextToPlain(blocks: any[]): string {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .map((b) => {
      if (b?._type === "block" && Array.isArray(b.children)) {
        return b.children.map((c: any) => c?.text ?? "").join("");
      }
      if (b?._type === "code" && typeof b.code === "string") return b.code;
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

// Dado o _id de uma lição, descobre o curso-pai (via referências de módulos).
const COURSE_FOR_LESSON = `
  *[_type == "course" && references($lessonId)][0]{ _id }
`;

const LESSON_BY_ID = `
  *[_type == "lesson" && _id == $lessonId][0]{ _id, title, content }
`;

export async function POST(req: NextRequest) {
  try {
    // 1. Validar o segredo partilhado
    const secret = process.env.SANITY_WEBHOOK_SECRET;
    const provided = req.headers.get("sanity-webhook-secret") || req.headers.get("x-webhook-secret");
    if (!secret || provided !== secret) {
      return NextResponse.json({ error: "Segredo inválido." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || process.env.TENANT_ID || "root";
    const body = await req.json();

    // O Sanity envia o documento alterado. Aceitamos _type + _id.
    const docId: string | undefined = body?._id;
    const docType: string | undefined = body?._type;

    if (docType !== "lesson" || !docId) {
      // Alterações a módulos/cursos: nada a fazer aqui (a lição continua igual).
      return NextResponse.json({ ok: true, skipped: `tipo "${docType}" não indexável diretamente` });
    }

    // 2. Buscar a lição e o curso-pai
    const [lesson, course] = await Promise.all([
      sanity.fetch(LESSON_BY_ID, { lessonId: docId }),
      sanity.fetch(COURSE_FOR_LESSON, { lessonId: docId }),
    ]);

    if (!lesson || !course?._id) {
      return NextResponse.json({ ok: true, skipped: "lição ou curso não encontrado" });
    }

    const plain = portableTextToPlain(lesson.content);
    if (!plain.trim()) {
      return NextResponse.json({ ok: true, skipped: "lição sem conteúdo textual" });
    }

    // 3. Reindexar (indexLessonContent limpa os chunks antigos da lição primeiro)
    await indexLessonContent(tenantId, course._id, lesson._id, `# ${lesson.title}\n\n${plain}`);

    return NextResponse.json({ ok: true, indexed: lesson._id, course: course._id, tenant: tenantId });
  } catch (error: any) {
    console.error("Erro no webhook de reindexação:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
