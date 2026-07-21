import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

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

    // 2. Buscar progresso de todos os utilizadores deste tenant
    const progressList = await db.collection("user_progress").find({ tenantId }).toArray();
    const cognitiveLogs = await db.collection("cognitive_logs").find({ tenantId }).toArray();

    // 3. Processar Métricas Corporativas (KPIs)
    const uniqueUserIds = Array.from(new Set(progressList.map((p: any) => p.userId)));
    const activeEmployees = Math.max(uniqueUserIds.length, 3); // Mínimo 3 simulado se vazio

    // Calcular taxa de conclusão média (lições completadas vs total de lições estimadas: 3 lições por curso em 3 cursos)
    const completedLessonsCount = progressList.filter((p: any) => p.status === "completed").length;
    const totalPossibleLessons = Math.max(uniqueUserIds.length * 9, 9);
    const completionRate = Math.round(Math.min((completedLessonsCount / totalPossibleLessons) * 100, 100)) || 45;

    // Calcular total de horas de estudo (soma de watchTime em segundos convertidos para horas)
    const totalWatchSeconds = progressList.reduce((acc: number, curr: any) => acc + (curr.watchTime || 0), 0);
    const totalStudyHours = Math.round(totalWatchSeconds / 3600) || 12;

    // 4. Inventário de Competências (Mapeado dinamicamente das lições completadas)
    const isCompleted = (cId: string, lId: string) =>
      progressList.some((p: any) => p.courseId === cId && p.lessonId === lId && p.status === "completed");

    const skillsInventory = [
      {
        name: "Python Core",
        averageScore: isCompleted("course-1", "lesson-1-1") ? 88 : 40,
        coverage: isCompleted("course-1", "lesson-1-1") ? 90 : 25,
      },
      {
        name: "FastAPI Routing",
        averageScore: isCompleted("course-1", "lesson-1-1") ? 72 : 30,
        coverage: isCompleted("course-1", "lesson-1-1") ? 60 : 15,
      },
      {
        name: "Docker Containers",
        averageScore: isCompleted("course-1", "lesson-1-2") ? 82 : 35,
        coverage: isCompleted("course-1", "lesson-1-2") ? 75 : 10,
      },
      {
        name: "RAG & Vector Search",
        averageScore: isCompleted("course-1", "lesson-1-3") ? 79 : 20,
        coverage: isCompleted("course-1", "lesson-1-3") ? 55 : 5,
      },
      {
        name: "Next.js 16 RSC",
        averageScore: isCompleted("course-2", "lesson-1-1") ? 84 : 45,
        coverage: isCompleted("course-2", "lesson-1-1") ? 80 : 30,
      },
      {
        name: "Solidity Blockchain",
        averageScore: isCompleted("course-3", "lesson-1-1") ? 92 : 30,
        coverage: isCompleted("course-3", "lesson-1-1") ? 70 : 10,
      },
      {
        name: "Bitcoin & Descentralização",
        averageScore: isCompleted("course-criptomoedas-n1", "introducao-as-criptomoedas-e-satoshi-nakamoto") || isCompleted("course-4", "lesson-1-1") ? 95 : 30,
        coverage: isCompleted("course-criptomoedas-n1", "introducao-as-criptomoedas-e-satoshi-nakamoto") || isCompleted("course-4", "lesson-1-1") ? 80 : 15,
      },
      {
        name: "Stablecoins & Altcoins",
        averageScore: isCompleted("course-criptomoedas-n1", "stablecoins-e-altcoins") || isCompleted("course-4", "lesson-1-2") ? 88 : 25,
        coverage: isCompleted("course-criptomoedas-n1", "stablecoins-e-altcoins") || isCompleted("course-4", "lesson-1-2") ? 75 : 10,
      },
    ];

    // 5. Analisar logs cognitivos agregados para obter tendências corporativas
    const searchTerms: Record<string, number> = {};
    cognitiveLogs.forEach((log: any) => {
      if (Array.isArray(log.keywords)) {
        log.keywords.forEach((word: string) => {
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

    // 6. Inventário de Colaboradores (Employee List)
    const employeeList = [
      {
        id: "emp-1",
        name: "Pedro Marques",
        role: "Software Developer",
        completedLessons: progressList.filter((p: any) => p.userId === userId && p.status === "completed").length || 1,
        activeCourses: Array.from(new Set(progressList.filter((p: any) => p.userId === userId).map((p: any) => p.courseId))).length || 1,
        interests: sortedTerms.length > 0 ? sortedTerms : ["Python", "FastAPI"],
        isMe: true,
      },
      {
        id: "emp-2",
        name: "Ana Costa",
        role: "Frontend Engineer",
        completedLessons: 4,
        activeCourses: 2,
        interests: ["Next.js", "Clerk", "CSS"],
        isMe: false,
      },
      {
        id: "emp-3",
        name: "João Silva",
        role: "DevOps Specialist",
        completedLessons: 2,
        activeCourses: 1,
        interests: ["Docker", "Kubernetes", "AWS"],
        isMe: false,
      },
    ];

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

    return NextResponse.json({
      success: true,
      kpis: {
        activeEmployees,
        completionRate,
        totalStudyHours,
        criticalGapsCount: completionRate < 60 ? 3 : 1,
      },
      skillsInventory,
      teamPlan,
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
