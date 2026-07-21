import "./load-env";
import { createClient } from "next-sanity";

/**
 * INDEXAÇÃO RAG: lê todos os cursos/lições do Sanity, converte o conteúdo
 * Portable Text em texto plano, gera embeddings e guarda os chunks no
 * MongoDB Atlas Vector Search (via lib/vector-store.ts).
 *
 * Executar:  npx tsx scripts/index-content.ts
 *
 * Requer no .env.local:  SANITY_PROJECT_ID, OPENAI_API_KEY, MONGODB_URI, MONGODB_DB
 * Opcional:  SANITY_API_WRITE_TOKEN (para ler drafts/datasets privados),
 *            TENANT_ID (default "root")
 */

const projectId =
  process.env.SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset =
  process.env.SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const tenantId = process.env.TENANT_ID || "root";

if (!projectId || projectId === "dummy-project-id") {
  console.error("❌ Falta SANITY_PROJECT_ID no .env.local");
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion: "2023-05-03",
  token: process.env.SANITY_API_WRITE_TOKEN, // opcional
  useCdn: false,
});

/** Converte um array de blocos Portable Text em texto plano legível. */
function portableTextToPlain(blocks: any[]): string {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .map((block) => {
      if (block?._type === "block" && Array.isArray(block.children)) {
        return block.children.map((c: any) => c?.text ?? "").join("");
      }
      if (block?._type === "code" && typeof block.code === "string") {
        return block.code;
      }
      // Imagens e outros tipos são ignorados no texto para RAG
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

// Query: todas as lições com o seu curso-pai e conteúdo
const QUERY = `
  *[_type == "course"]{
    _id,
    title,
    "lessons": modules[]->lessons[]->{
      _id,
      title,
      content
    }
  }
`;

async function run() {
  // Import dinâmico só depois do env estar carregado (o módulo lê process.env no topo)
  const { indexLessonContent } = await import("../lib/vector-store");

  console.log(`🔎 A ler cursos do Sanity "${projectId}"...`);
  const courses: any[] = await client.fetch(QUERY);

  let totalLessons = 0;
  for (const course of courses) {
    const lessons = (course.lessons ?? []).filter(Boolean);
    console.log(`\n📘 ${course.title} (${lessons.length} lições)`);

    for (const lesson of lessons) {
      const plain = portableTextToPlain(lesson.content);
      if (!plain.trim()) {
        console.log(`  ⚠ ${lesson.title} — sem conteúdo textual, ignorada`);
        continue;
      }
      const withTitle = `# ${lesson.title}\n\n${plain}`;
      await indexLessonContent(tenantId, course._id, lesson._id, withTitle);
      totalLessons++;
      console.log(`  ✓ Indexada: ${lesson.title}`);
    }
  }

  console.log(`\n✅ Indexação concluída — ${totalLessons} lições, tenant "${tenantId}".`);
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Erro na indexação:", err);
  process.exit(1);
});
