import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { findPurchasableCourse } from "@/lib/catalog-courses";
import { hasPurchasedCourse } from "@/lib/course-purchases";
import { isStripeConfigured } from "@/lib/payments";
import { getTenantId } from "@/lib/session";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "dummy_stripe_secret_key", {
  apiVersion: "2025-02-11" as any,
});

export async function POST(req: NextRequest) {
  // Fora do try: uma falha de autenticação não pode acabar noutro caminho. A rota criava
  // sessões de pagamento para pedidos anónimos.
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // Do pedido só se aproveita o identificador: título e preço vêm do servidor
  // (lib/catalog-courses.ts). Antes vinham do corpo, e o valor cobrado era o que o browser
  // mandasse.
  const body = await req.json().catch(() => ({}));
  const course = findPurchasableCourse(body?.courseId);
  if (!course) {
    return NextResponse.json({ error: "Este curso não está disponível para compra avulsa." }, { status: 404 });
  }

  try {
    const tenantId = await getTenantId();
    if (await hasPurchasedCourse(tenantId, userId, course.courseId)) {
      return NextResponse.json({ error: "Já adquiriu este curso." }, { status: 409 });
    }

    // Modo de demonstração: sem Stripe configurado, o catálogo abre o simulador, que regista a
    // compra em /api/checkout/simulate. Com o Stripe configurado, o simulador deixa de existir.
    if (!isStripeConfigured()) {
      const simulatorUrl =
        `${req.nextUrl.origin}/dashboard/catalog?simulate_checkout=true` +
        `&courseId=${encodeURIComponent(course.courseId)}` +
        `&courseTitle=${encodeURIComponent(course.title)}` +
        `&price=${course.priceCents / 100}`;
      return NextResponse.json({ url: simulatorUrl });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      client_reference_id: userId,
      // É com estes dados que o webhook (/api/stripe/webhook) regista a compra depois de o Stripe
      // confirmar o pagamento — o regresso do utilizador ao site não conta como prova.
      metadata: {
        courseId: course.courseId,
        tenantId,
        userId,
      },
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: course.title,
              metadata: {
                courseId: course.courseId,
                tenantId,
              },
            },
            unit_amount: course.priceCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${req.nextUrl.origin}/dashboard/catalog`,
      cancel_url: `${req.nextUrl.origin}/dashboard/catalog`,
      payment_intent_data: {
        transfer_group: `course_buy_${course.courseId}_${Date.now()}`,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    // Antes, qualquer erro aqui abria o simulador — e o simulador dava o curso sem cobrar. Um
    // erro do Stripe é agora só um erro.
    console.error("Erro ao iniciar o checkout:", error?.message);
    return NextResponse.json(
      { error: "Não foi possível iniciar o pagamento. Tente novamente dentro de momentos." },
      { status: 502 }
    );
  }
}
