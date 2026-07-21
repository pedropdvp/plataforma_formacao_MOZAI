"use client";

import { useToast } from "@/components/ui/toast-provider";

import React, { useState } from "react";
import { Cpu, Zap, ShoppingBag, ArrowRight } from "lucide-react";

export default function AiCreditsPage() {
  const [credits, setCredits] = useState(150);

  const handleBuyCredits = (amount: number, price: string) => {
    alert(`Compra de ${amount} créditos IA iniciada no valor de ${price}.`);
    setCredits((prev) => prev + amount);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <Cpu className="h-7 w-7 text-indigo-400 animate-pulse" />
          Créditos IA
        </h1>
        <p className="text-sm text-slate-400">
          Gerencie e recarregue o seu saldo de créditos utilizados nas requisições do RAG Chatbar e Content Factory.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        {/* Left: Balance Box */}
        <div className="border border-slate-900 bg-[#070b13] rounded-3xl p-8 flex flex-col justify-between items-center text-center space-y-6">
          <div className="space-y-2">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Saldo Disponível</span>
            <span className="text-5xl font-extrabold text-white flex items-center gap-1.5 justify-center">
              <Zap className="h-10 w-10 text-amber-500 fill-amber-500" />
              {credits}
            </span>
            <span className="text-[10px] text-slate-400 block pt-1">Créditos de API</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 text-left text-[11px] text-slate-400 leading-relaxed border border-slate-900">
            <strong>Consumo:</strong> Cada consulta de esclarecimento de dúvidas com o IA Tutor RAG no player consome <strong>1 crédito</strong>. Geração de sumários e resumos avançados consome <strong>5 créditos</strong>.
          </div>
        </div>

        {/* Right: Refill Packages */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-900">
            Recarregar Saldo
          </h3>

          <div className="grid sm:grid-cols-2 gap-6">
            {/* Package 1 */}
            <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 flex flex-col justify-between hover:border-slate-800 transition-colors shadow-xl group">
              <div className="space-y-2">
                <span className="text-xs text-indigo-400 font-semibold uppercase block">Pack Bronze</span>
                <h4 className="text-lg font-bold text-white flex items-center gap-1">
                  <Zap className="h-4 w-4 text-amber-500 fill-amber-500" />
                  100 Créditos IA
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Ideal para rever conteúdos pontuais e consultas rápidas.
                </p>
              </div>

              <div className="pt-6 border-t border-slate-900/60 mt-6 flex items-center justify-between">
                <span className="text-lg font-extrabold text-white">4,90 €</span>
                <button
                  onClick={() => handleBuyCredits(100, "4,90 €")}
                  className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-indigo-650 text-xs font-semibold text-white group-hover:bg-indigo-650 transition-all flex items-center gap-1 cursor-pointer"
                >
                  Adquirir
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Package 2 */}
            <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 flex flex-col justify-between hover:border-slate-800 transition-colors shadow-xl group">
              <div className="space-y-2">
                <span className="text-xs text-indigo-400 font-semibold uppercase block">Pack Prata</span>
                <h4 className="text-lg font-bold text-white flex items-center gap-1">
                  <Zap className="h-4 w-4 text-amber-500 fill-amber-500" />
                  500 Créditos IA
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Recomendado para estudantes ativos que utilizam o tutor de IA extensivamente diariamente.
                </p>
              </div>

              <div className="pt-6 border-t border-slate-900/60 mt-6 flex items-center justify-between">
                <span className="text-lg font-extrabold text-white">19,90 €</span>
                <button
                  onClick={() => handleBuyCredits(500, "19,90 €")}
                  className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-indigo-650 text-xs font-semibold text-white group-hover:bg-indigo-650 transition-all flex items-center gap-1 cursor-pointer"
                >
                  Adquirir
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
