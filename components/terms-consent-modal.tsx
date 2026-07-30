"use client";

import React, { useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";

/**
 * Gate de consentimento RGPD/GDPR — não pode ser fechado sem aceitar (não é um "tour"
 * dispensável como o OnboardingModal). Reaparece sempre que CURRENT_TERMS_VERSION
 * (lib/compliance.ts) subir de versão, mesmo para quem já tinha aceitado a anterior.
 */
export default function TermsConsentModal() {
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [visible, setVisible] = useState(true);

  const handleAccept = async () => {
    if (!checked || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/compliance/consent", { method: "POST" });
      if (res.ok) {
        setVisible(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg border border-slate-800 bg-[#0b0f19] rounded-3xl shadow-2xl p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <ShieldCheck className="h-5.5 w-5.5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Termos & Política de Privacidade</h3>
            <p className="text-[11px] text-slate-500">Atualização necessária antes de continuar</p>
          </div>
        </div>

        <div className="text-xs text-slate-400 leading-relaxed space-y-2 max-h-40 overflow-y-auto pr-1 border-t border-b border-slate-900 py-4">
          <p>
            A MOZAI trata os seus dados pessoais (nome, e-mail, progresso académico, submissões e interações com o Tutor de IA)
            exclusivamente para prestar o serviço de formação — nunca são vendidos a terceiros.
          </p>
          <p>
            Tem o direito de aceder, exportar e pedir a eliminação dos seus dados a qualquer momento, disponível em
            "Pessoal &gt; Privacidade &amp; Dados" no seu dashboard.
          </p>
          <p>
            Ao continuar, confirma que leu e aceita os Termos de Utilização e a Política de Privacidade da plataforma.
          </p>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="h-4 w-4 mt-0.5 rounded border-slate-800 bg-slate-950 accent-indigo-500 cursor-pointer"
          />
          <span className="text-xs text-slate-300">Li e aceito os Termos de Utilização e a Política de Privacidade.</span>
        </label>

        <button
          onClick={handleAccept}
          disabled={!checked || submitting}
          className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Aceitar e Continuar
        </button>
      </div>
    </div>
  );
}
