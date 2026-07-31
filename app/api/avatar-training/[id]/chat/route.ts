import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { debitCredits } from "@/lib/ai-credits";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { ObjectId } from "mongodb";
import { logAuditEvent } from "@/lib/audit";

export const maxDuration = 30;

// POST — Conversa REAL de treino com o avatar: o system prompt é construído a partir dos
// campos reais definidos na criação do avatar (papel, tema, cenário, dificuldade) — nunca uma
// resposta genérica pré-escrita. Usa o mesmo motor de IA de toda a plataforma.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { id } = await params;
    const { messages } = await req.json();
    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "Parâmetro 'messages' é obrigatório." }, { status: 400 });
    }

    const db = await getDb();
    let avatar: any;
    try {
      avatar = await db.collection("training_avatars").findOne({ _id: new ObjectId(id) });
    } catch {
      avatar = null;
    }
    if (!avatar) {
      return NextResponse.json({ error: "Avatar não encontrado." }, { status: 404 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const newBalance = await debitCredits(tenantId, userId, 1);
    if (newBalance === null) {
      return NextResponse.json({ error: "Saldo de Créditos IA insuficiente. Recarregue em Créditos IA para continuar." }, { status: 402 });
    }

    const difficultyNote =
      avatar.difficulty === "Difícil"
        ? "Sê exigente, questiona respostas fracas ou incompletas, e não cedas facilmente."
        : avatar.difficulty === "Médio"
          ? "Sê equilibrado: desafia o aluno mas dá espaço para ele corrigir o rumo."
          : "Sê encorajador e paciente, guiando o aluno passo a passo.";

    const systemPrompt = `És ${avatar.name}, no papel de "${avatar.role}", numa simulação de treino REAL sobre o tema "${avatar.subject}".
Cenário: ${avatar.scenario}
Nível de dificuldade: ${avatar.difficulty} — ${difficultyNote}

Mantém-te sempre fiel a este papel e a este tema. Conduz a simulação como uma conversa real (perguntas, objeções, desafios) sobre "${avatar.subject}", nunca saindo do cenário. Se o aluno perguntar algo completamente fora do tema, traz a conversa de volta ao cenário com naturalidade. Nunca inventes factos técnicos sobre "${avatar.subject}" que não sejam corretos.`;

    after(async () => {
      try {
        await logAuditEvent(userId, "AVATAR_TRAINING_CHAT", { tenantId, avatarId: id });
        await db.collection("training_avatars").updateOne({ _id: new ObjectId(id) }, { $inc: { usesCount: 1 } });
      } catch (e) {
        console.warn("Erro ao registar uso do avatar de treino:", e);
      }
    });

    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      messages,
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error("Erro no chat de treino com avatar:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
