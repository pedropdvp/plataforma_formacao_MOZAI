import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { findOneTenantScoped, getDb } from "@/lib/mongodb";
import { isChatbotLang, type ChatbotLang } from "@/lib/ai/chatbot-engine";

/**
 * Perguntas sugeridas que o widget mostra numa conversa vazia.
 *
 * Um chat que abre em branco não diz ao utilizador o que pode perguntar — e numa
 * demonstração é o momento em que se hesita. Estas sugestões são editáveis por empresa,
 * porque o que faz sentido perguntar numa academia não é o que faz sentido numa empresa
 * cliente.
 */

const MAX_SUGESTOES = 6;
const MAX_LEN = 120;

const OMISSAO: Record<ChatbotLang, string[]> = {
  pt: [
    "Que cursos existem na plataforma?",
    "Como acompanho o meu progresso?",
    "Como emito o meu certificado?",
  ],
  en: [
    "Which courses are available?",
    "How do I track my progress?",
    "How do I get my certificate?",
  ],
  fr: [
    "Quels cours sont disponibles ?",
    "Comment suivre ma progression ?",
    "Comment obtenir mon certificat ?",
  ],
};

/** Aceita apenas listas de strings não vazias, aparadas e com tecto — o que vem do painel
 *  é texto livre de um administrador, e vai ser mostrado a toda a gente. */
function limparSugestoes(entrada: unknown): Record<string, string[]> {
  const limpo: Record<string, string[]> = {};
  if (!entrada || typeof entrada !== "object") return limpo;

  for (const [lang, valores] of Object.entries(entrada as Record<string, unknown>)) {
    if (!isChatbotLang(lang) || !Array.isArray(valores)) continue;
    limpo[lang] = valores
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim().slice(0, MAX_LEN))
      .filter(Boolean)
      .slice(0, MAX_SUGESTOES);
  }
  return limpo;
}

/** GET — Sugestões do idioma pedido. Qualquer utilizador autenticado, porque é o widget
 *  que as consome e o widget está em todo o dashboard. */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  const tenantId = req.headers.get("x-tenant-id") || "root";
  const lang: ChatbotLang = isChatbotLang(req.nextUrl.searchParams.get("lang"))
    ? (req.nextUrl.searchParams.get("lang") as ChatbotLang)
    : "pt";

  try {
    const settings = await findOneTenantScoped("tenant_settings", tenantId);
    const guardadas = settings?.chatbotSuggestions?.[lang];
    const sugestoes = Array.isArray(guardadas) && guardadas.length ? guardadas : OMISSAO[lang];
    return NextResponse.json({ success: true, suggestions: sugestoes });
  } catch (error) {
    // Sem sugestões o widget continua utilizável — não vale a pena devolver erro.
    console.error("[chatbot] falha ao ler sugestões:", error);
    return NextResponse.json({ success: true, suggestions: OMISSAO[lang] });
  }
}

/** PUT — Grava as sugestões das três línguas. Restrito a quem gere o ChatBot. */
export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  const activeRole = req.cookies.get("active-role")?.value;
  if (!activeRole || !["ADMIN", "SUPORTE", "GESTOR_EMPRESA"].includes(activeRole)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const tenantId = req.headers.get("x-tenant-id") || "root";
  const body = await req.json().catch(() => ({}));
  const sugestoes = limparSugestoes(body.suggestions);

  try {
    // upsert, pelo mesmo motivo de `setTenantApiKey`: uma empresa pode ainda não ter
    // nenhum documento em tenant_settings quando define as sugestões pela primeira vez.
    const db = await getDb();
    await db.collection("tenant_settings").updateOne(
      { tenant_id: tenantId },
      { $set: { tenant_id: tenantId, chatbotSuggestions: sugestoes, chatbotSuggestionsUpdatedAt: new Date() } },
      { upsert: true }
    );
    return NextResponse.json({ success: true, suggestions: sugestoes });
  } catch (error) {
    console.error("[chatbot] falha ao guardar sugestões:", error);
    return NextResponse.json({ error: "Erro ao guardar as sugestões." }, { status: 500 });
  }
}
