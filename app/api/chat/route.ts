import { NextRequest, NextResponse, after } from "next/server";
import { searchRelevantContext } from "@/lib/vector-store";
import { openai } from "@ai-sdk/openai";
import { streamText, generateObject } from "ai";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { debitCredits } from "@/lib/ai-credits";
import { z } from "zod";

const cognitiveLogSchema = z.object({
  topic: z.string().describe("O tópico/conceito técnico principal da pergunta, em 1 a 3 palavras (ex: 'Embeddings', 'Server Components', 'Gestão de Estado')"),
  complexity: z.enum(["baixa", "media", "alta"]).describe("Nível de complexidade conceptual da pergunta colocada pelo aluno"),
  isConfusion: z.boolean().describe("true se a pergunta indicar dificuldade, confusão ou um pedido de repetição/clarificação de algo já explicado"),
});

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

    // 0. Debitar 1 crédito IA por pergunta ao Tutor (atómico — nunca deixa saldo negativo)
    const newBalance = await debitCredits(tenantId, userId, 1);
    if (newBalance === null) {
      return NextResponse.json(
        { error: "Saldo de Créditos IA insuficiente. Recarregue em Créditos IA para continuar a usar o Tutor de IA." },
        { status: 402 }
      );
    }

    // 1. Obter a última mensagem do utilizador (a pergunta atual)
    const latestUserMessage = messages[messages.length - 1].content;

    // Classificação e gravação do log cognitivo (Digital Twin) — corre DEPOIS de a resposta
    // ao aluno já ter sido enviada (after()), para não atrasar o Tutor de IA com esta chamada extra.
    after(async () => {
      try {
        const { object: classification } = await generateObject({
          model: openai("gpt-4o-mini"),
          schema: cognitiveLogSchema,
          prompt: `Classifica a seguinte pergunta feita por um aluno a um Tutor de IA durante uma aula:\n\n"${latestUserMessage}"`,
        });

        const db = await getDb();
        await db.collection("cognitive_logs").insertOne({
          tenant_id: tenantId,
          userId,
          courseId,
          question: latestUserMessage,
          topic: classification.topic,
          complexity: classification.complexity,
          isConfusion: classification.isConfusion,
          timestamp: new Date(),
        });
      } catch (dbErr) {
        console.warn("Erro ao registar log cognitivo do Digital Twin:", dbErr);
      }
    });

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
