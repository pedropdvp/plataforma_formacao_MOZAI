import React from "react";
import Link from "next/link";
import { PortableText, PortableTextComponents } from "@portabletext/react";
import AiTutorSidebar from "@/components/ai-tutor-sidebar";
import LessonFooter from "@/components/lesson-footer";
import { sanityClient, urlFor, GET_COURSE_BY_ID_QUERY, GET_LESSON_QUERY } from "@/lib/sanity";
import { ArrowLeft, Play, FileText, ExternalLink, CheckCircle2, ShieldAlert } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { headers } from "next/headers";
import { BlockRenderer } from "@/components/lesson-blocks/BlockRenderer";
import { CourseMapButton } from "@/components/lesson-blocks/CourseMapCanvas";
import { getOrMigrateBlocks } from "@/lib/lesson-blocks";

// ---------------------------------------------------------------------------
// Fallback estático para os cursos-demo que ainda não existem no Sanity.
// Assim que um curso é criado no Studio, a página passa a ler o conteúdo real.
// ---------------------------------------------------------------------------
const COURSES_DATA: Record<string, {
  title: string;
  lessons: Array<{ id: string; title: string; duration: string; slug: string; description: string }>;
}> = {
  "course-1": {
    title: "Engenharia de IA e RAG Avançado",
    lessons: [
      { id: "lesson-1.1", title: "Introdução à Engenharia de IA e Tutoria Activa", duration: "12m", slug: "lesson-1-1", description: "Compreenda a mudança do paradigma de e-learning estático para tutoria ativa por IA." },
      { id: "lesson-1.2", title: "Configuração do Embeddings Pipeline com Titan", duration: "24m", slug: "lesson-1-2", description: "Configuração de embeddings com o AWS Titan em lote com Vercel AI SDK." },
      { id: "lesson-1.3", title: "Pesquisa Semântica Scoped com MongoDB Atlas", duration: "18m", slug: "lesson-1-3", description: "Implementação de busca por similaridade de cosseno com restrição estrita de tenant_id." },
    ],
  },
  "course-2": {
    title: "Next.js 16 e Arquiteturas Composable SaaS",
    lessons: [
      { id: "lesson-1.1", title: "Introdução ao Next.js 16 App Router", duration: "15m", slug: "lesson-1-1", description: "Conceitos de Server Components, Client Components e renderização híbrida no Next.js 16." },
      { id: "lesson-1.2", title: "Autenticação e SSO Multilocação (Clerk/WorkOS)", duration: "20m", slug: "lesson-1-2", description: "Integrando Clerk nextjs e WorkOS no middleware para isolamento lógico de organizações." },
      { id: "lesson-1.3", title: "Estruturação de Dados com Sanity Headless CMS", duration: "22m", slug: "lesson-1-3", description: "Modelagem de schemas de cursos e lições no Sanity usando GROQ e Portable Text." },
    ],
  },
  "course-3": {
    title: "Smart Contracts e Criptografia com Solidity",
    lessons: [
      { id: "lesson-1.1", title: "Fundamentos da EVM e Smart Contracts", duration: "18m", slug: "lesson-1-1", description: "Compreendendo a Máquina Virtual Ethereum (EVM), blocos de transações e Solidity." },
      { id: "lesson-1.2", title: "Construindo Tokens ERC-20 e Padrões ERC-721", duration: "28m", slug: "lesson-1-2", description: "Implementação e deploy de tokens fungíveis e não-fungíveis utilizando OpenZeppelin." },
      { id: "lesson-1.3", title: "Auditoria e Segurança contra Opcodes Vulneráveis", duration: "25m", slug: "lesson-1-3", description: "Como evitar reentrancy, overflow e bugs comuns em Smart Contracts no ecossistema Web3." },
    ],
  },
};

// Componentes de renderização do Portable Text (estilo escuro da plataforma)
const ptComponents: PortableTextComponents = {
  block: {
    normal: ({ children }) => <p className="text-sm text-slate-300 leading-relaxed">{children}</p>,
    h2: ({ children }) => <h2 className="text-lg font-bold text-white mt-6 mb-1">{children}</h2>,
    h3: ({ children }) => <h3 className="text-base font-semibold text-white mt-4 mb-1">{children}</h3>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-indigo-500/50 pl-4 text-slate-400 italic">{children}</blockquote>
    ),
  },
  list: {
    bullet: ({ children }) => <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-300">{children}</ul>,
    number: ({ children }) => <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-300">{children}</ol>,
  },
  marks: {
    strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
  },
  types: {
    code: ({ value }) => (
      <pre className="rounded-xl border border-slate-800 bg-slate-950 p-4 overflow-x-auto text-xs text-slate-200 font-mono">
        <code>{value?.code}</code>
      </pre>
    ),
    // Imagens nativas do Sanity (Portable Text, campo "content" dos cursos curados no Studio)
    image: ({ value }) => (
      <img
        src={urlFor(value).width(900).url()}
        alt={value?.alt || ""}
        className="rounded-2xl border border-slate-800 max-w-full h-auto"
      />
    ),
    // Imagens extraídas de PDF/PPTX e embutidas em base64 nas lições geradas por IA (MongoDB)
    customImage: ({ value }) => (
      <img
        src={value?.url}
        alt={value?.alt || "Imagem do material original"}
        className="rounded-2xl border border-slate-800 max-w-full h-auto"
      />
    ),
  },
};

interface LessonPageProps {
  params: Promise<{ courseId: string; lessonId: string }>;
}

interface NavLesson { slug: string; title: string; duration: string }

// Player de vídeo real (Mux / YouTube) ou marcador quando ainda não há vídeo.
function VideoBlock({ provider, videoId }: { provider?: string; videoId?: string }) {
  if (videoId && provider === "mux") {
    return (
      <div className="relative rounded-3xl overflow-hidden aspect-video bg-black border border-slate-800 shadow-2xl">
        <iframe
          src={`https://player.mux.com/${videoId}`}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          title="Vídeo da lição"
        />
      </div>
    );
  }
  if (videoId && provider === "youtube") {
    const id = videoId.includes("http")
      ? (videoId.split("v=")[1]?.split("&")[0] || videoId.split("/").pop())
      : videoId;
    return (
      <div className="relative rounded-3xl overflow-hidden aspect-video bg-black border border-slate-800 shadow-2xl">
        <iframe
          src={`https://www.youtube.com/embed/${id}`}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="Vídeo da lição"
        />
      </div>
    );
  }
  // Sem vídeo configurado
  return (
    <div className="relative rounded-3xl overflow-hidden aspect-video bg-slate-900 border border-slate-800 flex flex-col items-center justify-center gap-3 shadow-2xl">
      <div className="p-5 rounded-full bg-slate-800 text-slate-500">
        <Play className="h-10 w-10 fill-slate-500" />
      </div>
      <span className="text-[11px] text-slate-500">Vídeo por configurar — edite esta lição e defina um vídeo (YouTube ou Mux) no campo "Vídeo Principal".</span>
    </div>
  );
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { courseId, lessonId } = await params;

  const { userId } = await auth();
  const headersList = await headers();
  const tenantId = headersList.get("x-tenant-id") || "root";

  // Se o aluno pertence a uma empresa B2B (tenantId !== 'root')
  // garantimos que o curso está explicitamente atribuído a este utilizador
  if (userId && tenantId !== "root") {
    const db = await getDb();
    const isAssigned = await db.collection("assigned_courses").findOne({ tenantId, userId, courseId });
    if (!isAssigned) {
      return (
        <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center text-center space-y-4 px-6">
          <div className="p-4 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold text-white">Curso Não Atribuído</h1>
          <p className="text-sm text-slate-400 max-w-[450px]">
            Este curso não está atribuído ao seu plano de estudos. Por favor, solicite a atribuição ao gestor ou funcionário da sua empresa.
          </p>
          <Link href="/dashboard" className="inline-flex h-10 px-6 items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all">
            Voltar ao Dashboard
          </Link>
        </div>
      );
    }
  }

  // 1. Tentar carregar o curso REAL do Sanity
  let course: any = null;
  try {
    course = await sanityClient.fetch(GET_COURSE_BY_ID_QUERY, { id: courseId });
  } catch (e) {
    console.warn("Sanity indisponível ao carregar o curso:", e);
  }

  // --- Caminho A: curso real do Sanity ---------------------------------------
  if (course) {
    const lessons: NavLesson[] = (course.modules || [])
      .flatMap((m: any) => m.lessons || [])
      .filter(Boolean)
      .map((l: any) => ({ slug: l.slug, title: l.title, duration: l.duration ? `${l.duration}m` : "" }));

    const activeSlug = lessons.find((l) => l.slug === lessonId)?.slug || lessons[0]?.slug;

    let lesson: any = null;
    try {
      lesson = await sanityClient.fetch(GET_LESSON_QUERY, { slug: activeSlug });
    } catch (e) {
      console.warn("Sanity indisponível ao carregar a lição:", e);
    }

    const idx = lessons.findIndex((l) => l.slug === activeSlug);
    const next = lessons[idx + 1];

    const parsedExercises = (lesson?.exercises || []).map((ex: any) => ({
      question: ex.question,
      options: ex.options || [],
      correct: ex.options ? (ex.options[ex.correctIndex] || ex.options[0] || "") : "",
    }));

    return (
      <LessonShell
        courseId={courseId}
        courseTitle={course.title}
        lessons={lessons}
        activeSlug={activeSlug}
        title={lesson?.title || lessons[idx]?.title || "Lição"}
        video={{ provider: lesson?.videoProvider, id: lesson?.videoId }}
        content={lesson?.content}
        resources={lesson?.resources || []}
        nextHref={next ? `/dashboard/courses/${courseId}/lessons/${next.slug}` : null}
        exercises={parsedExercises}
      />
    );
  }

  // 2. Tentar carregar o curso do MongoDB (se gerado por IA)
  let aiCourse: any = null;
  if (!course) {
    try {
      const { getDb } = await import("@/lib/mongodb");
      const db = await getDb();
      const { ObjectId } = await import("mongodb");
      let queryId: any = courseId;
      try {
        queryId = new ObjectId(courseId);
      } catch {}
      aiCourse = await db.collection("courses").findOne({
        tenant_id: tenantId,
        _id: queryId
      });
    } catch (e) {
      console.warn("Erro ao carregar curso de IA do MongoDB:", e);
    }
  }

  if (aiCourse) {
    const lessons: NavLesson[] = (aiCourse.modules || [])
      .flatMap((m: any) => m.lessons || [])
      .filter(Boolean)
      .map((l: any) => ({
        slug: l.slug || l.id,
        title: l.title,
        duration: l.duration ? (l.duration.endsWith("m") ? l.duration : `${l.duration}m`) : "15m"
      }));

    const activeSlug = lessons.find((l) => l.slug === lessonId)?.slug || lessons[0]?.slug;
    const activeLesson = (aiCourse.modules || [])
      .flatMap((m: any) => m.lessons || [])
      .find((l: any) => (l.slug === activeSlug || l.id === activeSlug));

    const idx = lessons.findIndex((l) => l.slug === activeSlug);
    const next = lessons[idx + 1];

    const parsedExercises = (activeLesson?.exercises || []).map((ex: any) => ({
      question: ex.question,
      options: ex.options || [],
      correct: ex.options ? (ex.options[ex.correctIndex] || ex.options[0] || "") : "",
    }));

    // Lições geradas por IA: usar blocks[] estruturados quando existirem; lições
    // antigas (só com 'content' em Markdown) são migradas automaticamente para blocos.
    const lessonBlocks = getOrMigrateBlocks(activeLesson || {});

    return (
      <LessonShell
        courseId={courseId}
        courseTitle={aiCourse.title}
        lessons={lessons}
        activeSlug={activeSlug}
        title={activeLesson?.title || lessons[idx]?.title || "Lição"}
        video={{ provider: activeLesson?.videoProvider, id: activeLesson?.videoId }}
        lessonBlocks={lessonBlocks}
        courseModules={aiCourse.modules}
        resources={activeLesson?.resources || []}
        nextHref={next ? `/dashboard/courses/${courseId}/lessons/${next.slug}` : null}
        exercises={parsedExercises}
      />
    );
  }

  // --- Caminho B: fallback para cursos-demo estáticos ------------------------
  const demo = COURSES_DATA[courseId] || COURSES_DATA["course-1"];
  const demoLessons: NavLesson[] = demo.lessons.map((l) => ({ slug: l.slug, title: l.title, duration: l.duration }));
  const active = demo.lessons.find((l) => l.slug === lessonId) || demo.lessons[0];
  const idx = demo.lessons.findIndex((l) => l.slug === active.slug);
  const next = demo.lessons[idx + 1];

  return (
    <LessonShell
      courseId={courseId}
      courseTitle={demo.title}
      lessons={demoLessons}
      activeSlug={active.slug}
      title={active.title}
      description={active.description}
      video={{}}
      resources={[]}
      nextHref={next ? `/dashboard/courses/${courseId}/lessons/${next.slug}` : null}
    />
  );
}

// ---------------------------------------------------------------------------
// Shell partilhado de renderização da lição
// ---------------------------------------------------------------------------
function LessonShell(props: {
  courseId: string;
  courseTitle: string;
  lessons: NavLesson[];
  activeSlug: string;
  title: string;
  description?: string;
  content?: any[];
  lessonBlocks?: import("@/lib/lesson-blocks").LessonBlock[];
  courseModules?: any[];
  video: { provider?: string; id?: string };
  resources: { title: string; url: string }[];
  nextHref: string | null;
  exercises?: Array<{ question: string; options: string[]; correct: string }>;
}) {
  const { courseId, courseTitle, lessons, activeSlug, title, description, content, lessonBlocks, courseModules, video, resources, nextHref, exercises } = props;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-slate-950 -m-8">
      {/* Esquerda: Player + conteúdo */}
      <div className="flex-1 overflow-y-auto p-8 flex flex-col justify-between">
        <div className="space-y-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2">
            <Link href="/dashboard/catalog" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar ao Catálogo
            </Link>
            <span className="text-slate-700">/</span>
            <span className="text-xs text-slate-500 font-medium truncate max-w-[240px]">{courseTitle}</span>
            {courseModules && courseModules.length > 0 && (
              <>
                <span className="text-slate-700">/</span>
                <CourseMapButton courseTitle={courseTitle} modules={courseModules} />
              </>
            )}
          </div>

          <VideoBlock provider={video.provider} videoId={video.id} />

          {/* Título */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white leading-tight">{title}</h1>
          </div>

          {/* Conteúdo: blocks[] (cursos gerados por IA), Portable Text (Sanity) ou descrição demo */}
          <div className="border-t border-slate-900 pt-6 space-y-3">
            {lessonBlocks ? (
              <BlockRenderer blocks={lessonBlocks} courseId={courseId} lessonKey={activeSlug} lessons={lessons} />
            ) : content && content.length > 0 ? (
              <PortableText value={content} components={ptComponents} />
            ) : (
              <p className="text-sm text-slate-400 leading-relaxed max-w-3xl">
                {description || "Conteúdo desta lição ainda em preparação."}
              </p>
            )}
          </div>

          {/* Recursos de apoio (se existirem) */}
          {resources.length > 0 && (
            <div className="border-t border-slate-900 pt-6">
              <h3 className="font-semibold text-sm text-white mb-4">Recursos da Aula</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {resources.map((r, i) => (
                  <a
                    key={i}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-slate-900 bg-slate-900/10 rounded-2xl p-4 flex items-center justify-between hover:bg-slate-900/20 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-indigo-400" />
                      <span className="block text-xs font-bold text-slate-200">{r.title}</span>
                    </div>
                    <ExternalLink className="h-4 w-4 text-slate-500" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Índice de aulas do curso */}
          {lessons.length > 1 && (
            <div className="border-t border-slate-900 pt-6">
              <h3 className="font-semibold text-sm text-white mb-3">Aulas do curso ({lessons.length})</h3>
              <ol className="space-y-1">
                {lessons.map((l, i) => {
                  const isActive = l.slug === activeSlug;
                  return (
                    <li key={l.slug}>
                      <Link
                        href={`/dashboard/courses/${courseId}/lessons/${l.slug}`}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-colors ${
                          isActive ? "bg-indigo-600/10 border border-indigo-500/20 text-white font-semibold" : "text-slate-400 hover:bg-slate-900 hover:text-white border border-transparent"
                        }`}
                      >
                        <span className={`flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-mono ${isActive ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 lesson-index-num"}`}>
                          {i + 1}
                        </span>
                        <span className="flex-1 truncate">{l.title}</span>
                        {l.duration && <span className="text-[10px] text-slate-600">{l.duration}</span>}
                        {isActive && <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400" />}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>

        {/* Footer de navegação */}
        <LessonFooter courseId={courseId} lessonId={activeSlug} nextLessonHref={nextHref} exercises={exercises} />
      </div>

      {/* Direita: Tutor de IA (RAG) */}
      <AiTutorSidebar courseId={courseId} />
    </div>
  );
}
