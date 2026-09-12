/**
 * Perfis docentes e respetivos rótulos — constantes puras, sem acesso a dados.
 *
 * Vivem separadas de `lib/academics.ts` de propósito: esse módulo importa o driver do MongoDB,
 * e qualquer componente de cliente que importasse dele uma simples lista de perfis arrastaria o
 * driver para o browser (o build falha com "Can't resolve 'child_process'/'dns'/'tls'").
 * Aqui, cliente e servidor partilham a mesma definição sem esse custo.
 */

/** Perfis que podem ter alunos à sua responsabilidade. */
export const TEACHING_ROLES = ["PROFESSOR", "FORMADOR", "TUTOR", "GESTOR_ACADEMICO"] as const;
export type TeachingRole = (typeof TEACHING_ROLES)[number];

/** Perfis que podem atribuir docentes a cursos e alunos. */
export const ASSIGNER_ROLES = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA", "GESTOR_ACADEMICO"];

/** Nome legível de cada perfil docente, para a interface e para os ficheiros exportados. */
export const TEACHING_ROLE_LABELS: Record<string, string> = {
  PROFESSOR: "Professor",
  FORMADOR: "Formador",
  TUTOR: "Tutor",
  GESTOR_ACADEMICO: "Gestor Académico",
};

export function isTeachingRole(role: string): boolean {
  return (TEACHING_ROLES as readonly string[]).includes(role);
}
