// Nomes de patente associados ao nível numérico já calculado em app/api/gamification/route.ts
// (level = floor(xp / 100) + 1). Mantém-se aqui como a única fonte de verdade para o nome
// de nível apresentado ao aluno, para não duplicar a escala em cada página que o mostra.
const LEVEL_TIERS: { minLevel: number; name: string }[] = [
  { minLevel: 1, name: "Iniciante" },
  { minLevel: 2, name: "Estudante" },
  { minLevel: 4, name: "Aprendiz" },
  { minLevel: 7, name: "Praticante" },
  { minLevel: 11, name: "Especialista" },
  { minLevel: 16, name: "Mestre" },
];

export function getLevelTierName(level: number): string {
  let name = LEVEL_TIERS[0].name;
  for (const tier of LEVEL_TIERS) {
    if (level >= tier.minLevel) name = tier.name;
  }
  return name;
}

const XP_PER_LEVEL = 100;

export function getXpRemainingForNextLevel(xp: number): number {
  const xpInCurrentLevel = xp % XP_PER_LEVEL;
  return XP_PER_LEVEL - xpInCurrentLevel;
}
