"use client";

import { useToast } from "@/components/ui/toast-provider";

import React from "react";
import { CreditCard, CheckCircle2, Star, ShieldCheck } from "lucide-react";

export default function SubscriptionsPage() {
  const { showToast } = useToast();
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <CreditCard className="h-7 w-7 text-indigo-400" />
          Planos de Subscrição
        </h1>
        <p className="text-sm text-slate-400">
          Consulte o seu plano atual e explore outras opções para expandir o seu acesso.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl">
        {/* Basic Plan */}
        <div className="border-2 border-indigo-500/30 bg-[#070b13] rounded-3xl p-8 relative overflow-hidden flex flex-col justify-between shadow-2xl">
          <div className="absolute top-0 right-0 bg-indigo-500 text-slate-950 text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
            Plano Ativo
          </div>
          
          <div className="space-y-4">
            <div>
              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block">MOZAI Starter</span>
              <h3 className="text-2xl font-extrabold text-white mt-1">MOZAI – Basic</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Ideal para desenvolvedores que querem dominar programação moderna e inteligência artificial prática.
              </p>
            </div>

            <div className="py-2 border-t border-b border-slate-900 text-xs space-y-2">
              <span className="text-slate-500 block">Vantagens incluídas:</span>
              <ul className="space-y-2.5 text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                  <span>Acesso aos cursos estruturados</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                  <span>Práticas guiadas no Coding Lab</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                  <span>Tutor IA básico ativo</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 mt-6">
            <span className="text-2xl font-extrabold text-white block">19,90 € <span className="text-xs text-slate-500 font-normal">/ mês</span></span>
            <button
              disabled
              className="w-full h-10 rounded-xl bg-indigo-500/10 text-indigo-400 text-xs font-semibold mt-4 border border-indigo-500/20"
            >
              Plano Subscrito
            </button>
          </div>
        </div>

        {/* Premium Plan Upgrade */}
        <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-8 flex flex-col justify-between hover:border-slate-800 transition-colors shadow-xl">
          <div className="space-y-4">
            <div>
              <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider block">MOZAI PRO</span>
              <h3 className="text-2xl font-extrabold text-white mt-1">MOZAI – Premium</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Para profissionais que buscam mentoria direta de carreira, treino coletivo com áudio/vídeo e avatares avançados.
              </p>
            </div>

            <div className="py-2 border-t border-b border-slate-900 text-xs space-y-2">
              <span className="text-slate-500 block">Tudo do Basic, mais:</span>
              <ul className="space-y-2.5 text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                  <span>Acesso ilimitado ao Career OS</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                  <span>Créditos IA ilimitados</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                  <span>Salas de Treino Coletivas com IA</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 mt-6">
            <span className="text-2xl font-extrabold text-white block">39,90 € <span className="text-xs text-slate-500 font-normal">/ mês</span></span>
            <button
              onClick={() => showToast("A iniciar checkout de upgrade para o plano Premium...", "info")}
              className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold mt-4 text-white transition-all shadow-lg shadow-indigo-600/10 cursor-pointer"
            >
              Fazer Upgrade
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
