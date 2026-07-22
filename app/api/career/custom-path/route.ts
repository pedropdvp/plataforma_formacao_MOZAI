import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { sanityClient } from "@/lib/sanity";
import { generateObject, jsonSchema } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit";

export const maxDuration = 90; // Permitir tempo para matching e geração híbrida

const hybridPathSchema = z.object({
  title: z.string().describe("Título do curso personalizado à medida"),
  description: z.string().describe("Descrição explicativa de como este percurso atende aos objetivos do aluno"),
  modules: z.array(
    z.object({
      title: z.string().describe("Título do módulo"),
      order: z.number().describe("Ordem (1-indexed)"),
      lessons: z.array(
        z.object({
          title: z.string().describe("Título da lição"),
          isCatalogRef: z.boolean().describe("true se for uma aula já existente no catálogo, false se for uma lição gerada para preencher lacuna"),
          catalogCourseId: z.string().describe("ID do curso no catálogo. Obrigatório se isCatalogRef for true, caso contrário devolver string vazia."),
          catalogLessonId: z.string().describe("ID da lição no catálogo. Obrigatório se isCatalogRef for true, caso contrário devolver string vazia."),
          content: z.string().describe("Explicação teórica completa em Markdown. Obrigatória se isCatalogRef for false, descrição curta se for aula do catálogo."),
          exercises: z.array(
            z.object({
              question: z.string(),
              options: z.array(z.string()),
              correctIndex: z.number(),
            })
          ).describe("Exercícios rápidos. Obrigatório se for aula nova gerada, array vazio se for referência do catálogo."),
          lab: z.string().describe("Laboratório de código prático. Obrigatório se for aula nova gerada, string vazia se for referência do catálogo."),
        })
      ),
    })
  ),
});

// Schema JSON escrito à mão (em vez de deixar a conversão automática Zod→JSON-Schema tratar
// dos 3 níveis de arrays aninhados: modules → lessons → exercises). A conversão automática desta
// versão do SDK ("ai"@7 + "@ai-sdk/openai"@4) perde chaves do `required` nesse nível de profundidade,
// causando o erro "Missing 'catalogCourseId'" da OpenAI (que exige `required` completo em modo estrito).
// Escrever o schema à mão garante `required`/`additionalProperties: false` corretos em todos os níveis,
// mantendo a validação e a tipagem via Zod (`validate`).
const hybridPathJsonSchema = jsonSchema<z.infer<typeof hybridPathSchema>>(
  {
    type: "object",
    properties: {
      title: { type: "string", description: "Título do curso personalizado à medida" },
      description: { type: "string", description: "Descrição explicativa de como este percurso atende aos objetivos do aluno" },
      modules: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Título do módulo" },
            order: { type: "number", description: "Ordem (1-indexed)" },
            lessons: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Título da lição" },
                  isCatalogRef: { type: "boolean", description: "true se for uma aula já existente no catálogo, false se for uma lição gerada para preencher lacuna" },
                  catalogCourseId: { type: "string", description: "ID do curso no catálogo. Obrigatório se isCatalogRef for true, caso contrário devolver string vazia." },
                  catalogLessonId: { type: "string", description: "ID da lição no catálogo. Obrigatório se isCatalogRef for true, caso contrário devolver string vazia." },
                  content: { type: "string", description: "Explicação teórica completa em Markdown. Obrigatória se isCatalogRef for false, descrição curta se for aula do catálogo." },
                  exercises: {
                    type: "array",
                    description: "Exercícios rápidos. Obrigatório se for aula nova gerada, array vazio se for referência do catálogo.",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string" },
                        options: { type: "array", items: { type: "string" } },
                        correctIndex: { type: "number" },
                      },
                      required: ["question", "options", "correctIndex"],
                      additionalProperties: false,
                    },
                  },
                  lab: { type: "string", description: "Laboratório de código prático. Obrigatório se for aula nova gerada, string vazia se for referência do catálogo." },
                },
                required: ["title", "isCatalogRef", "catalogCourseId", "catalogLessonId", "content", "exercises", "lab"],
                additionalProperties: false,
              },
            },
          },
          required: ["title", "order", "lessons"],
          additionalProperties: false,
        },
      },
    },
    required: ["title", "description", "modules"],
    additionalProperties: false,
  },
  {
    validate: (value) => {
      const result = hybridPathSchema.safeParse(value);
      return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
    },
  }
);

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const body = await req.json();
    const { goal, duration } = body;

    if (!goal || !goal.trim()) {
      return NextResponse.json({ error: "O objetivo de estudos é obrigatório." }, { status: 400 });
    }

    // 1. Ler as aulas do catálogo real do Sanity para alimentar a IA
    let catalog: any[] = [];
    try {
      const CATALOG_ITEMS_QUERY = `
        *[_type == "course"] {
          _id,
          title,
          "lessons": modules[]->lessons[] {
            _id,
            title
          }
        }
      `;
      catalog = await sanityClient.fetch(CATALOG_ITEMS_QUERY);
      catalog = Array.isArray(catalog) ? catalog.filter(Boolean) : [];
    } catch (e) {
      console.warn("Erro ao obter catálogo do Sanity para cursos à medida:", e);
    }

    const catalogSummary = catalog.map(c => ({
      courseId: c._id,
      courseTitle: c.title,
      lessons: (c.lessons || []).map((l: any) => ({
        lessonId: l._id,
        lessonTitle: l.title
      }))
    }));

    // 2. Chamar OpenAI estruturado para mapear correspondências e identificar lacunas
    const prompt = `
      Crie um percurso formativo personalizado híbrido (Curso à Medida) para atender ao seguinte objetivo de estudos do aluno:
      Objetivo: "${goal}"
      Tempo disponível: ${duration || "4 semanas"}
      
      CATÁLOGO DISPONÍVEL DE CURSOS E AULAS:
      ${JSON.stringify(catalogSummary, null, 2)}
      
      INSTRUÇÕES E REGRAS:
      1. Mapeie lições existentes do catálogo que ensinem o que o aluno deseja. Para estas aulas, defina 'isCatalogRef' como true e forneça os respetivos IDs 'catalogCourseId' e 'catalogLessonId'.
      2. Identifique lacunas (tópicos solicitados pelo aluno que não estão cobertos no catálogo acima).
      3. Para cada lacuna, crie 1 nova lição sob demanda com conteúdo teórico pedagógico completo em português (no campo 'content'), 2 quizzes de escolha múltipla (no campo 'exercises') e um laboratório prático de programação (no campo 'lab'). Defina 'isCatalogRef' como false para estas lições.
    `;

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: hybridPathJsonSchema,
      prompt,
    });

    // 3. Gravar na base de dados como um curso PRIVADO publicado para o aluno
    const db = await getDb();
    
    // Adaptar formato dos módulos para salvar consistentemente
    const completedModules = object.modules.map((m, mIdx) => ({
      id: `mod-${mIdx + 1}`,
      title: m.title,
      order: m.order,
      lessons: m.lessons.map((l, lIdx) => {
        if (l.isCatalogRef) {
          // Se for referência, buscamos o redirecionamento ou link
          return {
            id: l.catalogLessonId || `lesson-${mIdx + 1}-${lIdx + 1}`,
            slug: l.catalogLessonId || `les-ref-${mIdx + 1}-${lIdx + 1}`,
            title: l.title,
            isCatalogRef: true,
            catalogCourseId: l.catalogCourseId,
            catalogLessonId: l.catalogLessonId,
            content: `Esta aula faz parte do curso oficial do catálogo. Por favor, aceda a ela no catálogo oficial.`,
            videoProvider: "youtube",
            videoId: "",
            exercises: [],
            lab: "",
            resources: []
          };
        } else {
          return {
            id: `lesson-${mIdx + 1}-${lIdx + 1}`,
            slug: `les-custom-${mIdx + 1}-${lIdx + 1}-${l.title.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30)}`,
            title: l.title,
            isCatalogRef: false,
            content: l.content || "Sem conteúdo gerado.",
            videoProvider: "youtube",
            videoId: "",
            exercises: l.exercises || [],
            lab: l.lab || "",
            resources: []
          };
        }
      })
    }));

    const courseDoc = {
      tenant_id: tenantId,
      title: object.title,
      description: object.description,
      status: "PUBLISHED", // Já publicado pois é direto para o próprio aluno estudar
      isPrivate: true, // Apenas para o formando criador
      generatedByUserId: userId,
      isAIGenerated: true,
      modules: completedModules,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const courseResult = await db.collection("courses").insertOne(courseDoc);

    await logAuditEvent(userId, "COURSE_CUSTOM_PATH_CREATED", {
      courseId: courseResult.insertedId.toString(),
      title: object.title,
      goal,
    });

    return NextResponse.json({
      success: true,
      courseId: courseResult.insertedId.toString(),
      title: object.title,
      description: object.description,
      firstLesson: completedModules[0]?.lessons?.[0]?.slug || ""
    });
  } catch (error: any) {
    console.error("Erro ao gerar percurso sob medida para aluno:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
