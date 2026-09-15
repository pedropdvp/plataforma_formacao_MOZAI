import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CATALOG_COURSES, findPurchasableCourse, formatPriceCents } from "@/lib/catalog-courses";

describe("findPurchasableCourse", () => {
  it("devolve o preço do servidor para um curso de compra avulsa", () => {
    assert.deepEqual(findPurchasableCourse("course-3"), {
      courseId: "course-3",
      title: "Smart Contracts e Criptografia com Solidity",
      priceCents: 19900,
    });
  });

  it("não vende cursos da subscrição, empresariais ou inexistentes", () => {
    assert.equal(findPurchasableCourse("course-1"), null);
    assert.equal(findPurchasableCourse("course-6"), null);
    assert.equal(findPurchasableCourse("course-999"), null);
  });

  it("ignora identificadores que não são texto", () => {
    for (const value of [undefined, null, 3, { _id: "course-3" }, ["course-3"]]) {
      assert.equal(findPurchasableCourse(value), null);
    }
  });
});

describe("CATALOG_COURSES", () => {
  it("todos os cursos de compra avulsa têm preço positivo", () => {
    const singles = CATALOG_COURSES.filter((course) => course.paymentType === "single_purchase");
    assert.ok(singles.length > 0);
    for (const course of singles) assert.ok((course.priceCents ?? 0) > 0, course._id);
  });

  it("o preço mostrado na interface é o mesmo que o checkout cobra", () => {
    for (const course of CATALOG_COURSES.filter((c) => c.priceCents !== undefined)) {
      assert.equal(course.price, formatPriceCents(course.priceCents!));
    }
    assert.match(formatPriceCents(19900), /^199,00\s€$/u);
  });
});
