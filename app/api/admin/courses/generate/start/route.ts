import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { put } from "@vercel/blob";
import { generateLesson, generateLessonImage, searchUploadedMaterials, ContextChunk } from "@/lib/ai/generator-engine";
import { logAuditEvent } from "@/lib/audit";
import { LessonBlock, blocksToPlainText, newBlockId } from "@/lib/lesson-blocks";

/**
 * Converte um data URI base64 (imagem gerada por IA) num blob público persistente,
 * registando-o também na Biblioteca de Media do tenant para reutilização noutras lições.
 */
async function persistGeneratedImage(dataUrl: string, tenantId: string, userId: string, label: string): Promise<string | null> {
  try {
    const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) return null;
    const [, ext, base64] = match;
    const buffer = Buffer.from(base64, "base64");
    const pathname = `media/${tenantId}/ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const blob = await put(pathname, buffer, { access: "public", contentType: `image/${ext}`, addRandomSuffix: false });

    const db = await getDb();
    await db.collection("media_library").insertOne({
      tenantId,
      type: "image",
      url: blob.url,
      filename: label,
      alt: label,
      size: buffer.length,
      generatedByAI: true,
      createdAt: new Date(),
      createdBy: userId,
    });

    return blob.url;
  } catch (error: any) {
    console.warn("Falha ao persistir imagem gerada por IA:", error?.message);
    return null;
  }
}

/**
 * Substitui blocos de imagem com data URIs base64 (vindos do RAG do PDF/PPTX) por
 * URLs reais no Vercel Blob. Sem isto, imagens grandes/numerosas ficam embutidas em
 * base64 diretamente no documento MongoDB do curso — com um PPTX rico em imagens,
 * a soma de todas as lições facilmente ultrapassa limites internos de buffer do
 * driver do Mongo, causando erros como "offset is out of range" ao gravar o curso.
 * `cache` evita re-carregar a mesma imagem quando é partilhada por várias lições
 * (o mesmo slide pode ser relevante para o RAG de mais do que uma lição).
 */
async function resolveImageBlocks(
  blocks: LessonBlock[],
  cache: Map<string, string>,
  tenantId: string,
  userId: string,
  label: string
): Promise<LessonBlock[]> {
  const resolved: LessonBlock[] = [];
  for (const block of blocks) {
    if (block.type === "image" && block.url && block.url.startsWith("data:")) {
      let blobUrl = cache.get(block.url);
      if (!blobUrl) {
        const uploaded = await persistGeneratedImage(block.url, tenantId, userId, label);
        if (uploaded) {
          blobUrl = uploaded;
          cache.set(block.url, uploaded);
        }
      }
      // Se o upload falhar, descarta o bloco em vez de gravar um base64 gigante no Mongo.
      if (blobUrl) resolved.push({ ...block, url: blobUrl });
      continue;
    }
    resolved.push(block);
  }
  return resolved;
}

export const maxDuration = 120; // Permitir processar

// Função em background assíncrona para geração lição a lição
async function runBackgroundGeneration(
  jobIdStr: string,
  courseIdStr: string,
  tenantId: string,
  userId: string,
  brief: any,
  outlineModules: any[]
) {
  try {
    const db = await getDb();
    const jobObjectId = new ObjectId(jobIdStr);
    const courseObjectId = new ObjectId(courseIdStr);

    const totalLessons = outlineModules.reduce((acc, m) => acc + (m.lessons || []).length, 0);
    let currentIdx = 0;

    const completedModules = [];
    // Partilhado entre lições: evita re-carregar a mesma imagem do RAG mais do que uma vez.
    const imageUploadCache = new Map<string, string>();

    for (const mod of outlineModules) {
      const completedLessons = [];

      for (const les of mod.lessons) {
        currentIdx++;
        // Atualizar estado da tarefa
        await db.collection("course_generation_jobs").updateOne(
          { _id: jobObjectId },
          {
            $set: {
              status: "PROCESSING",
              progress: Math.round(((currentIdx - 1) / totalLessons) * 100),
              currentLessonIndex: currentIdx,
              totalLessons,
              updatedAt: new Date(),
            },
          }
        );

        // 1. Pesquisa contextual RAG específica para os objetivos desta aula
        let contextChunks: ContextChunk[] = [];
        if (brief.briefingId) {
          contextChunks = await searchUploadedMaterials(brief.briefingId, `${les.title} ${les.objectives?.join(" ")}`, 4);
        }

        // 2. Chamar LLM para gerar conteúdo explicativo, código, quiz, etc. (em blocks[])
        const lessonDetails = await generateLesson(
          { topic: brief.topic, level: brief.level, objectives: brief.objectives },
          les.title,
          les.objectives || [],
          contextChunks
        );

        // Substituir imagens base64 do RAG (PDF/PPTX) por URLs reais no Blob — nunca
        // gravar base64 grande diretamente no documento MongoDB do curso.
        let blocks = await resolveImageBlocks(lessonDetails.blocks, imageUploadCache, tenantId, userId, les.title);

        // Se não havia nenhuma imagem nos materiais anexados (RAG), gerar uma
        // ilustração por IA para acompanhar a lição — evita gerar imagens
        // redundantes quando o material original do professor já as fornece.
        const hasRagImages = contextChunks.some((c) => (c.images || []).length > 0);
        if (!hasRagImages) {
          const imageDataUrl = await generateLessonImage(
            `Ilustração educativa, estilo diagrama minimalista, sobre: ${les.title} (${brief.topic})`
          );
          if (imageDataUrl) {
            const blobUrl = await persistGeneratedImage(imageDataUrl, tenantId, userId, les.title);
            if (blobUrl) {
              blocks = [...blocks, { id: newBlockId(), type: "image" as const, url: blobUrl, alt: les.title }];
            }
          }
        }

        // 3. Estruturar lição gerada — recalcular 'content' a partir dos blocks já
        // resolvidos (sem base64), já que lessonDetails.content ainda tem as imagens
        // originais embutidas em base64 (foi calculado antes de resolveImageBlocks).
        completedLessons.push({
          id: `lesson-${mod.order}-${completedLessons.length + 1}`,
          slug: `les-${mod.order}-${completedLessons.length + 1}-${les.title.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30)}`,
          title: les.title,
          objectives: les.objectives || [],
          content: blocksToPlainText(blocks),
          blocks,
          videoProvider: lessonDetails.videoProvider || "youtube",
          videoId: lessonDetails.videoId || "",
          exercises: lessonDetails.exercises || [],
          lab: lessonDetails.lab || "",
          resources: [],
        });
      }

      completedModules.push({
        id: `mod-${mod.order}`,
        title: mod.title,
        order: mod.order,
        lessons: completedLessons,
      });
    }

    // Gravar estrutura final completa no curso gerado
    await db.collection("courses").updateOne(
      { _id: courseObjectId },
      {
        $set: {
          modules: completedModules,
          updatedAt: new Date(),
        },
      }
    );

    // Finalizar Job
    await db.collection("course_generation_jobs").updateOne(
      { _id: jobObjectId },
      {
        $set: {
          status: "COMPLETED",
          progress: 100,
          resultCourseId: courseObjectId,
          updatedAt: new Date(),
        },
      }
    );

    await logAuditEvent(userId, "COURSE_AI_GENERATION_SUCCESS", {
      courseId: courseIdStr,
      jobId: jobIdStr,
    });
  } catch (error: any) {
    console.error("Erro na geração assíncrona do curso:", error);
    try {
      const db = await getDb();
      await db.collection("course_generation_jobs").updateOne(
        { _id: new ObjectId(jobIdStr) },
        {
          $set: {
            status: "FAILED",
            error: error.message,
            updatedAt: new Date(),
          },
        }
      );
    } catch {}
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const body = await req.json();
    const { jobId, outline } = body;

    if (!jobId || !outline) {
      return NextResponse.json({ error: "Parâmetros jobId e outline são obrigatórios." }, { status: 400 });
    }

    const db = await getDb();
    const job = await db.collection("course_generation_jobs").findOne({ _id: new ObjectId(jobId), tenant_id: tenantId });
    if (!job) {
      return NextResponse.json({ error: "Trabalho de geração não encontrado." }, { status: 404 });
    }

    // Determinar visibilidade (alunos geram privado, professores geram rascunho de inquilino)
    const activeRole = req.cookies.get("active-role")?.value || "ALUNO";
    const isPrivate = activeRole === "ALUNO";

    // Criar o documento de curso rascunho pendente de revisão
    const courseDoc = {
      tenant_id: tenantId,
      title: outline.title || job.brief.topic,
      description: outline.description || "",
      status: "DRAFT_PENDING_REVIEW",
      isPrivate,
      generatedByUserId: userId,
      isAIGenerated: true,
      modules: [], // A ser preenchido assincronamente
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const courseResult = await db.collection("courses").insertOne(courseDoc);
    const courseId = courseResult.insertedId;

    // Atualizar estado do job para início de processamento
    await db.collection("course_generation_jobs").updateOne(
      { _id: job._id },
      {
        $set: {
          status: "PROCESSING",
          outline,
          resultCourseId: courseId,
          updatedAt: new Date(),
        },
      }
    );

    // Executa a geração em background (assíncrona sem travar a resposta HTTP)
    runBackgroundGeneration(
      job._id.toString(),
      courseId.toString(),
      tenantId,
      userId,
      job.brief,
      outline.modules
    );

    // Retorna imediatamente com os metadados do curso criado
    return NextResponse.json({
      success: true,
      jobId: job._id.toString(),
      courseId: courseId.toString(),
      status: "PROCESSING",
    });
  } catch (error: any) {
    console.error("Erro ao iniciar geração assíncrona:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
