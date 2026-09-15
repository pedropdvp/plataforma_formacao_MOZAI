import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { logAuditEvent } from "@/lib/audit";
import { findPurchasableCourse } from "@/lib/catalog-courses";
import { recordCoursePurchase } from "@/lib/course-purchases";
import { isStripeConfigured } from "@/lib/payments";
import { getTenantId } from "@/lib/session";

/**
 * POST — Confirma uma compra no simulador de checkout (modo de demonstração).
 *
 * Só funciona enquanto o Stripe não está configurado. Com uma chave verdadeira, a única forma de
 * comprar é pagar, e esta rota recusa. A compra fica registada com `source: "simulator"`, para
 * nunca se confundir com uma venda real.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (isStripeConfigured()) {
      return NextResponse.json(
        { error: "O simulador de pagamentos está desativado: os pagamentos são processados pelo Stripe." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const course = findPurchasableCourse(body?.courseId);
    if (!course) {
      return NextResponse.json({ error: "Este curso não está disponível para compra avulsa." }, { status: 404 });
    }

    const tenantId = await getTenantId();
    const result = await recordCoursePurchase({
      tenantId,
      userId,
      courseId: course.courseId,
      amountCents: course.priceCents,
      source: "simulator",
    });

    if (result === "created") {
      await logAuditEvent(userId, "COURSE_PURCHASE_SIMULATED", {
        courseId: course.courseId,
        amountCents: course.priceCents,
      });
    }

    return NextResponse.json({ success: true, courseId: course.courseId });
  } catch (error: any) {
    console.error("Erro ao registar a compra simulada:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
