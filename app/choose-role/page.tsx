"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, BookOpen, GraduationCap, Users, Settings, Briefcase, RefreshCw, Coins } from "lucide-react";

interface RoleMetadata {
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
}

const ROLE_METADATA: Record<string, RoleMetadata> = {
  ADMIN: {
    name: "Administrador",
    description: "Configuração global, auditoria e gestão corporativa de empresas.",
    icon: Settings,
    color: "text-rose-455 bg-rose-500/10 border-rose-500/20"
  },
  GESTOR_EMPRESA: {
    name: "Gestor da Empresa",
    description: "Gerir colaboradores, faturas e acompanhar relatórios corporativos B2B.",
    icon: Briefcase,
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20"
  },
  FUNCIONARIO: {
    name: "Funcionário",
    description: "Tarefas operacionais delegadas, gerir faturas e formandos da empresa.",
    icon: Users,
    color: "text-slate-300 bg-slate-500/10 border-slate-500/20"
  },
  ALUNO: {
    name: "Aluno / Formando",
    description: "Aceder à sala de aula, realizar quizzes e emitir certificados.",
    icon: BookOpen,
    color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
  },
  GESTOR_ACADEMICO: {
    name: "Gestor Académico",
    description: "Planeamento pedagógico, criação de cursos e docência de turmas.",
    icon: GraduationCap,
    color: "text-violet-400 bg-violet-500/10 border-violet-500/20"
  },
  PROFESSOR: {
    name: "Professor",
    description: "Lecionar turmas, propor avaliações e responder a dúvidas pedagógicas.",
    icon: GraduationCap,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
  },
  FORMADOR: {
    name: "Formador",
    description: "Criação de conteúdos estruturados e parágrafos semânticos para as lições.",
    icon: BookOpen,
    color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20"
  },
  TUTOR: {
    name: "Tutor de Aprendizagem",
    description: "Acompanhar alunos no player e dar apoio direto às lições.",
    icon: Users,
    color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20"
  },
  FINANCEIRO: {
    name: "Financeiro",
    description: "Controlo de pagamentos, validação de depósitos e recibos em PDF.",
    icon: Coins,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
  },
  SUPORTE: {
    name: "Suporte Técnico",
    description: "Incidentes técnicos, monitorização de APIs e auditoria de infraestrutura.",
    icon: Shield,
    color: "text-rose-455 bg-rose-500/10 border-rose-500/20"
  }
};

export default function ChooseRolePage() {
  const router = useRouter();
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectingRole, setSelectingRole] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const data = await res.json();
          setRoles(data.assignedRoles || []);
          
          // Se tiver apenas 1 perfil atribuído, escolhe-o automaticamente e avança
          if (data.assignedRoles?.length === 1) {
            await selectRole(data.assignedRoles[0]);
            return;
          }
        }
      } catch (err) {
        console.error("Erro ao obter perfis:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchSession();
  }, []);

  const selectRole = async (role: string) => {
    setSelectingRole(role);
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        // Recarregar a página para atualizar o estado de navegação
        router.refresh();
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Erro ao selecionar perfil:", err);
    } finally {
      setSelectingRole(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-500 gap-3">
        <RefreshCw className="h-7 w-7 animate-spin text-indigo-500" />
        <span className="text-sm font-semibold">A obter as suas credenciais MOZAI...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-2xl w-full space-y-8 relative z-10 text-center">
        {/* Header */}
        <div className="space-y-3">
          <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto shadow-lg shadow-indigo-500/5">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Escolha o seu Perfil de Acesso</h1>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Identificámos múltiplas funções associadas ao seu perfil de utilizador nesta empresa. Selecione a função ativa para esta sessão.
          </p>
        </div>

        {/* Roles Grid */}
        <div className="grid md:grid-cols-2 gap-4 text-left">
          {roles.map((role) => {
            const meta = ROLE_METADATA[role] || {
              name: role,
              description: "Acesso genérico ao portal.",
              icon: Shield,
              color: "text-slate-400 bg-slate-500/10 border-slate-500/20"
            };
            const Icon = meta.icon;
            const isPending = selectingRole === role;

            return (
              <button
                key={role}
                disabled={selectingRole !== null}
                onClick={() => selectRole(role)}
                className="border border-slate-900 bg-slate-950/40 rounded-3xl p-5 hover:border-slate-800 transition-all text-left flex gap-4 cursor-pointer group hover:bg-slate-900/10 focus:outline-none disabled:opacity-55"
              >
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 border ${meta.color} group-hover:scale-105 transition-transform`}>
                  {isPending ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-sm text-white group-hover:text-indigo-400 transition-colors">
                    {meta.name}
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    {meta.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="text-slate-650 text-xs italic font-medium">
          Poderá alternar de perfil a qualquer momento a partir do menu do seu perfil no dashboard.
        </div>
      </div>
    </div>
  );
}
