import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isStripeConfigured, purchaseFromCheckoutSession } from "@/lib/payments";
import { requiresPurchase } from "@/lib/catalog-courses";

const TEST_KEY = `sk_test_${"a1B2".repeat(12)}`;

describe("isStripeConfigured", () => {
  it("não trata como configurado o que não é uma chave verdadeira", () => {
    for (const value of ["", "   ", "sk_test_...", "dummy_stripe_secret_key", "sk_test_abc", `pk_test_${"a".repeat(30)}`]) {
      assert.equal(isStripeConfigured(value), false, JSON.stringify(value));
    }
  });

  it("reconhece chaves de teste, de produção e restritas", () => {
    assert.ok(isStripeConfigured(TEST_KEY));
    assert.ok(isStripeConfigured(`sk_live_${"Z9".repeat(20)}`));
    assert.ok(isStripeConfigured(`rk_live_${"x7".repeat(20)}`));
    assert.ok(isStripeConfigured(`  ${TEST_KEY}  `));
  });
});

describe("purchaseFromCheckoutSession", () => {
  const paid = {
    id: "cs_test_1",
    payment_status: "paid",
    amount_total: 19900,
    currency: "eur",
    metadata: { courseId: "course-3", tenantId: "root", userId: "user_1" },
  };

  it("regista a compra de um pagamento completo do preço atual", () => {
    assert.deepEqual(purchaseFromCheckoutSession(paid), {
      courseId: "course-3",
      tenantId: "root",
      userId: "user_1",
      amountCents: 19900,
      stripeSessionId: "cs_test_1",
    });
  });

  it("ignora sessões que ainda não estão pagas", () => {
    assert.equal(purchaseFromCheckoutSession({ ...paid, payment_status: "unpaid" }), null);
    assert.equal(purchaseFromCheckoutSession({ ...paid, payment_status: "no_payment_required" }), null);
  });

  it("ignora sessões sem os dados da compra", () => {
    assert.equal(purchaseFromCheckoutSession({ ...paid, metadata: null }), null);
    assert.equal(purchaseFromCheckoutSession({ ...paid, metadata: { courseId: "course-3", tenantId: "root" } }), null);
  });

  it("não aceita um montante ou uma moeda diferentes do preço do curso", () => {
    assert.equal(purchaseFromCheckoutSession({ ...paid, amount_total: 1 }), null);
    assert.equal(purchaseFromCheckoutSession({ ...paid, currency: "usd" }), null);
  });

  it("não regista cursos que não são de compra avulsa", () => {
    assert.equal(
      purchaseFromCheckoutSession({ ...paid, amount_total: 0, metadata: { ...paid.metadata, courseId: "course-1" } }),
      null
    );
  });
});

describe("requiresPurchase", () => {
  it("só os cursos de compra avulsa exigem compra", () => {
    assert.ok(requiresPurchase("course-3"));
    assert.ok(requiresPurchase("course-5"));
    assert.ok(!requiresPurchase("course-1"));
    assert.ok(!requiresPurchase("course-6"));
    assert.ok(!requiresPurchase("curso-inexistente"));
  });
});
