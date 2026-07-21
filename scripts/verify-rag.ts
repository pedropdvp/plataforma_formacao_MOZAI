import "./load-env";

/**
 * VERIFY RAG: confirma o estado da indexação vetorial no MongoDB Atlas.
 * Mostra total de chunks, tenants, cursos, dimensões dos embeddings e,
 * se possível, testa uma pesquisa semântica real (Vector Search).
 *
 * Executar:  npm run verify:rag
 */

const tenantId = process.env.TENANT_ID || "root";

async function run() {
  const { getDb } = await import("../lib/mongodb");
  const db = await getDb();
  const col = db.collection("lesson_chunks");

  const total = await col.countDocuments();
  const tenants = await col.distinct("tenant_id");
  const courses = await col.distinct("courseId");
  const sample: any = await col.findOne({});
  const dims = Array.isArray(sample?.embedding) ? sample.embedding.length : 0;

  console.log("📊 Estado do Vector Store (MongoDB Atlas)\n");
  console.log(`  Total de chunks:     ${total}`);
  console.log(`  Tenants:             ${JSON.stringify(tenants)}`);
  console.log(`  Cursos indexados:    ${JSON.stringify(courses)}`);
  console.log(`  Dimensões embedding: ${dims} ${dims === 1536 ? "✓" : "✗ (esperado 1536)"}`);

  if (total === 0) {
    console.log("\n⚠ Sem chunks. Corre primeiro: npm run index:content");
    process.exit(1);
  }

  // Teste de pesquisa semântica real (usa o índice vector_index se existir)
  try {
    const { searchRelevantContext } = await import("../lib/vector-store");
    const query = "Quem criou o Bitcoin?";
    const courseId = courses[0];
    const results = await searchRelevantContext(tenantId, String(courseId), query, 2);
    console.log(`\n🔎 Teste de pesquisa — "${query}" (tenant "${tenantId}", curso "${courseId}")`);
    if (results.length === 0) {
      console.log("  ⚠ 0 resultados. Verifica o índice 'vector_index' no Atlas.");
    } else {
      results.forEach((r, i) => console.log(`  ${i + 1}. ${r.slice(0, 120).replace(/\n/g, " ")}…`));
      console.log("\n✅ RAG operacional.");
    }
  } catch (e: any) {
    console.log("\n⚠ Pesquisa semântica falhou:", e.message);
  }

  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Erro na verificação:", err.message);
  process.exit(1);
});
