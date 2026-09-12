/** Áreas predefinidas de percurso da Academia Corporativa — percursos distintos por área
 * profissional (Técnica, Comercial, RH, Liderança), cada um com o seu próprio conjunto
 * de cursos e colaboradores atribuídos. */
export const TRACK_AREAS = ["Técnica", "Comercial", "RH", "Liderança", "Personalizada"] as const;
export type TrackArea = (typeof TRACK_AREAS)[number];
