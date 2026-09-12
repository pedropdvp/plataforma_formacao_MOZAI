import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { getStudentsForStaff } from "@/lib/academics";

/**
 * GET — Os alunos pelos quais o docente autenticado é responsável, com o desempenho de cada um.
 *
 * Não recebe o docente por parâmetro: é sempre quem está autenticado. Um docente não vê os alunos
 * de outro, e não há como pedir a lista de terceiros mudando um id no endereço.
 *
 * `?studentId=` restringe ao relatório individual — e só devolve esse aluno se ele estiver mesmo
 * à responsabilidade de quem pergunta.
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const pedido = req.nextUrl.searchParams.get("studentId");
    const db = await getDb();

    const responsaveis = await getStudentsForStaff(tenantId, userId);
    const alvo = pedido ? responsaveis.filter((r) => r.studentId === pedido) : responsaveis;

    if (pedido && alvo.length === 0) {
      return NextResponse.json(
        { error: "Este aluno não está à sua responsabilidade." },
        { status: 403 }
      );
    }

    const ids = alvo.map((a) => a.studentId);
    if (ids.length === 0) {
      return NextResponse.json({ success: true, students: [] });
    }

    const [pessoas, inscricoes, progresso, tentativas, historico] = await Promise.all([
      db.collection("users").find({ _id: { $in: ids } }).toArray(),
      db.collection("assigned_courses").find({ tenantId, userId: { $in: ids } }).toArray(),
      db.collection("user_progress").find({ tenant_id: tenantId, userId: { $in: ids } }).toArray(),
      db.collection("quiz_attempts").find({ tenant_id: tenantId, userId: { $in: ids } }).toArray(),
      db.collection("study_history").find({ tenant_id: tenantId, userId: { $in: ids } }).toArray(),
    ]);

    const porAluno = <T extends { userId?: string }>(lista: T[], id: string) =>
      lista.filter((x) => String(x.userId) === id);

    const students = alvo.map((rel) => {
      const pessoa: any = pessoas.find((p: any) => String(p._id) === rel.studentId);
      const suasTentativas = porAluno(tentativas as any[], rel.studentId);
      const suasLicoes = porAluno(progresso as any[], rel.studentId);
      const seuHistorico = porAluno(historico as any[], rel.studentId);

      const somaNotas = suasTentativas.reduce((acc: number, t: any) => acc + (t.score || 0), 0);
      const datas = seuHistorico
        .map((h: any) => h.updatedAt || h.createdAt || h.date)
        .filter(Boolean)
        .map((d: any) => new Date(d).getTime())
        .filter((n: number) => !Number.isNaN(n));

      return {
        id: rel.studentId,
        name: pessoa ? `${pessoa.firstName || ""} ${pessoa.lastName || ""}`.trim() || pessoa.email : rel.studentId,
        email: pessoa?.email || null,
        via: rel.via,
        assignedCoursesCount: porAluno(inscricoes as any[], rel.studentId).length,
        sharedCoursesCount: rel.sharedCourseIds.length,
        lessonsCompleted: suasLicoes.filter((p: any) => p.status === "completed").length,
        lessonsStarted: suasLicoes.length,
        quizAttempts: suasTentativas.length,
        // Sem tentativas não há média. Zero seria uma nota, e uma nota que ninguém tirou.
        averageQuizScore:
          suasTentativas.length > 0 ? Math.round((somaNotas / suasTentativas.length) * 100) : null,
        lastActivityAt: datas.length > 0 ? new Date(Math.max(...datas)).toISOString() : null,
      };
    });

    students.sort((a, b) => a.name.localeCompare(b.name, "pt"));

    return NextResponse.json({ success: true, students });
  } catch (error: any) {
    console.error("Erro ao listar os alunos do docente:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
