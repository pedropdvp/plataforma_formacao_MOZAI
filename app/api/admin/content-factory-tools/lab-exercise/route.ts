import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { debitCredits } from "@/lib/ai-credits";
import { saveContentFactoryAsset } from "@/lib/content-factory-tools";
import { executeCode } from "@/lib/coding-lab/piston";

export const maxDuration = 45;

const labSchema = z.object({
  title: z.string(),
  instructions: z.string(),
  language: z.enum(["python", "javascript", "typescript"]),
  solutionCode: z.string().describe("Código de referência COMPLETO e funcional que resolve o exercício, lendo entradas via stdin quando aplicável"),
  starterCode: z.string().describe("Código inicial incompleto para o aluno completar"),
  testCases: z.array(z.object({ label: z.string(), stdin: z.string(), expectedOutput: z.string() })).min(2).max(5),
});

/**
 * Gerador de Laboratório EXECUTÁVEL real — melhoria honesta face ao estado anterior (que só
 * gerava uma descrição em texto, sem ambiente executável). Agora: a IA gera enunciado + código
 * de referência + casos de teste, e o SERVIDOR VALIDA de verdade a solução de referência contra
 * cada caso de teste, executando-a no motor real do Coding Lab (Piston) — se a solução gerada
 * pela IA não passar nos seus próprios testes, o laboratório é rejeitado em vez de guardado
 * com um enunciado que não se consegue mesmo resolver.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });

    const { sourceText, title } = await req.json();
    if (!sourceText?.trim()) return NextResponse.json({ error: "Cole o conteúdo para gerar o laboratório." }, { status: 400 });

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const newBalance = await debitCredits(tenantId, userId, 2);
    if (newBalance === null) return NextResponse.json({ error: "Saldo de Créditos IA insuficiente (laboratório custa 2 Créditos IA)." }, { status: 402 });

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: labSchema,
      prompt: `Cria um exercício de laboratório de programação prático a partir deste conteúdo de curso. O código deve ler entradas via stdin (input()/readline conforme a linguagem) e imprimir o resultado. Inclui uma solução de referência completa e funcional, código inicial para o aluno, e 2-4 casos de teste reais (stdin + resultado esperado exato).\n\nCONTEÚDO:\n${sourceText}`,
    });

    // Validação REAL: corre a solução de referência da IA contra os seus próprios testes.
    const validation: { label: string; passed: boolean; stdout: string }[] = [];
    for (const tc of object.testCases) {
      const result = await executeCode(object.language, object.solutionCode, tc.stdin);
      validation.push({ label: tc.label, passed: result.stdout.trim() === tc.expectedOutput.trim(), stdout: result.stdout });
    }
    const allPassed = validation.every((v) => v.passed);

    if (!allPassed) {
      return NextResponse.json(
        { error: "A solução gerada pela IA não passou nos seus próprios testes — laboratório rejeitado para evitar publicar um exercício irresolúvel.", validation },
        { status: 422 }
      );
    }

    const content = { title: object.title, instructions: object.instructions, language: object.language, starterCode: object.starterCode, solutionCode: object.solutionCode, testCases: object.testCases };
    const assetId = await saveContentFactoryAsset({ tenantId, userId, type: "lab-exercise", title: title || object.title, content });

    return NextResponse.json({ success: true, assetId, lab: content, validation });
  } catch (error: any) {
    console.error("Erro ao gerar laboratório executável:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
