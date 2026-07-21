"use client";

import { useToast } from "@/components/ui/toast-provider";

import React from "react";
import { MessageSquare, ExternalLink, ShieldCheck } from "lucide-react";

export default function TelegramIaPage() {
  const { showToast } = useToast();
  const handleOpenTelegram = () => {
    showToast("A abrir ligação do grupo de Telegram da comunidade MOZAI...", "info");
    window.open("https://t.me/mozai_community_mock", "_blank");
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <MessageSquare className="h-7 w-7 text-indigo-400" />
          Telegram IA
        </h1>
        <p className="text-sm text-slate-400">
          Aceda ao grupo exclusivo de alunos e receba atualizações e alertas de IA diretamente no Telegram.
        </p>
      </div>

      <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-8 max-w-xl text-center space-y-6 flex flex-col items-center justify-center min-h-[350px]">
        <div className="h-16 w-16 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
          <MessageSquare className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white">Grupo Oficial MOZAI</h3>
          <p className="text-xs text-slate-450 leading-relaxed max-w-md mx-auto">
            Junte-se à nossa comunidade ativa para fazer networking com outros programadores e partilhar insights técnicos sobre IA, além de obter ajuda dos moderadores.
          </p>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-emerald-450 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
          <ShieldCheck className="h-3.5 w-3.5" />
          Acesso Incluído na Subscrição
        </div>

        <button
          onClick={handleOpenTelegram}
          className="h-10 px-6 rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-xs font-semibold text-white transition-all flex items-center gap-1.5 shadow-lg shadow-sky-500/10 cursor-pointer"
        >
          Aceder ao Telegram
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
