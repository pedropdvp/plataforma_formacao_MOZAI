"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Library, Check, Play, ShoppingCart, ShieldAlert, Award, ArrowRight, CreditCard, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";

interface CatalogCourse {
  _id: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  lessonsCount: number;
  paymentType: "basic_subscription" | "single_purchase" | "enterprise";
  price?: string;
  gradient: string;
  isAvailable: boolean;
  firstLesson?: string;
}

const CATALOG_COURSES: CatalogCourse[] = [
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
    price: "199,00 €",
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
    price: "299,00 €",
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

// Componente principal contendo Suspense para Next.js 16 build requirements
// Gradientes atribuídos ciclicamente aos cursos vindos do Sanity
const GRADIENTS = [
  "from-violet-500 to-indigo-500",
  "from-purple-500 to-pink-500",
  "from-indigo-500 to-cyan-500",
  "from-cyan-500 to-emerald-500",
  "from-amber-500 to-rose-500",
  "from-emerald-500 to-teal-500",
];

// Converte um curso do Sanity num card do catálogo (subscrição por defeito)
function mapSanityCourse(c: any, i: number): CatalogCourse {
  const mins = typeof c.minutes === "number" ? c.minutes : 0;
  const duration = mins >= 60 ? `${Math.round(mins / 60)}h de conteúdo` : mins > 0 ? `${mins}m de conteúdo` : "Conteúdo estruturado";
  return {
    _id: c._id,
    title: c.title,
    description: c.description || "",
    category: c.category || "Formação",
    duration,
    lessonsCount: c.lessonsCount || 0,
    paymentType: "basic_subscription",
    gradient: GRADIENTS[i % GRADIENTS.length],
    isAvailable: true,
    firstLesson: c.firstLesson || undefined,
  };
}

export default function CatalogPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
        <span className="text-xs">A carregar o catálogo de formações...</span>
      </div>
    }>
      <CatalogContent />
    </Suspense>
  );
}

function CatalogContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [selectedFilter, setSelectedFilter] = useState<"all" | "basic_subscription" | "single_purchase" | "enterprise">("all");
  
  // Estados para o simulador Stripe Checkout Connect
  const [showSimulator, setShowSimulator] = useState(false);
  const [simulatorData, setSimulatorData] = useState<any>(null);
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [purchasedCourses, setPurchasedCourses] = useState<string[]>([]);
  const { showToast } = useToast();

  // Lista de cursos: começa nos demos e é enriquecida com os cursos reais do Sanity
  const [courses, setCourses] = useState<CatalogCourse[]>(CATALOG_COURSES);

  // Carregar cursos reais publicados no Sanity e fundir com os demos
  useEffect(() => {
    async function loadCatalog() {
      try {
        const res = await fetch("/api/catalog");
        if (!res.ok) return;
        const data = await res.json();
        const real: CatalogCourse[] = (data.courses || []).map(mapSanityCourse);
        if (real.length === 0) return;
        const realIds = new Set(real.map((c) => c._id));
        // Cursos reais primeiro; demos apenas se não existirem no Sanity
        const demos = CATALOG_COURSES.filter((c) => !realIds.has(c._id));
        setCourses([...real, ...demos]);
      } catch (err) {
        console.error("Erro ao carregar catálogo dinâmico:", err);
      }
    }
    loadCatalog();
  }, []);

  // Carregar os cursos comprados anteriormente do progresso
  useEffect(() => {
    async function loadPurchased() {
      try {
        const res = await fetch("/api/progress");
        if (res.ok) {
          const data = await res.json();
          const list = data.progress || [];
          const uniqueIds = Array.from(new Set(list.map((p: any) => p.courseId))) as string[];
          setPurchasedCourses(uniqueIds);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadPurchased();
  }, []);

  // Monitorizar parâmetros de simulação de checkout da URL
  useEffect(() => {
    const sim = searchParams.get("simulate_checkout");
    if (sim === "true") {
      const courseId = searchParams.get("courseId");
      const courseTitle = searchParams.get("courseTitle");
      const price = searchParams.get("price");

      if (courseId && courseTitle && price) {
        setSimulatorData({
          courseId,
          courseTitle: decodeURIComponent(courseTitle),
          price: parseFloat(price),
        });
        setShowSimulator(true);
      }
    }
  }, [searchParams]);

  const filteredCourses = courses.filter(
    (c) => selectedFilter === "all" || c.paymentType === selectedFilter
  );

  // Manipular clique de aquisição
  const handleAcquire = async (course: CatalogCourse) => {
    try {
      const priceVal = parseFloat(course.price?.replace(/[^0-9,.]/g, "").replace(",", ".") || "0");
      
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courseId: course._id,
          courseTitle: course.title,
          price: priceVal,
          creatorAccountId: "acct_creator_moza_123",
          affiliateAccountId: "acct_affiliate_moza_456"
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          // Redireciona o utilizador
          window.location.href = data.url;
        }
      } else {
        showToast("Não foi possível iniciar o checkout de pagamentos.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Erro ao estabelecer ligação com a API de checkout.", "error");
    }
  };

  // Confirmar pagamento simulado
  const handleSimulatePaymentSuccess = async () => {
    if (!cardName.trim() || !cardNumber.trim()) {
      showToast("Por favor, preencha os dados do cartão de teste.", "warning");
      return;
    }

    setIsPaying(true);
    try {
      // Registrar no progresso o início da primeira aula para desbloquear o curso no dashboard
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courseId: simulatorData.courseId,
          lessonId: "lesson-1-1",
          status: "in-progress",
          watchTime: 0,
        }),
      });

      if (res.ok) {
        showToast(`Pagamento simulado efetuado! O curso "${simulatorData.courseTitle}" foi matriculado.`, "success", 5000);
        
        // Limpar parâmetros da URL e fechar simulator
        setShowSimulator(false);
        setSimulatorData(null);
        setCardName("");
        setCardNumber("");
        router.push("/dashboard");
      }
    } catch (err) {
      console.error(err);
      showToast("Erro ao registrar a matrícula simulada.", "error");
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="space-y-10 relative">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <Library className="h-7 w-7 text-indigo-400" />
          Catálogo de Cursos
        </h1>
        <p className="text-sm text-slate-400">
          Explora a oferta de formações e encontra o curso para ti.
        </p>
      </div>

      {/* Payment Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-900">
        <button
          onClick={() => setSelectedFilter("all")}
          className={`px-4 h-9 rounded-full text-xs font-semibold transition-all ${
            selectedFilter === "all"
              ? "bg-indigo-600 text-white shadow-lg"
              : "bg-slate-950 text-slate-400 hover:bg-slate-900 border border-slate-900"
          }`}
        >
          Todos os Cursos
        </button>
        <button
          onClick={() => setSelectedFilter("basic_subscription")}
          className={`px-4 h-9 rounded-full text-xs font-semibold transition-all ${
            selectedFilter === "basic_subscription"
              ? "bg-indigo-600 text-white shadow-lg"
              : "bg-slate-950 text-slate-400 hover:bg-slate-900 border border-slate-900"
          }`}
        >
          Incluídos na Minha Subscrição (Basic)
        </button>
        <button
          onClick={() => setSelectedFilter("single_purchase")}
          className={`px-4 h-9 rounded-full text-xs font-semibold transition-all ${
            selectedFilter === "single_purchase"
              ? "bg-indigo-600 text-white shadow-lg"
              : "bg-slate-950 text-slate-400 hover:bg-slate-900 border border-slate-900"
          }`}
        >
          Compra Avulsa (Matrícula)
        </button>
        <button
          onClick={() => setSelectedFilter("enterprise")}
          className={`px-4 h-9 rounded-full text-xs font-semibold transition-all ${
            selectedFilter === "enterprise"
              ? "bg-indigo-600 text-white shadow-lg"
              : "bg-slate-950 text-slate-400 hover:bg-slate-900 border border-slate-900"
          }`}
        >
          Plano Corporativo (Enterprise)
        </button>
      </div>

      {/* Seção 1: Cursos Incluídos no Plano Basic */}
      {(selectedFilter === "all" || selectedFilter === "basic_subscription") && (
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">Disponíveis com a Minha Subscrição (MOZAI – Basic)</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {filteredCourses
              .filter((c) => c.paymentType === "basic_subscription")
              .map((course) => (
                <CatalogCard
                  key={course._id}
                  course={course}
                  isUnlocked={true}
                  onAcquire={handleAcquire}
                />
              ))}
          </div>
        </section>
      )}

      {/* Seção 2: Compra Avulsa */}
      {(selectedFilter === "all" || selectedFilter === "single_purchase") && (
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-white">Cursos para Compra Avulsa (Matrícula Individual)</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {filteredCourses
              .filter((c) => c.paymentType === "single_purchase")
              .map((course) => {
                const isUnlocked = purchasedCourses.includes(course._id);
                return (
                  <CatalogCard
                    key={course._id}
                    course={course}
                    isUnlocked={isUnlocked}
                    onAcquire={handleAcquire}
                  />
                );
              })}
          </div>
        </section>
      )}

      {/* Seção 3: Plano Corporativo */}
      {(selectedFilter === "all" || selectedFilter === "enterprise") && (
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-bold text-white">Cursos Exclusivos (Upgrade para Plano Enterprise)</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {filteredCourses
              .filter((c) => c.paymentType === "enterprise")
              .map((course) => (
                <CatalogCard
                  key={course._id}
                  course={course}
                  isUnlocked={false}
                  onAcquire={handleAcquire}
                />
              ))}
          </div>
        </section>
      )}

      {/* MODAL SIMULADOR STRIPE CHECKOUT CONNECT */}
      {showSimulator && simulatorData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-950 border border-slate-900 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-900 bg-slate-900/10 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Stripe Connect: Checkout Simulator</h3>
                <span className="text-[9px] text-indigo-400 font-mono tracking-widest uppercase">Sandboxed Environment</span>
              </div>
            </div>

            {/* Split commission visualizer */}
            <div className="p-6 space-y-4 border-b border-slate-900 bg-slate-900/5">
              <h4 className="text-xs font-bold text-slate-350">Regras de Divisão de Lucros (Split Connect)</h4>
              <div className="space-y-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Valor Total do Curso:</span>
                  <span className="font-bold text-white">€{simulatorData.price.toFixed(2)}</span>
                </div>
                <div className="h-px bg-slate-900" />
                <div className="flex justify-between text-xs">
                  <span className="text-emerald-400">80% Creator Share (Direct Transfer):</span>
                  <span className="font-bold text-emerald-400">€{(simulatorData.price * 0.8).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-cyan-400">10% Affiliate Partner Share:</span>
                  <span className="font-bold text-cyan-400">€{(simulatorData.price * 0.1).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-indigo-400">10% MOZAI Application Fee (Retained):</span>
                  <span className="font-bold text-indigo-400">€{(simulatorData.price * 0.1).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Card Form Mock */}
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-medium">Nome do Titular</label>
                <input
                  type="text"
                  placeholder="Ex: Pedro Mozai"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-900 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-medium">Número do Cartão de Teste</label>
                <input
                  type="text"
                  placeholder="4242 4242 4242 4242 (Stripe Sandbox)"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-900 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => {
                    setShowSimulator(false);
                    router.push("/dashboard/catalog");
                  }}
                  className="flex-1 h-10 rounded-xl border border-slate-800 text-xs font-semibold text-slate-400 hover:bg-slate-900 transition-colors"
                >
                  Cancelar Compra
                </button>
                <button
                  onClick={handleSimulatePaymentSuccess}
                  disabled={isPaying}
                  className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/10"
                >
                  {isPaying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      A processar...
                    </>
                  ) : (
                    <>
                      Confirmar Matrícula (€{simulatorData.price.toFixed(2)})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CatalogCard({
  course,
  isUnlocked,
  onAcquire,
}: {
  course: CatalogCourse;
  isUnlocked: boolean;
  onAcquire: (course: CatalogCourse) => void;
}) {
  const { showToast } = useToast();
  return (
    <div className="border border-slate-900 bg-slate-950/40 rounded-3xl overflow-hidden hover:border-slate-800 transition-all flex flex-col justify-between group shadow-xl">
      {/* Cover Gradient Graphic */}
      <div className={`h-40 bg-gradient-to-br ${course.gradient} p-6 flex flex-col justify-between relative`}>
        <div className="absolute inset-0 bg-black/10" />
        
        {/* Category Badge */}
        <span className="relative z-10 self-start text-[10px] font-semibold px-2.5 py-1 rounded-full bg-indigo-600 text-white border border-white/10 transition-colors hover:bg-slate-200 hover:text-indigo-700">
          {course.category}
        </span>

        {/* Pricing Badge Overlay */}
        <span className="relative z-10 self-end text-[10px] font-bold px-3 py-1 rounded-lg bg-indigo-600 border border-white/10 text-white flex items-center gap-1.5 transition-colors hover:bg-slate-200 hover:text-indigo-700">
          {course.paymentType === "basic_subscription" && <span>Incluído no Basic</span>}
          {course.paymentType === "single_purchase" && <span>{isUnlocked ? "Comprado" : course.price}</span>}
          {course.paymentType === "enterprise" && <span>Exclusivo B2B</span>}
        </span>
      </div>

      {/* Details Body */}
      <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          <h3 className="font-bold text-base text-white group-hover:text-indigo-400 transition-colors line-clamp-1">
            {course.title}
          </h3>
          <p className="text-slate-400 text-xs leading-relaxed line-clamp-3">
            {course.description}
          </p>
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-900/60">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{course.duration}</span>
            <span>{course.lessonsCount} lições</span>
          </div>

          {/* Action Buttons */}
          {course.paymentType === "basic_subscription" && (
            <Link
              href={`/dashboard/courses/${course._id}/lessons/${course.firstLesson || "lesson-1-1"}`}
              className="w-full inline-flex items-center justify-center h-10 rounded-xl bg-indigo-600 hover:bg-slate-200 text-xs font-semibold text-white hover:text-indigo-700 transition-all gap-1 cursor-pointer"
            >
              Começar Estudo
              <Play className="h-3.5 w-3.5 fill-current" />
            </Link>
          )}

          {course.paymentType === "single_purchase" && (
            isUnlocked ? (
              <Link
                href={`/dashboard/courses/${course._id}/lessons/${course.firstLesson || "lesson-1-1"}`}
                className="w-full inline-flex items-center justify-center h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all gap-1 cursor-pointer"
              >
                Continuar Estudo
                <Play className="h-3.5 w-3.5 fill-white" />
              </Link>
            ) : (
              <button
                onClick={() => onAcquire(course)}
                className="w-full inline-flex items-center justify-center h-10 rounded-xl bg-indigo-600 hover:bg-slate-200 text-xs font-semibold text-white hover:text-indigo-700 transition-all gap-1.5 cursor-pointer"
              >
                Adquirir Curso ({course.price})
                <ShoppingCart className="h-3.5 w-3.5" />
              </button>
            )
          )}

          {course.paymentType === "enterprise" && (
            <button
              onClick={() => showToast("Contacte o administrador do seu tenant corporativo para solicitar o plano Enterprise.", "info")}
              className="w-full inline-flex items-center justify-center h-10 rounded-xl bg-slate-950 text-xs font-semibold text-amber-500 border border-amber-500/20 hover:bg-amber-600/10 transition-all gap-1.5 cursor-pointer"
            >
              Pedir Upgrade de Plano
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
