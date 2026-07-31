import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { sanityClient } from "@/lib/sanity";
import { extractConceptsFromCourse } from "@/lib/knowledge-graph";
import { debitCredits } from "@/lib/ai-credits";
import { logAuditEvent } from "@/lib/audit";

const COURSES_QUERY = `*[_type == "course"]{ _id, title, description }`;

// GET — Devolve o grafo já indexado (nós = conceitos reais extraídos de cursos publicados,
// arestas = relações reais entre eles), pronto para visualização.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const db = await getDb();
    const [nodes, edges, courses] = await Promise.all([
      db.collection("knowledge_graph_nodes").find({}).toArray(),
      db.collection("knowledge_graph_edges").find({}).toArray(),
      sanityClient.fetch(COURSES_QUERY).catch(() => []),
    ]);

    const indexedCourseIds = new Set(nodes.flatMap((n: any) => n.sourceCourseIds || []));
    const pendingCourses = (courses || []).filter((c: any) => !indexedCourseIds.has(c._id) && c.description);

    return NextResponse.json({
      success: true,
      nodes: nodes.map((n: any) => ({ id: n._id.toString(), name: n.name, sourceCourseTitles: n.sourceCourseTitles || [] })),
      edges: edges.map((e: any) => ({ from: e.from, to: e.to })),
      totalCourses: (courses || []).length,
      indexedCourses: (courses || []).length - pendingCourses.length,
      pendingCourses: pendingCourses.length,
    });
  } catch (error: any) {
    console.error("Erro ao ler Knowledge Graph:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Reindexa (ADMIN/SUPORTE) os cursos publicados ainda não processados: extrai conceitos
// e relações REAIS via IA (uma chamada real por curso, debitando Créditos IA) e funde-os no
// grafo global, deduplicando conceitos pelo nome (case-insensitive).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }
    const activeRole = req.cookies.get("active-role")?.value;
    if (activeRole !== "ADMIN" && activeRole !== "SUPORTE") {
      return NextResponse.json({ error: "Apenas ADMIN/SUPORTE podem reindexar o Knowledge Graph." }, { status: 403 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const courses: any[] = await sanityClient.fetch(COURSES_QUERY).catch(() => []);
    const existingNodes = await db.collection("knowledge_graph_nodes").find({}).toArray();
    const indexedCourseIds = new Set(existingNodes.flatMap((n: any) => n.sourceCourseIds || []));
    const pending = courses.filter((c) => !indexedCourseIds.has(c._id) && c.description).slice(0, 5); // limite por pedido, evita custos descontrolados

    if (pending.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: "Não há cursos novos para indexar." });
    }

    const nodeByName = new Map<string, any>(existingNodes.map((n: any) => [n.name.toLowerCase(), n]));
    let processed = 0;

    for (const course of pending) {
      const newBalance = await debitCredits(tenantId, userId, 1);
      if (newBalance === null) break;

      const extracted = await extractConceptsFromCourse(course.title, course.description);

      for (const concept of extracted.concepts) {
        const key = concept.name.toLowerCase();
        const existing = nodeByName.get(key);
        if (existing) {
          await db.collection("knowledge_graph_nodes").updateOne(
            { _id: existing._id },
            { $addToSet: { sourceCourseIds: course._id, sourceCourseTitles: course.title } }
          );
        } else {
          const result = await db.collection("knowledge_graph_nodes").insertOne({
            name: concept.name,
            sourceCourseIds: [course._id],
            sourceCourseTitles: [course.title],
            createdAt: new Date(),
          });
          nodeByName.set(key, { _id: result.insertedId, name: concept.name });
        }
      }

      for (const rel of extracted.relations) {
        const fromExists = extracted.concepts.some((c) => c.name === rel.from);
        const toExists = extracted.concepts.some((c) => c.name === rel.to);
        if (!fromExists || !toExists || rel.from === rel.to) continue;
        await db.collection("knowledge_graph_edges").updateOne(
          { from: rel.from, to: rel.to },
          { $setOnInsert: { from: rel.from, to: rel.to, createdAt: new Date() } },
          { upsert: true }
        );
      }

      processed++;
    }

    await logAuditEvent(userId, "KNOWLEDGE_GRAPH_REINDEXED", { tenantId, processed });

    return NextResponse.json({ success: true, processed });
  } catch (error: any) {
    console.error("Erro ao reindexar Knowledge Graph:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
