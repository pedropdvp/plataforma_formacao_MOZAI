"use client";

import { useToast } from "@/components/ui/toast-provider";

import React, { useState } from "react";
import { CreditCard, ShieldCheck, Download, QrCode, Sparkles, UserCheck } from "lucide-react";

export default function ProfessionalCardPage() {
  const { showToast } = useToast();
  const [specialty, setSpecialty] = useState("Engenharia de Prompt e IA Generativa");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <CreditCard className="h-7 w-7 text-indigo-400" />
          Cartão Profissional
        </h1>
        <p className="text-sm text-slate-400">
          O seu cartão profissional atesta a sua qualificação como Especialista certificado pela MOZAI International.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Digital Card Mockup (Holographic tilt effect container) */}
        <div className="lg:col-span-2 flex flex-col items-center justify-center p-8 rounded-3xl border border-slate-900 bg-slate-950/20 space-y-6">
          <span className="text-xs text-slate-500 font-medium">Cartão Digital Interativo (Passe o cursor ou toque)</span>

          {/* Interactive Card */}
          <div className="relative w-full max-w-[430px] aspect-[1.586/1] rounded-3xl bg-gradient-to-br from-[#0c0d1a] via-[#151730] to-[#0a0a14] border border-indigo-500/30 p-6 flex flex-col justify-between shadow-2xl overflow-hidden group hover:border-indigo-400 transition-all duration-300">
            {/* Holographic metallic reflection lines overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            
            {/* Top Logo and verification badge */}
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-bold text-white tracking-widest">MOZAI</span>
              </div>
              <div className="flex items-center gap-1 text-[9px] text-indigo-300 font-semibold bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                Internacional
              </div>
            </div>

            {/* Middle: User Role and Name */}
            <div className="space-y-1 relative z-10">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest block font-medium">QUALIFICAÇÃO CERTIFICADA</span>
              <span className="text-base font-extrabold text-white block truncate">Estudante MOZAI</span>
              <p className="text-[10px] text-indigo-300 font-semibold bg-indigo-500/5 border border-indigo-500/10 px-2.5 py-1 rounded-lg w-fit">
                Especialista em {specialty}
              </p>
            </div>

            {/* Bottom info: ID, QR Code and Expiry */}
            <div className="flex items-end justify-between border-t border-slate-900/60 pt-4 relative z-10">
              <div className="space-y-0.5">
                <span className="text-[7px] text-slate-500 block">ID DE CREDENCIAL</span>
                <span className="font-mono text-[10px] text-slate-300 font-bold select-all">MZ-CARD-94821</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[7px] text-slate-500 block">VÁLIDO ATÉ</span>
                  <span className="text-[9px] text-slate-350 font-bold">12/07/2027</span>
                </div>
                <div className="p-1 bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
                  <QrCode className="h-6 w-6 text-slate-950" />
                </div>
              </div>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex gap-4">
            <button
              onClick={() => showToast("A gerar PDF imprimível do Cartão de Identidade Profissional...", "info")}
              className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/10"
            >
              <Download className="h-4 w-4" />
              Descarregar Cartão (PDF)
            </button>
            <button
              onClick={() => showToast("A adicionar credencial profissional ao Apple Wallet...", "info")}
              className="h-10 px-4 rounded-xl border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-900 transition-colors"
            >
              Adicionar ao Wallet
            </button>
          </div>
        </div>

        {/* Right Column: Details & Edit */}
        <div className="space-y-6">
          {/* Card Description explanation */}
          <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <UserCheck className="h-4.5 w-4.5 text-indigo-400" />
              Acreditação Oficial
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              O seu cartão profissional atesta a sua qualificação como <strong>Especialista em {specialty}</strong> certificado pela <strong>MOZAI International</strong>.
            </p>
            <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 text-[11px] text-slate-400 leading-relaxed">
              Este cartão inclui um código QR criptografado que permite a qualquer entidade empregadora validar em tempo real o seu portefólio académico e as suas notas no Coding Lab.
            </div>
          </div>

          {/* Change Specialty Input for Demo */}
          <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider">Simulador de Especialidade</h3>
            <div className="space-y-2">
              <label className="text-[10px] text-slate-500">Defina a especialidade a exibir no cartão:</label>
              <input
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
