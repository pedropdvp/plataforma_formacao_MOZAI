import { ObjectId } from "mongodb";
import {
  deleteTenantScoped,
  findOneTenantScoped,
  findTenantScoped,
  getDb,
  insertTenantScoped,
} from "@/lib/mongodb";

export const ACADEMIC_ASSIGNMENTS_COLLECTION = "academic_assignments";

// Os perfis vivem em lib/academic-roles.ts, que não importa o driver do MongoDB — assim um
// componente de cliente pode usá-los sem arrastar o driver para o browser.
export { TEACHING_ROLES, ASSIGNER_ROLES, isTeachingRole } from "@/lib/academic-roles";
export type { TeachingRole } from "@/lib/academic-roles";

export type AssignmentScope = "course" | "student";

export interface AcademicAssignment {
  _id?: string;
  tenant_id: string;
  staffId: string;
  staffRole: string;
  scope: AssignmentScope;
  /** Presente quando scope === "course". Id do Sanity ou do Mongo, como em `assigned_courses`. */
  courseId?: string;
  /** Presente quando scope === "student" (tutela direta). */
  studentId?: string;
  assignedAt: Date;
  assignedBy: string;
}

/**
 * RESPONSABILIDADE DOCENTE: por curso, com tutela direta como exceção.
 *
 * A ligação aluno↔curso já existia em `assigned_courses` e é povoada pela atribuição de cursos
 * e pelos percursos da Academia Corporativa. Ligar o docente ao CURSO faz os alunos derivarem
 * sozinhos: quem entra no curso passa a constar da lista do docente sem ninguém o ligar à mão.
 * Uma ligação direta docente↔aluno envelheceria mal — obrigaria a manutenção manual a cada
 * inscrição nova.
 *
 * A exceção é a tutoria: um tutor acompanha uma pessoa, e esse acompanhamento não depende de
 * ela estar num curso seu. Daí o `scope: "student"`.
 */

/** Atribuições do tenant, opcionalmente filtradas por docente. */
export async function listAssignments(
  tenantId: string,
  staffId?: string
): Promise<AcademicAssignment[]> {
  const filtro = staffId ? { staffId } : {};
  const docs = await findTenantScoped(ACADEMIC_ASSIGNMENTS_COLLECTION, tenantId, filtro);
  return docs.map((d: any) => ({ ...d, _id: d._id.toString() }));
}

export interface NewAssignment {
  staffId: string;
  staffRole: string;
  scope: AssignmentScope;
  courseId?: string;
  studentId?: string;
  assignedBy: string;
}

/**
 * Cria uma atribuição. Devolve `null` quando ela já existe — atribuir duas vezes o mesmo curso
 * ao mesmo docente não é um erro que valha a pena mostrar ao utilizador, mas também não pode
 * duplicar a linha.
 */
export async function assignStaff(
  tenantId: string,
  novo: NewAssignment
): Promise<AcademicAssignment | null> {
  const chave =
    novo.scope === "course"
      ? { staffId: novo.staffId, scope: "course", courseId: novo.courseId }
      : { staffId: novo.staffId, scope: "student", studentId: novo.studentId };

  const existente = await findOneTenantScoped(ACADEMIC_ASSIGNMENTS_COLLECTION, tenantId, chave);
  if (existente) return null;

  const doc: Omit<AcademicAssignment, "tenant_id" | "_id"> = {
    staffId: novo.staffId,
    staffRole: novo.staffRole,
    scope: novo.scope,
    ...(novo.scope === "course" ? { courseId: novo.courseId } : { studentId: novo.studentId }),
    assignedAt: new Date(),
    assignedBy: novo.assignedBy,
  };

  const res = await insertTenantScoped(ACADEMIC_ASSIGNMENTS_COLLECTION, tenantId, doc);
  return { ...doc, tenant_id: tenantId, _id: res.insertedId?.toString() } as AcademicAssignment;
}

/** Remove uma atribuição do tenant. `false` quando não existia (ou é de outra empresa). */
export async function removeAssignment(tenantId: string, assignmentId: string): Promise<boolean> {
  if (!ObjectId.isValid(assignmentId)) return false;
  const res = await deleteTenantScoped(ACADEMIC_ASSIGNMENTS_COLLECTION, tenantId, {
    _id: new ObjectId(assignmentId),
  });
  return (res.deletedCount || 0) > 0;
}

/** Ids dos cursos pelos quais o docente é responsável neste tenant. */
export async function getCourseIdsForStaff(tenantId: string, staffId: string): Promise<string[]> {
  const docs = await findTenantScoped(ACADEMIC_ASSIGNMENTS_COLLECTION, tenantId, {
    staffId,
    scope: "course",
  });
  return Array.from(new Set(docs.map((d: any) => String(d.courseId)).filter(Boolean)));
}

export interface ResponsibleStudent {
  studentId: string;
  /** Como este aluno entrou na lista: pelos cursos do docente, por tutela, ou por ambos. */
  via: "curso" | "tutela" | "curso+tutela";
  /** Cursos partilhados entre o aluno e o docente (vazio quando entra só por tutela). */
  sharedCourseIds: string[];
}

/**
 * Alunos pelos quais um docente é responsável: os que têm atribuído algum dos seus cursos,
 * mais os que lhe estão entregues em tutela direta.
 *
 * `assigned_courses` usa `tenantId` (camelCase) e não `tenant_id`, ao contrário da maioria das
 * coleções — por isso a consulta é feita à mão e não pelos helpers *TenantScoped, que filtram
 * pelo campo em snake_case e aqui não devolveriam nada.
 */
export async function getStudentsForStaff(
  tenantId: string,
  staffId: string
): Promise<ResponsibleStudent[]> {
  const db = await getDb();
  const atribuicoes = await listAssignments(tenantId, staffId);
  const courseIds = Array.from(
    new Set(atribuicoes.filter((a) => a.scope === "course").map((a) => String(a.courseId)))
  );
  const tutelados = new Set(
    atribuicoes.filter((a) => a.scope === "student").map((a) => String(a.studentId))
  );

  const porCurso = new Map<string, string[]>();
  if (courseIds.length > 0) {
    const inscricoes = await db
      .collection("assigned_courses")
      .find({ tenantId, courseId: { $in: courseIds } })
      .toArray();
    for (const inscricao of inscricoes) {
      const alunoId = String(inscricao.userId);
      const lista = porCurso.get(alunoId) || [];
      lista.push(String(inscricao.courseId));
      porCurso.set(alunoId, lista);
    }
  }

  const todos = new Set<string>([...porCurso.keys(), ...tutelados]);
  return Array.from(todos).map((studentId) => {
    const cursos = porCurso.get(studentId) || [];
    const temCurso = cursos.length > 0;
    const temTutela = tutelados.has(studentId);
    return {
      studentId,
      via: temCurso && temTutela ? "curso+tutela" : temCurso ? "curso" : "tutela",
      sharedCourseIds: cursos,
    };
  });
}

/** Quantos cursos e alunos estão à responsabilidade de cada docente — para o relatório de admin. */
export async function getResponsibilityCounts(
  tenantId: string,
  staffIds: string[]
): Promise<Record<string, { courses: number; students: number }>> {
  const contagens: Record<string, { courses: number; students: number }> = {};
  for (const staffId of staffIds) {
    const [cursos, alunos] = await Promise.all([
      getCourseIdsForStaff(tenantId, staffId),
      getStudentsForStaff(tenantId, staffId),
    ]);
    contagens[staffId] = { courses: cursos.length, students: alunos.length };
  }
  return contagens;
}
