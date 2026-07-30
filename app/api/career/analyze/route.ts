import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

export const maxDuration = 45; // Permitir tempo suficiente para a chamada de IA B2B

const resultSchema = z.object({
  gapPercentage: z.number().describe("Percentagem de lacunas de competências para atingir o cargo (0 a 100)"),
  targetJob: z.string().describe("O cargo ideal recomendado pela IA com base no perfil analisado"),
  marketSalary: z.string().describe("A faixa salarial de mercado típica para este cargo no formato string"),
  studyTimeNeeded: z.string().describe("Tempo estimado de estudo dedicado necessário para colmatar o gap"),
  missingSkills: z.array(
    z.object({
      name: z.string().describe("Nome específico da competência técnica em falta"),
      importance: z.enum(["Crítica", "Alta", "Média", "Baixa"]).describe("Nível de importância da competência"),
      courseId: z.enum(["course-1", "course-2", "course-3", "course-4"]).describe("ID do curso da MOZAI associado"),
    })
  ),
  hiringCompanies: z.array(
    z.object({
      name: z.string().describe("Nome da empresa tecnológica real ou B2B"),
      location: z.string().describe("Modelo de trabalho e localização (ex: 'Lisboa (Híbrido)' ou 'Maputo (Presencial)')"),
      openRoles: z.number().describe("Número de vagas abertas estimadas para este perfil"),
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

    // 2. Chamar o modelo GPT para extrair as métricas reais em JSON estruturado
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: resultSchema,
      prompt: `
        Analise o seguinte perfil profissional (CV ou link de portefólio):
        ---
        ${cvText}
        ---

        Associe as lacunas identificadas a um ou mais dos seguintes cursos de aceleração tecnológica disponíveis na MOZAI:
        - "course-1": Engenharia de IA e RAG Avançado (FastAPI, Python, Embeddings, AWS Titan, RAG, Orquestração de Agentes)
        - "course-2": Next.js 16 e Arquiteturas Composable SaaS (React Server Components, Clerk, WorkOS B2B SSO, Sanity CMS)
        - "course-3": Smart Contracts e Criptografia com Solidity (Solidity Core, EVM, ERC-20, ERC-721, auditoria de segurança)
        - "course-4": Curso de Criptomoedas: Fundamentos (Origem das criptomoedas, Bitcoin, Ethereum, Blockchain, Altcoins, Stablecoins, DeFi, Exchanges, Wallets, Pedro Varela Pinto)

        Forneça uma resposta detalhada em português, estimando o salário médio, vagas abertas e o percurso de aceleração.
      `,
    });

    return NextResponse.json({
      success: true,
      analysis: object,
    });
  } catch (error: any) {
    console.error("Erro na análise do Career OS:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
