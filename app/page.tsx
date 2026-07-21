import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { GraduationCap, Brain, Compass, Terminal, Shield, ArrowRight } from "lucide-react";

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-8 w-8 text-indigo-400" />
            <span className="text-xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">
              MOZAI
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Produtos</a>
            <a href="#vision" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Visão</a>
            <a href="#architecture" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Arquitetura</a>
          </nav>

          <div className="flex items-center gap-4">
            {userId ? (
              <div className="flex items-center gap-4">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center px-4 h-9 rounded-full bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-all hover:shadow-lg hover:shadow-indigo-500/20"
                >
                  Dashboard
                </Link>
                <UserButton />
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Link
                  href="/sign-in"
                  className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
                >
                  Entrar
                </Link>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center justify-center px-4 h-9 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-sm font-semibold transition-all hover:shadow-lg hover:shadow-indigo-500/20"
                >
                  Criar Conta
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative pt-24 pb-20 md:pt-32 md:pb-28 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.05),transparent_50%)]" />
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-6">
              <Brain className="h-3.5 w-3.5" />
              O Fim do E-Learning Passivo
            </span>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight max-w-4xl mx-auto mb-6 text-white">
              O Sistema Operativo Global para a
              <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-400">
                Educação Tecnológica
              </span>
            </h1>
            <p className="max-w-2xl mx-auto text-lg text-slate-400 mb-10">
              A MOZAI vai além do conceito de LMS convencional. Somos uma infraestrutura viva baseada em Inteligência Artificial, projetada para acelerar carreiras e amplificar o potencial humano.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/sign-up"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-base font-semibold text-white transition-all hover:shadow-xl hover:shadow-indigo-500/25 group"
              >
                Começar Agora
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#features"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 rounded-full border border-slate-800 bg-slate-950 hover:bg-slate-900 text-base font-semibold text-slate-350 transition-colors"
              >
                Conhecer Produtos
              </a>
            </div>
          </div>
        </section>

        {/* Feature/Product OS Grid */}
        <section id="features" className="py-20 border-t border-slate-900 bg-slate-950/50 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-white mb-4">
                Três Produtos Integrados numa Única Estrutura
              </h2>
              <p className="text-slate-400">
                Uma arquitetura modular composta por sistemas operativos independentes que se reforçam mutuamente.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Product 1: AI Learning OS */}
              <div className="border border-slate-900 bg-slate-900/30 rounded-3xl p-8 hover:border-violet-500/30 hover:bg-slate-900/50 transition-all group">
                <div className="p-3 bg-violet-500/10 rounded-2xl w-fit mb-6 text-violet-400 group-hover:scale-110 transition-transform">
                  <Compass className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">AI Learning OS</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                  Aprendizagem adaptativa hiper-personalizada para alunos individuais. Substitui totalmente o consumo de vídeo estático por diálogos contínuos orientados pela IA.
                </p>
                <span className="text-xs font-semibold text-violet-400 group-hover:underline">Saber mais &rarr;</span>
              </div>

              {/* Product 2: AI Academy OS */}
              <div className="border border-slate-900 bg-slate-900/30 rounded-3xl p-8 hover:border-indigo-500/30 hover:bg-slate-900/50 transition-all group">
                <div className="p-3 bg-indigo-500/10 rounded-2xl w-fit mb-6 text-indigo-400 group-hover:scale-110 transition-transform">
                  <GraduationCap className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">AI Academy OS</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                  Plataforma multi-tenant avançada para escolas, universidades e centros de formação, com subdomínios, gestão de acessos e identidade de marca exclusiva.
                </p>
                <span className="text-xs font-semibold text-indigo-400 group-hover:underline">Saber mais &rarr;</span>
              </div>

              {/* Product 3: AI Skills OS */}
              <div className="border border-slate-900 bg-slate-900/30 rounded-3xl p-8 hover:border-cyan-500/30 hover:bg-slate-900/50 transition-all group">
                <div className="p-3 bg-cyan-500/10 rounded-2xl w-fit mb-6 text-cyan-400 group-hover:scale-110 transition-transform">
                  <Terminal className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">AI Skills OS</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                  Gestão global de competências através do Competency Graph. Avaliação em tempo real e verificação de conhecimentos, projetos e exames orientados por agentes.
                </p>
                <span className="text-xs font-semibold text-cyan-400 group-hover:underline">Saber mais &rarr;</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-8 bg-slate-950 text-slate-500 text-sm text-center">
        <div className="max-w-7xl mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} MOZAI Education Platform. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
