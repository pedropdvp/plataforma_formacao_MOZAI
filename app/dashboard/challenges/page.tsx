"use client";

import React from "react";
import { Terminal, ShieldCheck, Clock, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ChallengesPage() {
  return (
    <div className="min-h-[500px] flex flex-col items-center justify-center text-center px-4 space-y-6">
      <div className="h-16 w-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 animate-pulse">
        <Terminal className="h-8 w-8" />
      </div>

      <div className="space-y-2 max-w-md">
        <h1 className="text-3xl font-extrabold text-white">Desafios de Código</h1>
        <span className="text-xs text-indigo-400 font-semibold uppercase tracking-wider block">Brevemente / Coming Soon</span>
        <p className="text-sm text-slate-400 leading-relaxed pt-2">
          Desafios semanais de algoritmos, engenharia de prompt e segurança de Smart Contracts com prémios em créditos IA adicionais.
        </p>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500 font-medium py-3 border-t border-b border-slate-900/60 w-full max-w-sm justify-center">
        <span className="flex items-center gap-1">
          <Clock className="h-4 w-4 text-indigo-400" />
          Lançamento Brevemente
        </span>
      </div>

      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 px-5 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao Dashboard
      </Link>
    </div>
  );
}
