import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { findPurchasableCourse } from "@/lib/catalog-courses";
import { getTenantId } from "@/lib/session";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "dummy_stripe_secret_key", {
  apiVersion: "2025-02-11" as any,
});

export async function POST(req: NextRequest) {
  // Fora do try: o catch abaixo devolve o simulador de checkout para qualquer erro, e uma
  // falha de autenticação não pode acabar nesse caminho. A rota criava sessões de pagamento
  // para pedidos anónimos.
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

  const simulatorUrl =
    `${req.nextUrl.origin}/dashboard/catalog?simulate_checkout=true` +
    `&courseId=${encodeURIComponent(course.courseId)}` +
    `&courseTitle=${encodeURIComponent(course.title)}` +
    `&price=${course.priceCents / 100}`;

  try {
    const tenantId = await getTenantId();

    // Caso a chave seja dummy ou ausente, usar o simulador local
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes("...") || process.env.STRIPE_SECRET_KEY.startsWith("dummy")) {
      console.warn("Stripe API key ausente ou inválida. Redirecionando para o simulador local.");
      return NextResponse.json({ url: simulatorUrl });
    }

    // Configurar a sessão de Checkout real no Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
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
      mode: "payment",
      success_url: `${req.nextUrl.origin}/dashboard?success=true&purchasedCourseId=${encodeURIComponent(course.courseId)}`,
      cancel_url: `${req.nextUrl.origin}/dashboard/catalog?canceled=true`,
      payment_intent_data: {
        transfer_group: `course_buy_${course.courseId}_${Date.now()}`,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.warn("Erro ao contactar o Stripe API. Ativando simulador de checkout local:", error.message);

    // Retornar o simulador local como robustez máxima
    return NextResponse.json({ url: simulatorUrl });
  }
}
