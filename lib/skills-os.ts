/**
 * Motor de pontuação contínua do Skills OS (Grafo de Competências).
 *
 * Antes: cada nó tinha um valor de "score" fixo, atribuído no código assim que a lição
 * associada ficava marcada como concluída (ex: "score: 92") — nunca mudava depois disso,
 * por muito bem ou mal que o aluno tivesse ido nos quizzes, nem refletia inatividade.
 *
 * Agora: o score de cada nó deriva de dados reais e contínuos —
 *   1. Média real das tentativas de quiz da lição associada (quiz_attempts.score, 0..1).
 *   2. Decaimento por inatividade — sem prática nesse curso há mais de 30 dias, o score
 *      desce (1%/dia além dos 30, até -30), tal como a fluência real de uma competência
 *      esmorece sem uso. Volta a subir assim que o aluno pratica de novo.
 */

export interface SkillMilestone {
  courseId: string;
  lessonId: string;
}

export interface SkillNodeDef {
  id: string;
  label: string;
  type: string;
  connections: string[];
  /** Candidatos de (curso, lição) que "desbloqueiam" e alimentam este nó — o primeiro
   * candidato com dados reais (tentativas de quiz) é usado; caso contrário apenas o
   * estado de conclusão é considerado. Vários candidatos cobrem cursos-demo com IDs
   * alternativos (ex: curso de criptomoedas com dois IDs históricos). */
  milestones: SkillMilestone[];
}

export const CURATED_SKILL_DEFS: SkillNodeDef[] = [
  { id: "python", label: "Python Core", type: "Linguagem", connections: ["fastapi", "rest"], milestones: [{ courseId: "course-1", lessonId: "lesson-1-1" }] },
  { id: "fastapi", label: "FastAPI Routing", type: "Framework", connections: ["rest"], milestones: [{ courseId: "course-1", lessonId: "lesson-1-1" }] },
  { id: "rest", label: "REST API Design", type: "Arquitetura", connections: ["docker"], milestones: [{ courseId: "course-1", lessonId: "lesson-1-1" }] },
  { id: "docker", label: "Docker Containers", type: "Infraestrutura", connections: ["cloud"], milestones: [{ courseId: "course-1", lessonId: "lesson-1-2" }] },
  { id: "cloud", label: "AWS & GCP Cloud", type: "Infraestrutura", connections: ["agents"], milestones: [{ courseId: "course-1", lessonId: "lesson-1-2" }] },
  { id: "agents", label: "AI Agents System", type: "IA & Orquestração", connections: ["rag"], milestones: [{ courseId: "course-1", lessonId: "lesson-1-3" }] },
  { id: "rag", label: "RAG & Search Atlas", type: "IA & Orquestração", connections: [], milestones: [{ courseId: "course-1", lessonId: "lesson-1-3" }] },

  { id: "nextjs", label: "Next.js 16 RSC", type: "Framework", connections: ["clerk_auth"], milestones: [{ courseId: "course-2", lessonId: "lesson-1-1" }] },
  { id: "clerk_auth", label: "Clerk & B2B SSO", type: "Identidade/Segurança", connections: ["sanity_cms"], milestones: [{ courseId: "course-2", lessonId: "lesson-1-2" }] },
  { id: "sanity_cms", label: "Sanity CMS & GROQ", type: "Arquitetura/Dados", connections: [], milestones: [{ courseId: "course-2", lessonId: "lesson-1-3" }] },

  { id: "solidity", label: "Solidity Core", type: "Linguagem Web3", connections: ["erc_tokens"], milestones: [{ courseId: "course-3", lessonId: "lesson-1-1" }] },
  { id: "erc_tokens", label: "ERC-20 & ERC-721 Standards", type: "Blockchain Protocol", connections: ["smart_security"], milestones: [{ courseId: "course-3", lessonId: "lesson-1-2" }] },
  { id: "smart_security", label: "Smart Contract Audit", type: "Segurança/Auditoria", connections: ["bitcoin"], milestones: [{ courseId: "course-3", lessonId: "lesson-1-3" }] },

  {
    id: "bitcoin",
    label: "Bitcoin & Descentralização",
    type: "Protocolo",
    connections: ["stablecoins"],
    milestones: [
      { courseId: "course-criptomoedas-n1", lessonId: "introducao-as-criptomoedas-e-satoshi-nakamoto" },
      { courseId: "course-4", lessonId: "lesson-1-1" },
    ],
  },
  {
    id: "stablecoins",
    label: "Stablecoins & Altcoins",
    type: "Ativos Digitais",
    connections: ["crypto_wallets"],
    milestones: [
      { courseId: "course-criptomoedas-n1", lessonId: "stablecoins-e-altcoins" },
      { courseId: "course-4", lessonId: "lesson-1-2" },
    ],
  },
  {
    id: "crypto_wallets",
    label: "Wallets & Segurança Segura",
    type: "Criptografia/Armazenamento",
    connections: [],
    milestones: [
      { courseId: "course-criptomoedas-n1", lessonId: "wallets-e-armazenamento-seguro" },
      { courseId: "course-4", lessonId: "lesson-1-3" },
    ],
  },
];

export interface ScoredSkillNode {
  id: string;
  label: string;
  score: number;
  type: string;
  level: string;
  connections: string[];
  /** Dias desde a última atividade real (quiz/lição) no curso associado — null se nunca praticado. */
  daysSinceActivity: number | null;
}

function levelForScore(score: number): string {
  if (score === 0) return "Bloqueado";
  if (score < 40) return "Iniciado";
  if (score < 70) return "Básico";
  if (score < 90) return "Intermédio";
  return "Avançado";
}

/** Decaimento por inatividade: 1%/dia depois dos primeiros 30 dias sem prática, até -30. */
function decayFor(daysSinceActivity: number | null): number {
  if (daysSinceActivity === null || daysSinceActivity <= 30) return 0;
  return Math.min(30, daysSinceActivity - 30);
}

export function computeSkillNodes(
  progressList: any[],
  quizAttempts: any[],
  now: Date = new Date()
): ScoredSkillNode[] {
  return CURATED_SKILL_DEFS.map((def) => {
    // Escolhe o primeiro candidato de milestone com dados reais (tentativas de quiz);
    // se nenhum tiver quiz, usa o primeiro candidato cuja lição esteja concluída/iniciada.
    let baseScore = 0;
    let daysSinceActivity: number | null = null;
    let resolved = false;

    for (const milestone of def.milestones) {
      const attemptsForMilestone = quizAttempts.filter(
        (a: any) => a.courseId === milestone.courseId && a.lessonId === milestone.lessonId
      );

      if (attemptsForMilestone.length > 0) {
        const avg = attemptsForMilestone.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / attemptsForMilestone.length;
        baseScore = Math.round(avg * 100);
        const lastAttempt = attemptsForMilestone
          .map((a: any) => new Date(a.timestamp).getTime())
          .sort((a: number, b: number) => b - a)[0];
        daysSinceActivity = Math.floor((now.getTime() - lastAttempt) / (24 * 60 * 60 * 1000));
        resolved = true;
        break;
      }

      const isCompleted = progressList.some(
        (p: any) => p.courseId === milestone.courseId && p.lessonId === milestone.lessonId && p.status === "completed"
      );
      const isStarted = progressList.some((p: any) => p.courseId === milestone.courseId);

      if (isCompleted) {
        // Lição concluída mas sem quiz registado — crédito de base neutro, "por verificar".
        baseScore = Math.max(baseScore, 70);
        const lastProgress = progressList
          .filter((p: any) => p.courseId === milestone.courseId && p.lessonId === milestone.lessonId)
          .map((p: any) => new Date(p.updatedAt || p.completedAt || now).getTime())
          .sort((a: number, b: number) => b - a)[0];
        if (lastProgress) daysSinceActivity = Math.floor((now.getTime() - lastProgress) / (24 * 60 * 60 * 1000));
        resolved = true;
      } else if (isStarted && !resolved) {
        baseScore = Math.max(baseScore, 15);
      }
    }

    const decay = decayFor(daysSinceActivity);
    const finalScore = Math.max(0, Math.min(100, baseScore - decay));

    return {
      id: def.id,
      label: def.label,
      type: def.type,
      connections: def.connections,
      score: finalScore,
      level: levelForScore(finalScore),
      daysSinceActivity,
    };
  });
}
