import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

/**
 * Motor do Knowledge Graph — âmbito honesto: NÃO é um grafo mundial com "milhões de
 * conceitos/relações" (isso exigiria uma base de conhecimento como a Wikidata, fora de
 * qualquer âmbito razoável para esta plataforma). É um grafo REAL, extraído por IA a partir
 * do conteúdo REAL dos cursos publicados na MOZAI — cresce organicamente à medida que mais
 * cursos são indexados, e cada conceito/relação vem de facto de um curso concreto (rastreável).
 */

const extractionSchema = z.object({
  concepts: z.array(z.object({ name: z.string().describe("Nome curto do conceito técnico (1-4 palavras)") })).min(2).max(8),
  relations: z.array(
    z.object({
      from: z.string().describe("Nome de um conceito da lista 'concepts'"),
      to: z.string().describe("Nome de outro conceito da lista 'concepts' que dependa ou se relacione com o primeiro"),
    })
  ),
});

export async function extractConceptsFromCourse(title: string, description: string) {
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: extractionSchema,
    prompt: `Extrai os principais conceitos técnicos ensinados neste curso e as relações reais entre eles (o que depende do quê).\n\nTítulo: ${title}\nDescrição: ${description}`,
  });
  return object;
}
