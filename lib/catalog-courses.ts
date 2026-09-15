/**
 * Cursos de demonstração do catálogo e os respetivos preços.
 *
 * Os preços viviam só na página do catálogo, no browser, e o /api/checkout cobrava o valor que o
 * browser lhe enviasse: bastava alterar o pedido para pagar 1 cêntimo por um curso de 199 €.
 * Estão aqui para a página os mostrar e o checkout os ler no servidor, da mesma fonte.
 *
 * Módulo puro, sem dependências de servidor: é importado pela página (cliente) e pela rota.
 */

export type CatalogPaymentType = "basic_subscription" | "single_purchase" | "enterprise";

export interface CatalogCourse {
  _id: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  lessonsCount: number;
  paymentType: CatalogPaymentType;
  /** Preço em cêntimos de euro — só nos cursos de compra avulsa. */
  priceCents?: number;
  /** Preço formatado para a interface, derivado de `priceCents`. */
  price?: string;
  gradient: string;
  isAvailable: boolean;
  firstLesson?: string;
  generatedByUserId?: string | null;
}

const EUROS = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });

export function formatPriceCents(priceCents: number): string {
  return EUROS.format(priceCents / 100);
}

const COURSES: Omit<CatalogCourse, "price">[] = [
  // 1. Cursos incluídos na subscrição do utilizador (MOZAI - Basic)
  {
    _id: "course-1",
    title: "Engenharia de IA e RAG Avançado",
    description: "Domine a integração de LLMs, chunking semântico, embeddings vetoriais e orquestração de agentes com LangChain e Vercel AI SDK.",
    category: "Inteligência Artificial",
    duration: "24h de conteúdo",
    lessonsCount: 18,
    paymentType: "basic_subscription",
    gradient: "from-violet-500 to-indigo-500",
    isAvailable: true,
  },
  {
    _id: "course-2",
    title: "Next.js 16 e Arquiteturas Composable SaaS",
    description: "Construa aplicações SaaS escaláveis utilizando Next.js 16 App Router, Clerk auth, WorkOS SSO, Sanity CMS e Stripe Connect.",
    category: "Programação / Frontend",
    duration: "18h de conteúdo",
    lessonsCount: 14,
    paymentType: "basic_subscription",
    gradient: "from-indigo-500 to-cyan-500",
    isAvailable: true,
  },
  // 2. Compra Avulsa
  {
    _id: "course-3",
    title: "Smart Contracts e Criptografia com Solidity",
    description: "Crie tokens ERC-20, NFTs dinâmicos, contratos seguros de DeFi e explore o desenvolvimento na blockchain Ethereum e Polygon.",
    category: "Crypto & Blockchain",
    duration: "30h de conteúdo",
    lessonsCount: 22,
    paymentType: "single_purchase",
    priceCents: 19900,
    gradient: "from-cyan-500 to-emerald-500",
    isAvailable: true,
  },
  {
    _id: "course-5",
    title: "Zero-Knowledge Proofs (ZKP) Avançado",
    description: "Introdução à criptografia de conhecimento zero, zk-SNARKs, zk-STARKs e sua aplicação em escalabilidade e privacidade de blockchains.",
    category: "Crypto & Blockchain",
    duration: "40h de conteúdo",
    lessonsCount: 28,
    paymentType: "single_purchase",
    priceCents: 29900,
    gradient: "from-amber-500 to-rose-500",
    isAvailable: true,
  },
  // 3. Enterprise B2B (Bloqueados para conta Basic)
  {
    _id: "course-6",
    title: "Liderança Tecnológica & AI Org Adoption",
    description: "Estratégia corporativa para diretores de tecnologia introduzirem IA generativa de forma segura, ética e regulada nas equipas.",
    category: "Liderança / Gestão",
    duration: "12h de conteúdo",
    lessonsCount: 10,
    paymentType: "enterprise",
    gradient: "from-blue-600 to-indigo-800",
    isAvailable: false,
  },
];

export const CATALOG_COURSES: CatalogCourse[] = COURSES.map((course) =>
  course.priceCents === undefined ? course : { ...course, price: formatPriceCents(course.priceCents) }
);

export interface PurchasableCourse {
  courseId: string;
  title: string;
  priceCents: number;
}

/** Curso que se pode comprar avulso, com título e preço do servidor; `null` para tudo o resto. */
export function findPurchasableCourse(courseId: unknown): PurchasableCourse | null {
  if (typeof courseId !== "string") return null;
  const course = CATALOG_COURSES.find((candidate) => candidate._id === courseId);
  if (!course?.isAvailable || course.paymentType !== "single_purchase") return null;
  if (!course.priceCents || course.priceCents <= 0) return null;
  return { courseId: course._id, title: course.title, priceCents: course.priceCents };
}

/** Curso que só se abre depois de comprado (ver lib/course-purchases.ts). */
export function requiresPurchase(courseId: string): boolean {
  return CATALOG_COURSES.some((course) => course._id === courseId && course.paymentType === "single_purchase");
}
