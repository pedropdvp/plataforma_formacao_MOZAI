import { findPurchasableCourse } from "./catalog-courses";

/**
 * Regras puras dos pagamentos de cursos avulsos — sem o SDK do Stripe nem base de dados, para
 * se poderem testar isoladamente.
 */

/**
 * O Stripe está configurado com uma chave verdadeira?
 *
 * Sem chave, ou com o texto de exemplo do .env.example, a plataforma corre em modo de
 * demonstração e o catálogo usa o simulador de checkout. Com chave, o simulador desliga-se por
 * completo: um erro do Stripe passa a ser um erro, e não uma compra gratuita.
 */
export function isStripeConfigured(secretKey: string | undefined = process.env.STRIPE_SECRET_KEY): boolean {
  if (!secretKey) return false;
  return /^(sk|rk)_(test|live)_[A-Za-z0-9]{16,}$/.test(secretKey.trim());
}

/** Os campos da Checkout Session do Stripe que decidem se há compra a registar. */
export interface CheckoutSessionLike {
  id: string;
  payment_status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  metadata?: Record<string, string> | null;
}

export interface PurchaseFromSession {
  courseId: string;
  tenantId: string;
  userId: string;
  amountCents: number;
  stripeSessionId: string;
}

/**
 * Compra a registar a partir de uma Checkout Session, ou `null` se a sessão não provar o
 * pagamento completo do preço atual de um curso avulso. Os dados da compra vêm dos metadados
 * que o /api/checkout grava ao criar a sessão; o montante confere-se com o preço do servidor.
 */
export function purchaseFromCheckoutSession(session: CheckoutSessionLike): PurchaseFromSession | null {
  if (session.payment_status !== "paid") return null;

  const { courseId, tenantId, userId } = session.metadata ?? {};
  if (!courseId || !tenantId || !userId) return null;

  const course = findPurchasableCourse(courseId);
  if (!course) return null;
  if (session.currency?.toLowerCase() !== "eur" || session.amount_total !== course.priceCents) return null;

  return { courseId, tenantId, userId, amountCents: course.priceCents, stripeSessionId: session.id };
}
