import "server-only";
import { findOneTenantScoped, findTenantScoped, insertTenantScoped } from "./mongodb";
import { requiresPurchase } from "./catalog-courses";
import { PLATFORM_ROLES } from "./tenant-resolution";

/**
 * Registo das compras de cursos avulsos — a única prova de que alguém pode abrir um curso pago.
 *
 * Antes não existia. Um curso contava como "comprado" se houvesse qualquer registo de progresso
 * nele, e o simulador de checkout "pagava" gravando progresso na primeira lição: qualquer
 * utilizador com sessão desbloqueava um curso pago com um POST a /api/progress, e a página das
 * lições nem isso pedia.
 *
 * Uma compra só nasce do webhook do Stripe com assinatura válida (/api/stripe/webhook) ou, em
 * modo de demonstração — Stripe por configurar —, do simulador (/api/checkout/simulate).
 */

export const COURSE_PURCHASES = "course_purchases";

export type PurchaseSource = "stripe" | "simulator";

export interface CoursePurchaseInput {
  tenantId: string;
  userId: string;
  courseId: string;
  amountCents: number;
  source: PurchaseSource;
  stripeSessionId?: string;
}

export async function hasPurchasedCourse(tenantId: string, userId: string, courseId: string): Promise<boolean> {
  return Boolean(await findOneTenantScoped(COURSE_PURCHASES, tenantId, { userId, courseId }));
}

export async function listPurchasedCourseIds(tenantId: string, userId: string): Promise<string[]> {
  const purchases = await findTenantScoped(COURSE_PURCHASES, tenantId, { userId });
  return Array.from(new Set(purchases.map((purchase: { courseId: string }) => purchase.courseId)));
}

/**
 * Regista a compra uma única vez. O Stripe reenvia um webhook sempre que a resposta falha, e a
 * mesma sessão de pagamento não pode dar origem a dois registos; no simulador, a chave é o par
 * utilizador–curso.
 */
export async function recordCoursePurchase(input: CoursePurchaseInput): Promise<"created" | "existing"> {
  const { tenantId, userId, courseId, amountCents, source, stripeSessionId } = input;

  const existing = await findOneTenantScoped(
    COURSE_PURCHASES,
    tenantId,
    stripeSessionId ? { stripeSessionId } : { userId, courseId }
  );
  if (existing) return "existing";

  await insertTenantScoped(COURSE_PURCHASES, tenantId, {
    userId,
    courseId,
    amountCents,
    source,
    stripeSessionId: stripeSessionId ?? null,
    purchasedAt: new Date(),
  });
  return "created";
}

/**
 * O utilizador pode abrir o curso? Os cursos que não são de compra avulsa não dependem deste
 * registo, e os perfis da plataforma abrem tudo, porque gerem o conteúdo.
 */
export async function canAccessCourse({
  tenantId,
  userId,
  courseId,
  activeRole,
}: {
  tenantId: string;
  userId: string;
  courseId: string;
  activeRole: string | undefined;
}): Promise<boolean> {
  if (!requiresPurchase(courseId)) return true;
  if (activeRole && PLATFORM_ROLES.includes(activeRole)) return true;
  return hasPurchasedCourse(tenantId, userId, courseId);
}
