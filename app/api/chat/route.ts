import { NextRequest, NextResponse } from "next/server";
import { searchRelevantContext } from "@/lib/vector-store";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

export const maxDuration = 30; // 30 segundos de limite de execução

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Autenticação obrigatória." },
        { status: 401 }
      );
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const { messages, courseId } = await req.json();

    if (!messages || messages.length === 0 || !courseId) {
      return NextResponse.json(
        { error: "Parâmetros 'messages' e 'courseId' são obrigatórios." },
        { status: 400 }
      );
    }

    // 1. Obter a última mensagem do utilizador (a pergunta atual)
    const latestUserMessage = messages[messages.length - 1].content;

    // Gravação assíncrona do log cognitivo e análise de tópicos (Digital Twin)
    try {
      const db = await getDb();
      const cleanWords = latestUserMessage
        .toLowerCase()
        .replace(/[^\p{L}\d\s]/gu, "") // Suporta caracteres acentuados latinos
        .split(/\s+/)
        .filter((w: string) => w.length > 4 && !["sobre", "como", "fazer", "porque", "minha", "quais", "quais", "posso", "ajuda"].includes(w));

      await db.collection("cognitive_logs").insertOne({
        tenant_id: tenantId,
        userId,
        courseId,
        question: latestUserMessage,
        topics: cleanWords,
        timestamp: new Date(),
      });
    } catch (dbErr) {
      console.warn("Erro ao registar log cognitivo do Digital Twin:", dbErr);
    }

    // 2. Procurar contexto semântico relevante nas lições usando RAG (Vector Search)
    const contextChunks = await searchRelevantContext(tenantId, courseId, latestUserMessage, 3);
    const groundingContext = contextChunks.join("\n\n---\n\n");

    // 3. Prompt do Sistema com Regras Estritas de Grounding
    const systemPrompt = `
És o Tutor de IA oficial da plataforma MOZAI. O teu papel é apoiar os alunos nas suas dúvidas sobre o curso.

REGRAS DE CONDUTA E SEGURANÇA (GROUNDING):
1. Responde às dúvidas do aluno com base EXCLUSIVA no material oficial fornecido no CONTEXTO DE APREENSÃO abaixo.
2. Se a resposta para a questão do aluno não puder ser extraída do contexto abaixo, deves responder de forma educada e pedagógica: "Lamento, mas esse tópico não é abordado nas aulas oficiais deste curso. Posso ajudá-lo com assuntos do currículo?"
3. Nunca inventes factos, links ou bibliotecas que não estejam listados. Mantém o rigor técnico e pedagógico.
4. Explica conceitos complexos dividindo-os por passos lógicos e limpos.

CONTEXTO DE APREENSÃO:
${groundingContext ? groundingContext : "Nenhum contexto de lição encontrado para esta pergunta."}
`;

    // 4. Invocar streamText da Vercel AI SDK
    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      messages: messages,
    });

    // 5. Retornar a resposta em formato stream
    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error("Erro na API do Tutor de IA (Chat):", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
