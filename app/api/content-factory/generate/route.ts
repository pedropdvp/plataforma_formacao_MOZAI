import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

export const maxDuration = 45; // Permitir tempo suficiente para chamadas de IA robustas

const contentSchema = z.object({
  topic: z.string().describe("O tema da aula gerada"),
  script: z.string().describe("Roteiro completo narrativo da aula para o apresentador ou avatar digital"),
  slides: z.array(
    z.object({
      title: z.string().describe("Título do slide"),
      bullets: z.array(z.string()).describe("Lista de 3 a 4 tópicos/pontos principais do slide"),
    })
  ),
  quiz: z.array(
    z.object({
      question: z.string().describe("Pergunta do teste rápido"),
      options: z.array(z.string()).describe("Lista de 3 a 4 opções de resposta"),
      correctOption: z.string().describe("A opção correta exatamente igual a uma das opções fornecidas"),
    })
  ),
  lab: z.string().describe("Uma tarefa prática de laboratório ou exercício de programação para o formando"),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Validar autenticação do Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Autenticação obrigatória." },
        { status: 401 }
      );
    }

    const { topic } = await req.json();
    if (!topic || !topic.trim()) {
      return NextResponse.json(
        { error: "O tópico é obrigatório para geração." },
        { status: 400 }
      );
    }

    // 2. Chamar o modelo da OpenAI estruturado
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: contentSchema,
      prompt: `
        Crie um conteúdo pedagógico completo e profissional em português para uma aula sobre: "${topic}".
        O conteúdo deve conter:
        1. Um roteiro (script) de aula explicativo com introdução, desenvolvimento e conclusão.
        2. Uma sequência de 2 a 3 slides estruturados com pontos chave.
        3. Um quiz rápido de 2 perguntas de escolha múltipla para avaliar o formando.
        4. Uma proposta de laboratório prático ou exercício de código para fixação.
      `,
    });

    return NextResponse.json({
      success: true,
      content: object,
    });
  } catch (error: any) {
    console.error("Erro na geração da Content Factory:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
