"use client";

import React from "react";
import { ShieldAlert, LogOut, ArrowLeft } from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.05),transparent_60%)]" />

      <div className="w-full max-w-md border border-slate-900 bg-slate-900/10 backdrop-blur-md rounded-3xl p-8 shadow-2xl text-center space-y-6 relative z-10 hover:border-indigo-500/20 transition-all">
        {/* Warning Icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
          <ShieldAlert className="h-8 w-8" />
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-white tracking-wide">Acesso Não Autorizado</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            A sua conta não se encontra registada na base de dados da plataforma **MOZAI**.
          </p>
          <p className="text-xs text-slate-500">
            Apenas utilizadores previamente cadastrados pela administração global ou pela sua entidade gestora têm autorização de acesso.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 pt-2">
          <SignOutButton redirectUrl="/sign-in">
            <button className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition-all cursor-pointer hover:shadow-lg hover:shadow-indigo-500/25">
              <LogOut className="h-4 w-4" />
              Sair e Iniciar Sessão com Outra Conta
            </button>
          </SignOutButton>

          <Link
            href="/"
            className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-900 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar à Página Inicial
          </Link>
        </div>
      </div>
    </div>
  );
}
