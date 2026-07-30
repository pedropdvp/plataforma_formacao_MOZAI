/** Áreas predefinidas de trilha da Academia Corporativa — trilhas distintas por área
 * profissional (Técnica, Comercial, RH, Liderança), cada uma com o seu próprio percurso
 * de cursos e colaboradores atribuídos. */
export const TRACK_AREAS = ["Técnica", "Comercial", "RH", "Liderança", "Personalizada"] as const;
export type TrackArea = (typeof TRACK_AREAS)[number];
