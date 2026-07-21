"use client";

import { useToast } from "@/components/ui/toast-provider";

import React from "react";
import { User, ShieldCheck } from "lucide-react";
import { useAccess } from "@/hooks/use-access";

export default function ProfilePage() {
  const { showToast } = useToast();
  const { activeRole, userName, userEmail } = useAccess();

  const displayName = userName || "Utilizador MOZAI";
  const displayEmail = userEmail || "email@mozai.education";

  const nameParts = displayName.trim().split(" ");
  const initials = nameParts.length >= 2 
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
    : displayName.substring(0, 2).toUpperCase();

  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case "ADMIN": return "Administrador da Plataforma";
      case "GESTOR_EMPRESA": return "Gestor Empresa";
      case "FUNCIONARIO": return "Funcionário da Empresa";
      case "ALUNO": return "Aluno";
      case "GESTOR_ACADEMICO": return "Gestor Académico";
      case "PROFESSOR": return "Professor";
      case "FORMADOR": return "Formador";
      case "TUTOR": return "Tutor";
      case "FINANCEIRO": return "Financeiro";
      case "SUPORTE": return "Suporte Técnico";
      default: return role || "Estudante Registado";
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <User className="h-7 w-7 text-indigo-400" />
          A Minha Conta
        </h1>
        <p className="text-sm text-slate-400">
          Gerencie as suas informações pessoais e credenciais de login.
        </p>
      </div>

      <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 max-w-xl space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-900">
          <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-lg font-mono">
            {initials}
          </div>
          <div>
            <h3 className="font-extrabold text-base text-white">{displayName}</h3>
            <span className="text-xs text-slate-500">Membro ativo na MOZAI</span>
          </div>
        </div>

        <div className="space-y-4 text-xs font-medium text-slate-350">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Nome Completo</span>
            <input
              type="text"
              readOnly
              value={displayName}
              className="w-full h-10 px-3 rounded-lg border border-slate-900 bg-slate-950/40 text-slate-300 outline-none select-all"
            />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Endereço de Email</span>
            <input
              type="email"
              readOnly
              value={displayEmail}
              className="w-full h-10 px-3 rounded-lg border border-slate-900 bg-slate-950/40 text-slate-300 outline-none select-all font-mono"
            />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Função do Sistema (Perfil Ativo)</span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full mt-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              {getRoleLabel(activeRole)}
            </span>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-900 flex justify-end">
          <button
            onClick={() => showToast("As alterações de perfil são geridas através do Clerk Auth. A redirecionar...", "info")}
            className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            Editar no Clerk
          </button>
        </div>
      </div>
    </div>
  );
}
