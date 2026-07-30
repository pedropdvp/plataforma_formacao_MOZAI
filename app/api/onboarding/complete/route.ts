import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

// POST — Marca o onboarding inicial como concluído para o utilizador autenticado, para
// o guia de boas-vindas nunca mais reaparecer depois da primeira vez que é fechado.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const db = await getDb();
    await db.collection("users").updateOne(
      { _id: userId },
      { $set: { onboardingCompletedAt: new Date() } }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao concluir onboarding:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
