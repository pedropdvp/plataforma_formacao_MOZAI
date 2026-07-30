import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { computeSkillNodes, CURATED_SKILL_DEFS, ScoredSkillNode } from "@/lib/skills-os";

export async function GET(req: NextRequest) {
  try {
    // 1. Validar autenticação do Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Autenticação obrigatória." },
        { status: 401 }
      );
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    // 2. Buscar progresso e desempenho reais de todos os utilizadores deste tenant
    const [progressList, cognitiveLogs, quizAttempts, tenantUsers] = await Promise.all([
      db.collection("user_progress").find({ tenant_id: tenantId }).toArray(),
      db.collection("cognitive_logs").find({ tenant_id: tenantId }).toArray(),
      db.collection("quiz_attempts").find({ tenant_id: tenantId }).toArray(),
      db.collection("users").find({ "tenants.tenantId": tenantId }).toArray(),
    ]);

    // 3. Processar Métricas Corporativas (KPIs)
    const uniqueUserIds = Array.from(new Set(progressList.map((p: any) => p.userId)));
    const activeEmployees = uniqueUserIds.length;

    // Calcular taxa de conclusão média (lições completadas vs total de lições estimadas: 3 lições por curso em 3 cursos)
    const completedLessonsCount = progressList.filter((p: any) => p.status === "completed").length;
    const totalPossibleLessons = Math.max(uniqueUserIds.length * 9, 9);
    const completionRate = Math.round(Math.min((completedLessonsCount / totalPossibleLessons) * 100, 100));

    // Calcular total de horas de estudo (soma de watchTime em segundos convertidos para horas)
    const totalWatchSeconds = progressList.reduce((acc: number, curr: any) => acc + (curr.watchTime || 0), 0);
    const totalStudyHours = Math.round(totalWatchSeconds / 3600);

    // 4. Inventário de Competências — reaproveita o MESMO motor de pontuação contínua do
    // Skills OS (lib/skills-os.ts: média real de quiz + decaimento por inatividade), em
    // vez de números fixos por lição concluída. Corre por cada colaborador e agrega
    // (média entre quem já tem alguma pontuação = "coverage"), para dar uma visão real
    // de força/cobertura da empresa nesta competência.
    const perEmployeeNodes: ScoredSkillNode[][] = tenantUsers.map((u: any) => {
      const userProgress = progressList.filter((p: any) => p.userId === u._id);
      const userQuizAttempts = quizAttempts.filter((a: any) => a.userId === u._id);
      return computeSkillNodes(userProgress, userQuizAttempts);
    });

    const skillsInventory = CURATED_SKILL_DEFS.map((def) => {
      const scoresForSkill = perEmployeeNodes
        .map((nodes: ScoredSkillNode[]) => nodes.find((n) => n.id === def.id))
        .filter((n): n is ScoredSkillNode => !!n);
      const withScore = scoresForSkill.filter((n) => n.score > 0);
      const averageScore = withScore.length > 0 ? Math.round(withScore.reduce((sum: number, n) => sum + n.score, 0) / withScore.length) : 0;
      const coverage = scoresForSkill.length > 0 ? Math.round((withScore.length / scoresForSkill.length) * 100) : 0;
      return { name: def.label, averageScore, coverage };
    }).filter((s) => s.coverage > 0); // só mostra competências com pelo menos algum colaborador com dados reais

    // 5. Analisar logs cognitivos agregados para obter tendências corporativas — lê tanto
    // o formato atual (log.topic, string única, classificada por IA) como o legado
    // (log.topics[], simples palavras-chave) para não perder cobertura de nenhum dos dois.
    const searchTerms: Record<string, number> = {};
    cognitiveLogs.forEach((log: any) => {
      if (log.topic) {
        searchTerms[log.topic] = (searchTerms[log.topic] || 0) + 1;
      } else if (Array.isArray(log.topics)) {
        log.topics.forEach((word: string) => {
          searchTerms[word] = (searchTerms[word] || 0) + 1;
        });
      }
    });

    const sortedTerms = Object.entries(searchTerms)
      .sort((a, b) => b[1] - a[1])
      .map((entry) => entry[0])
      .slice(0, 3);

    // Sugestão de plano de equipa dinâmico baseado nas maiores dúvidas da equipa
    let teamPlan = "As equipas estão a focar em conceitos base. Sugerimos ativar mais mini-testes para consolidar lógica.";
    if (sortedTerms.length > 0) {
      teamPlan = `Detetámos que os colaboradores andam a pesquisar ativamente por "${sortedTerms.join(
        ", "
      )}". Sugerimos agendar uma aula ao vivo de tira-dúvidas sobre estes temas esta semana.`;
    }

    // 6. Inventário de Colaboradores (Employee List) — utilizadores reais deste tenant
    const employeeList = tenantUsers.map((u: any) => {
      const userProgress = progressList.filter((p: any) => p.userId === u._id);
      const userTopics = cognitiveLogs
        .filter((log: any) => log.userId === u._id)
        .flatMap((log: any) => (log.topic ? [log.topic] : Array.isArray(log.topics) ? log.topics : []));
      const tenantMapping = u.tenants?.find((t: any) => t.tenantId === tenantId);
      return {
        id: u._id,
        name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || "Utilizador",
        role: tenantMapping?.roles?.[0] || "Aluno",
        completedLessons: userProgress.filter((p: any) => p.status === "completed").length,
        activeCourses: Array.from(new Set(userProgress.map((p: any) => p.courseId))).length,
        interests: Array.from(new Set(userTopics)).slice(0, 3),
        isMe: u._id === userId,
      };
    });

    // 7. Plano Individual REAL: identifica o colaborador com a pontuação de competência
    // mais baixa entre quem já tem dados (nunca inventa um nome nem uma pontuação).
    let individualPlan = "Ainda não há dados de desempenho suficientes para um plano individual.";
    let worstScore = 101;
    perEmployeeNodes.forEach((nodes: ScoredSkillNode[], idx: number) => {
      const employee: any = tenantUsers[idx];
      nodes
        .filter((n) => n.score > 0)
        .forEach((n) => {
          if (n.score < worstScore) {
            worstScore = n.score;
            const empName = `${employee.firstName || ""} ${employee.lastName || ""}`.trim() || employee.email || "Este colaborador";
            individualPlan = `${empName} está com ${n.score}% de fluência em "${n.label}" — o ponto mais fraco identificado na equipa. Recomendamos reforço direcionado a esta competência.`;
          }
        });
    });

    // 8. Plano por Departamento (agrupado pelo perfil de acesso real de cada colaborador —
    // a plataforma ainda não tem um campo de "departamento" próprio, por isso usa o
    // agrupamento real que já existe, em vez de inventar uma unidade organizacional).
    const roleGroups: Record<string, { userIds: string[] }> = {};
    employeeList.forEach((emp: any) => {
      if (!roleGroups[emp.role]) roleGroups[emp.role] = { userIds: [] };
      roleGroups[emp.role].userIds.push(emp.id);
    });
    let departmentPlan = "Sem grupos de perfil suficientes para um plano por departamento.";
    let worstGroupAvg = 101;
    Object.entries(roleGroups).forEach(([role, group]) => {
      const groupScores = group.userIds
        .flatMap((uid) => {
          const idx = tenantUsers.findIndex((u: any) => u._id === uid);
          return idx >= 0 ? perEmployeeNodes[idx].filter((n: ScoredSkillNode) => n.score > 0).map((n: ScoredSkillNode) => n.score) : [];
        });
      if (groupScores.length === 0) return;
      const avg = Math.round(groupScores.reduce((s, v) => s + v, 0) / groupScores.length);
      if (avg < worstGroupAvg) {
        worstGroupAvg = avg;
        departmentPlan = `O grupo "${role}" tem a fluência média mais baixa da empresa (${avg}%), com base em ${groupScores.length} competência(s) medida(s). Considere priorizar formação para este grupo.`;
      }
    });

    // 7. Estatísticas Globais de Acessos para ADMIN/SUPORTE (Requisito do Utilizador)
    const activeRole = req.cookies.get("active-role")?.value;
    const isAdminOrSupport = activeRole === "ADMIN" || activeRole === "SUPORTE";

    let globalStats = null;
    if (isAdminOrSupport) {
      const allUsers = await db.collection("users").find({}).toArray();
      const allCompanies = await db.collection("tenants").find({}).toArray();

      // Suporte da empresa dona da plataforma (perfil SUPORTE em tenantId 'root')
      const supportUsersCount = allUsers.filter((u: any) =>
        u.tenants?.some((t: any) => t.tenantId === "root" && t.roles.includes("SUPORTE"))
      ).length;

      // Gestores de Empresa
      const gestoresEmpresa = allUsers.filter((u: any) =>
        u.tenants?.some((t: any) => t.roles.includes("GESTOR_EMPRESA"))
      ).map((u: any) => {
        const tenantMap = u.tenants.find((t: any) => t.roles.includes("GESTOR_EMPRESA"));
        const companyId = tenantMap?.tenantId;
        const company = allCompanies.find((c: any) => c._id.toString() === companyId);
        return {
          userName: `${u.firstName} ${u.lastName}`.trim(),
          email: u.email,
          companyName: company?.name || `Empresa (${companyId || "Desconhecido"})`
        };
      });

      // Gestores Académicos
      const academicManagersCount = allUsers.filter((u: any) =>
        u.tenants?.some((t: any) => t.roles.includes("GESTOR_ACADEMICO"))
      ).length;

      // Professores
      const professorsCount = allUsers.filter((u: any) =>
        u.tenants?.some((t: any) => t.roles.includes("PROFESSOR"))
      ).length;

      // Formadores
      const trainersCount = allUsers.filter((u: any) =>
        u.tenants?.some((t: any) => t.roles.includes("FORMADOR"))
      ).length;

      // Tutores
      const tutorsCount = allUsers.filter((u: any) =>
        u.tenants?.some((t: any) => t.roles.includes("TUTOR"))
      ).length;

      // Financeiro
      const financeCount = allUsers.filter((u: any) =>
        u.tenants?.some((t: any) => t.roles.includes("FINANCEIRO"))
      ).length;

      globalStats = {
        supportUsersCount,
        gestoresEmpresa,
        academicManagersCount,
        professorsCount,
        trainersCount,
        tutorsCount,
        financeCount
      };
    }

    // 9. Plano Global (ADMIN/SUPORTE): tendência real de dúvidas ao Tutor de IA em TODA a
    // plataforma (todos os tenants), não só desta empresa — só calculado para quem tem
    // visão global, para não misturar dados de outras empresas na visão de um Gestor Empresa.
    let globalPlan: string | null = null;
    if (isAdminOrSupport) {
      const allCognitiveLogs = await db.collection("cognitive_logs").find({}).toArray();
      const globalTopicCounts: Record<string, number> = {};
      allCognitiveLogs.forEach((log: any) => {
        const topic = log.topic || (Array.isArray(log.topics) ? log.topics[0] : null);
        if (topic) globalTopicCounts[topic] = (globalTopicCounts[topic] || 0) + 1;
      });
      const topGlobalTopics = Object.entries(globalTopicCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([topic]) => topic);

      globalPlan =
        topGlobalTopics.length > 0
          ? `Em toda a plataforma, os temas com mais dúvidas ao Tutor de IA são: "${topGlobalTopics.join(", ")}". Considere reforçar estes conteúdos no catálogo global.`
          : "Ainda não há interações suficientes com o Tutor de IA em toda a plataforma para um plano global.";
    }

    // Contagem real de lacunas críticas: competências da empresa com fluência média abaixo
    // de 40% (o mesmo limiar "Iniciado" usado no Skills OS) — não é uma regra fixa por
    // faixa de conclusão.
    const criticalGapsCount = skillsInventory.filter((s) => s.averageScore > 0 && s.averageScore < 40).length;

    return NextResponse.json({
      success: true,
      kpis: {
        activeEmployees,
        completionRate,
        totalStudyHours,
        criticalGapsCount,
      },
      skillsInventory,
      teamPlan,
      individualPlan,
      departmentPlan,
      globalPlan,
      employeeList,
      globalStats
    });
  } catch (error: any) {
    console.error("Erro ao processar estatísticas de RH:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
