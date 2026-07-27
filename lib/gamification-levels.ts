import { getDb } from "@/lib/mongodb";

/**
 * Escala de níveis do aluno — configurável pelo Admin em Configurações > Níveis (coleção
 * `gamification_levels`, partilhada por toda a plataforma, não por tenant — tal como os
 * Perfis de Acesso). Cada nível tem um nome e um limiar em MZ (a unidade de pontuação da
 * plataforma, antes chamada XP) a partir do qual esse nível é atingido.
 *
 * O nível de um aluno NUNCA é guardado como fonte de verdade — é sempre recalculado a
 * partir dos pontos (mz) e da escala atual, para que uma alteração aos limiares pelo Admin
 * se reflita de imediato em todos os alunos, sem precisar de recalcular/migrar dados.
 */

export interface GamificationLevel {
  id: string;
  name: string;
  threshold: number;
}

/** Usada apenas como memória — nunca escrita na BD automaticamente — para a plataforma
 * nunca ficar sem nenhum nível definido (ex: antes do primeiro seed). */
const DEFAULT_LEVELS: Omit<GamificationLevel, "id">[] = [
  { name: "Aprendiz", threshold: 0 },
  { name: "Estudante", threshold: 500 },
  { name: "Praticante", threshold: 1500 },
  { name: "Especialista", threshold: 3000 },
  { name: "Mestre", threshold: 5000 },
];

export async function getGamificationLevels(): Promise<GamificationLevel[]> {
  const db = await getDb();
  const rows = await db.collection("gamification_levels").find({}).sort({ threshold: 1 }).toArray();
  if (rows.length === 0) {
    return DEFAULT_LEVELS.map((l, i) => ({ id: `default-${i}`, ...l }));
  }
  return rows.map((r: any) => ({ id: r._id.toString(), name: r.name, threshold: r.threshold }));
}

export interface LevelInfo {
  levelNumber: number;
  name: string;
  pointsRemaining: number;
  progressPct: number;
  isMaxLevel: boolean;
}

/** Calcula o nível atual de um aluno a partir dos seus pontos (mz) e da escala de níveis
 * atual — nunca a partir de um número de nível já guardado. */
export function computeLevelInfo(points: number, levels: GamificationLevel[]): LevelInfo {
  if (levels.length === 0) {
    return { levelNumber: 1, name: "Aprendiz", pointsRemaining: 0, progressPct: 0, isMaxLevel: true };
  }

  let levelNumber = 1;
  let current = levels[0];
  let next: GamificationLevel | null = levels.length > 1 ? levels[1] : null;

  for (let i = 0; i < levels.length; i++) {
    if (points >= levels[i].threshold) {
      levelNumber = i + 1;
      current = levels[i];
      next = levels[i + 1] || null;
    }
  }

  if (!next) {
    return { levelNumber, name: current.name, pointsRemaining: 0, progressPct: 100, isMaxLevel: true };
  }

  const pointsIntoLevel = Math.max(points - current.threshold, 0);
  const pointsSpan = Math.max(next.threshold - current.threshold, 1);
  const progressPct = Math.min(Math.max((pointsIntoLevel / pointsSpan) * 100, 0), 100);
  const pointsRemaining = Math.max(next.threshold - points, 0);

  return { levelNumber, name: current.name, pointsRemaining, progressPct, isMaxLevel: false };
}
