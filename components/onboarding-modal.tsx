"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  X,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  BookOpen,
  Brain,
  Trophy,
  Building,
  GraduationCap,
  Users,
  BarChart3,
  Settings,
  ShieldCheck,
  Coins,
} from "lucide-react";

interface OnboardingStep {
  icon: React.ElementType;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

const STUDENT_STEPS: OnboardingStep[] = [
  {
    icon: BookOpen,
    title: "Bem-vindo à MOZAI!",
    description: "Este é o seu Dashboard — aqui acompanha o seu progresso, nível e certificados sempre que entra na plataforma.",
  },
  {
    icon: Brain,
    title: "Tutor de IA",
    description: "Em cada lição, pode tirar dúvidas em tempo real com o Tutor de IA — as suas perguntas ajudam a construir o seu Perfil Cognitivo (Digital Twin).",
    actionLabel: "Ver Meus Cursos",
    actionHref: "/dashboard/my-courses",
  },
  {
    icon: Trophy,
    title: "Gamificação e Percurso Adaptativo",
    description: "Ganha MZ (pontos de experiência) ao concluir lições e projetos. O Dashboard também sugere o que rever com base no seu desempenho real.",
    actionLabel: "Ver Progresso",
    actionHref: "/dashboard/personal/progress",
  },
];

const COMPANY_STEPS: OnboardingStep[] = [
  {
    icon: Building,
    title: "Bem-vindo à Gestão da sua Empresa",
    description: "A partir daqui gere os colaboradores, o progresso deles e os pagamentos da sua organização na MOZAI.",
  },
  {
    icon: GraduationCap,
    title: "Academia Corporativa",
    description: "Monte o currículo próprio da sua empresa a partir do catálogo da MOZAI e aplique-o a todos os colaboradores de uma vez.",
    actionLabel: "Configurar Academia",
    actionHref: "/dashboard/admin/academy",
  },
  {
    icon: BarChart3,
    title: "Gestão de RH e Relatórios",
    description: "Acompanhe o progresso individual de cada colaborador e consulte relatórios agregados da empresa.",
    actionLabel: "Ver Gestão de RH",
    actionHref: "/dashboard/admin/hr",
  },
];

const ACADEMIC_STEPS: OnboardingStep[] = [
  {
    icon: GraduationCap,
    title: "Bem-vindo, Formador(a)",
    description: "Aqui pode acompanhar turmas, responder a dúvidas pedagógicas e criar conteúdo estruturado para as lições.",
  },
  {
    icon: Users,
    title: "Fábrica de Cursos (IA)",
    description: "Crie ou edite cursos completos com apoio de IA — módulos, lições em blocos, quizzes, laboratórios de código e simulações.",
    actionLabel: "Abrir Fábrica de Cursos",
    actionHref: "/dashboard/admin/content-factory",
  },
  {
    icon: BarChart3,
    title: "Avaliação de Projetos",
    description: "Reveja e avalie os projetos práticos submetidos pelos alunos, com nota e feedback.",
    actionLabel: "Ver Avaliações",
    actionHref: "/dashboard/admin/projects",
  },
];

const ADMIN_STEPS: OnboardingStep[] = [
  {
    icon: Settings,
    title: "Bem-vindo, Administrador(a)",
    description: "Tem acesso total à configuração da plataforma — empresas, utilizadores, perfis de acesso e auditoria.",
  },
  {
    icon: ShieldCheck,
    title: "Perfis de Acesso e Auditoria",
    description: "Defina permissões por perfil em Configurações > Perfis de Acesso, e consulte todo o histórico de ações em Relatórios > Auditoria.",
    actionLabel: "Ver Perfis de Acesso",
    actionHref: "/dashboard/admin/roles",
  },
  {
    icon: Building,
    title: "Gestão de Empresas",
    description: "Configure empresas clientes (tenants), o seu branding e o acesso corporativo à plataforma.",
    actionLabel: "Configurar Empresa",
    actionHref: "/dashboard/admin",
  },
];

const FINANCE_STEPS: OnboardingStep[] = [
  {
    icon: Coins,
    title: "Bem-vindo, Financeiro",
    description: "Acompanhe pagamentos, valide depósitos manuais e emita recibos em PDF para os clientes da plataforma.",
    actionLabel: "Ver Pagamentos",
    actionHref: "/dashboard/financial/payments",
  },
];

function stepsForRole(role: string | null): OnboardingStep[] {
  switch (role) {
    case "GESTOR_EMPRESA":
    case "FUNCIONARIO":
      return COMPANY_STEPS;
    case "GESTOR_ACADEMICO":
    case "PROFESSOR":
    case "FORMADOR":
    case "TUTOR":
      return ACADEMIC_STEPS;
    case "ADMIN":
    case "SUPORTE":
      return ADMIN_STEPS;
    case "FINANCEIRO":
      return FINANCE_STEPS;
    case "ALUNO":
    default:
      return STUDENT_STEPS;
  }
}

export default function OnboardingModal({ activeRole }: { activeRole: string | null }) {
  const [visible, setVisible] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const steps = stepsForRole(activeRole);
  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  const finish = () => {
    setVisible(false);
    fetch("/api/onboarding/complete", { method: "POST" }).catch(() => {
      // silencioso — pior caso, o guia reaparece na próxima sessão, sem impacto funcional
    });
  };

  if (!visible) return null;

  const Icon = step.icon;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md border border-indigo-500/20 bg-[#0b0f19] rounded-3xl shadow-2xl p-8 relative space-y-6">
        <button
          onClick={finish}
          className="absolute right-4 top-4 h-8 w-8 rounded-full border border-slate-900 bg-slate-950/50 flex items-center justify-center text-slate-500 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-400" />
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
            Passo {stepIndex + 1} de {steps.length}
          </span>
        </div>

        <div className="flex flex-col items-center text-center space-y-4 py-2">
          <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Icon className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white">{step.title}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{step.description}</p>
          </div>
          {step.actionHref && (
            <Link
              href={step.actionHref}
              onClick={finish}
              className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 hover:underline"
            >
              {step.actionLabel} →
            </Link>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={stepIndex === 0}
            className="h-9 px-3.5 rounded-xl border border-slate-800 text-xs font-semibold text-slate-400 hover:bg-slate-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Anterior
          </button>

          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === stepIndex ? "w-5 bg-indigo-500" : "w-1.5 bg-slate-800"}`} />
            ))}
          </div>

          {isLastStep ? (
            <button
              onClick={finish}
              className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              Concluir
            </button>
          ) : (
            <button
              onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
              className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5"
            >
              Seguinte
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
