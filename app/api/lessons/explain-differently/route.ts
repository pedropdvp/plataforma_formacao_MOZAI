import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Tenta gravar a explicação alternativa no bloco de destino, para que a próxima
 * pessoa a abrir esta lição já a veja sem gerar de novo. Falha silenciosamente
 * se courseId/lessonKey/blockId não forem fornecidos ou o bloco não for encontrado
 * — a explicação já foi devolvida ao cliente de qualquer forma.
 */
async function tryPersistAlternateText(
  tenantId: string,
  courseId: string,
  lessonKey: string,
  blockId: string,
  explanation: string
) {
  try {
    const db = await getDb();
    let queryId: any = courseId;
    try {
      queryId = new ObjectId(courseId);
    } catch {}

    const course = await db.collection("courses").findOne({ _id: queryId, tenant_id: tenantId });
    if (!course) return;

    let changed = false;
    const modules = (course.modules || []).map((mod: any) => ({
      ...mod,
      lessons: (mod.lessons || []).map((les: any) => {
        if (les.slug !== lessonKey && les.id !== lessonKey) return les;
        const blocks = (les.blocks || []).map((b: any) => {
          if (b.id !== blockId) return b;
          changed = true;
          return { ...b, alternateText: explanation };
        });
        return { ...les, blocks };
      }),
    }));

    if (changed) {
      await db.collection("courses").updateOne({ _id: course._id }, { $set: { modules, updatedAt: new Date() } });
    }
  } catch (error) {
    console.warn("Não foi possível persistir a explicação alternativa (não bloqueante):", error);
  }
}

// POST — Gera uma explicação alternativa e mais simples para um texto de destaque (callout) de uma lição.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const body = await req.json();
    const { text, courseId, lessonKey, blockId } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Parâmetro 'text' é obrigatório." }, { status: 400 });
    }

    const { text: explanation } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt:
        `Reescreve a seguinte explicação de forma diferente e mais simples, em Português de Portugal, ` +
        `usando uma analogia ou um exemplo concreto do dia-a-dia sempre que possível. ` +
        `Mantém o mesmo significado, mas usa palavras mais acessíveis. Devolve só o texto reescrito, sem introduções.\n\n` +
        `Texto original: "${text}"`,
    });

    if (courseId && lessonKey && blockId) {
      const tenantId = req.headers.get("x-tenant-id") || "root";
      await tryPersistAlternateText(tenantId, courseId, lessonKey, blockId, explanation);
    }

    return NextResponse.json({ success: true, explanation });
  } catch (error: any) {
    console.error("Erro ao gerar explicação alternativa:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
