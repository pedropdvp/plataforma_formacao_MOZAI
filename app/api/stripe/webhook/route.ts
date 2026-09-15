import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { logAuditEvent } from "@/lib/audit";
import { recordCoursePurchase } from "@/lib/course-purchases";
import { purchaseFromCheckoutSession } from "@/lib/payments";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "dummy_stripe_secret_key", {
  apiVersion: "2025-02-11" as any,
});

const PURCHASE_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);

/**
 * POST — Webhook do Stripe. É daqui, e só daqui, que nasce uma compra paga: o regresso do
 * utilizador ao site depois do checkout não prova nada, porque qualquer pessoa pode abrir esse
 * endereço. A autenticação é a assinatura do Stripe (STRIPE_WEBHOOK_SECRET), não a sessão.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !secret.startsWith("whsec_") || secret.includes("...")) {
    console.error("Webhook do Stripe recusado: STRIPE_WEBHOOK_SECRET não está configurada.");
    return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return NextResponse.json({ error: "Assinatura do webhook inválida." }, { status: 401 });
  }

  try {
    if (PURCHASE_EVENTS.has(event.type)) {
      const session = event.data.object as Stripe.Checkout.Session;
      const purchase = purchaseFromCheckoutSession(session);

      if (!purchase) {
        // Um checkout "unpaid" (pagamento assíncrono ainda pendente) chega aqui e volta quando o
        // pagamento se confirmar; os restantes casos são para investigar.
        console.warn(
          `Checkout ${session.id} sem compra a registar (estado ${session.payment_status}, montante ${session.amount_total} ${session.currency}).`
        );
      } else if ((await recordCoursePurchase({ ...purchase, source: "stripe" })) === "created") {
        await logAuditEvent(purchase.userId, "COURSE_PURCHASED", {
          courseId: purchase.courseId,
          amountCents: purchase.amountCents,
          stripeSessionId: purchase.stripeSessionId,
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    // 500 de propósito: o Stripe volta a enviar o evento, e o registo não se duplica.
    console.error("Erro ao processar webhook do Stripe:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
