import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { sanityClient } from "@/lib/sanity";

export const maxDuration = 45; // Permitir tempo suficiente para a chamada de IA B2B

const CATALOG_QUERY = `*[_type == "course"]{ _id, title, "category": coalesce(category->title, "Formação") }`;

const resultSchema = z.object({
  gapPercentage: z.number().describe("Percentagem de lacunas de competências para atingir o cargo (0 a 100)"),
  targetJob: z.string().describe("O cargo ideal recomendado pela IA com base no perfil analisado, em inglês e curto (ex: 'Backend Developer'), para ser usado numa pesquisa de vagas reais"),
  marketSalary: z.string().describe("Uma estimativa aproximada da faixa salarial típica para este cargo — é uma opinião do modelo, não um dado de mercado verificado"),
  studyTimeNeeded: z.string().describe("Tempo estimado de estudo dedicado necessário para colmatar o gap"),
  missingSkills: z.array(
    z.object({
      name: z.string().describe("Nome específico da competência técnica em falta"),
      importance: z.enum(["Crítica", "Alta", "Média", "Baixa"]).describe("Nível de importância da competência"),
      // Livre em vez de enum fixo — validado contra o catálogo real depois da geração,
      // para nunca apontar para um curso que já não existe ou nunca existiu.
      courseId: z.string().nullable().describe("ID exato de um dos cursos reais listados no prompt que colmata esta lacuna, ou null se nenhum servir"),
    })
  ),
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

    const { cvText } = await req.json();
    if (!cvText || !cvText.trim()) {
      return NextResponse.json(
        { error: "O texto do CV/LinkedIn é obrigatório para análise." },
        { status: 400 }
      );
    }

    // A LinkedIn bloqueia scraping automático de perfis (Termos de Serviço + proteção
    // técnica ativa) — não há forma de ir buscar o conteúdo real a partir de um link.
    // Analisar só o URL faria o modelo INVENTAR uma análise a partir de nada, o que
    // violaria o princípio de nunca fabricar resultados sem dados reais. Em vez disso,
    // se o texto for essencialmente só um link, pedimos ao aluno o PDF real do perfil
    // (exportável nativamente pela própria LinkedIn) — reaproveitando o mesmo extrator
    // já usado para o CV.
    const trimmed = cvText.trim();
    const isBareUrl = /^https?:\/\/\S+$/i.test(trimmed);
    const isShortLinkedInLink = /linkedin\.com\/in\//i.test(trimmed) && trimmed.length < 300;
    if (isBareUrl || isShortLinkedInLink) {
      return NextResponse.json(
        {
          error:
            "Não é possível analisar apenas um link da LinkedIn — a LinkedIn bloqueia o acesso automático a perfis. No seu perfil, abra \"Mais\" → \"Guardar como PDF\" e carregue esse ficheiro com o botão \"Carregar PDF/DOCX\" acima.",
        },
        { status: 422 }
      );
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";

    // 2. Catálogo REAL de cursos (Sanity + IA), para a IA só recomendar cursos que
    // realmente existem na plataforma neste momento — antes estava fixo a 4 cursos-demo
    // hardcoded, que deixavam de bater certo assim que qualquer curso novo era criado.
    const realCourses: { id: string; title: string; category: string }[] = [];
    try {
      const sanityCourses: any[] = await sanityClient.fetch(CATALOG_QUERY);
      for (const c of sanityCourses || []) realCourses.push({ id: c._id, title: c.title, category: c.category });
    } catch (e) {
      console.warn("Falha ao ler catálogo do Sanity para a análise de carreira:", e);
    }
    try {
      const db = await getDb();
      const aiCourses = await db.collection("courses").find({ tenant_id: tenantId, status: "PUBLISHED" }).limit(30).toArray();
      for (const c of aiCourses) realCourses.push({ id: c._id.toString(), title: c.title, category: "IA Custom" });
    } catch (e) {
      console.warn("Falha ao ler cursos IA para a análise de carreira:", e);
    }

    const catalogListing = realCourses.length > 0
      ? realCourses.slice(0, 40).map((c) => `- "${c.id}": ${c.title} (${c.category})`).join("\n")
      : "(Sem cursos disponíveis no catálogo neste momento — deixe courseId a null em todas as competências.)";

    // 3. Chamar o modelo GPT para extrair as métricas reais em JSON estruturado
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: resultSchema,
      prompt: `
        Analise o seguinte perfil profissional (CV ou link de portefólio):
        ---
        ${cvText}
        ---

        Associe cada lacuna identificada, quando fizer sentido, a um dos seguintes cursos REAIS
        atualmente disponíveis na MOZAI — use exatamente o ID indicado entre aspas, ou null se
        nenhum curso da lista cobrir essa competência (nunca invente um ID que não esteja aqui):
        ${catalogListing}

        Forneça uma resposta detalhada em português. O "marketSalary" e o "studyTimeNeeded" são
        estimativas da sua parte, não dados de mercado verificados — não apresente números com
        falsa precisão.
      `,
    });

    // 4. Validar courseId contra o catálogo real — se a IA "alucinar" um ID inexistente
    // (acontece, mesmo com a lista no prompt), cai para null em vez de apontar para um
    // curso que não existe (link partido para o aluno).
    const realCourseIds = new Set(realCourses.map((c) => c.id));
    const missingSkills = object.missingSkills.map((skill) => ({
      ...skill,
      courseId: skill.courseId && realCourseIds.has(skill.courseId) ? skill.courseId : null,
    }));

    // 5. "Quem está a contratar?" — vagas REAIS via API pública da Remotive (gratuita,
    // sem chave), em vez de nomes de empresas e contagens de vagas inventados pela IA.
    // Isto substitui por completo o antigo "hiringCompanies" fabricado pelo modelo.
    let hiringJobs: { title: string; companyName: string; location: string; url: string }[] = [];
    try {
      const searchTerm = encodeURIComponent(object.targetJob);
      const remotiveRes = await fetch(`https://remotive.com/api/remote-jobs?search=${searchTerm}&limit=5`, {
        signal: AbortSignal.timeout(8000),
      });
      if (remotiveRes.ok) {
        const remotiveData = await remotiveRes.json();
        hiringJobs = (remotiveData.jobs || []).slice(0, 5).map((j: any) => ({
          title: j.title,
          companyName: j.company_name,
          location: j.candidate_required_location || "Remoto",
          url: j.url,
        }));
      }
    } catch (e) {
      console.warn("Falha ao consultar vagas reais na Remotive:", e);
    }

    return NextResponse.json({
      success: true,
      analysis: {
        ...object,
        missingSkills,
        hiringJobs,
        isEstimate: true,
      },
    });
  } catch (error: any) {
    console.error("Erro na análise do Career OS:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
