import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getEffectiveAgents } from "@/lib/ai-agents-catalog";

// GET — Lista o catálogo curado de agentes especializados (sem o system prompt completo,
// só o necessário para os apresentar). Reflete edições/remoções feitas por Admin/Gestor
// Académico/Formador a partir da plataforma.
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
  }

  const agents = await getEffectiveAgents();

  return NextResponse.json({
    success: true,
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      category: a.category,
      description: a.description,
      scopeNote: a.scopeNote || null,
    })),
  });
}
