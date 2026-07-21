"use client";

import React from "react";
import { Compass, Play, BookOpen, Terminal, Sparkles, ShieldAlert } from "lucide-react";

export default function UserGuidePage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <Compass className="h-7 w-7 text-indigo-400 animate-spin-slow" />
          Guia de Utilização da Plataforma
        </h1>
        <p className="text-sm text-slate-400">
          Manual de instruções rápidas para navegar e operar as principais ferramentas do MOZAI Workspace.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Panel 1: Navigation */}
        <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-400" />
            Navegação de Cursos
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Pode alternar entre os seus cursos em progresso, cursos concluídos ou cursos a efetuar na página inicial. Utilize os filtros de abas por categoria para encontrar tópicos de IA, Frontend ou Blockchain num piscar de olhos.
          </p>
        </div>

        {/* Panel 2: Interactive Labs */}
        <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Terminal className="h-5 w-5 text-indigo-400" />
            Coding Lab e Editor
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Dentro de cada lição de programação, terá acesso ao Coding Lab. Pode escrever código, compilar em tempo real e executar testes integrados com feedback instantâneo sobre erros sintáticos ou lógicos.
          </p>
        </div>

        {/* Panel 3: Content Factory */}
        <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-400" />
            Content Factory (Administradores)
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Se for administrador de empresa, use o Content Factory para gerar dinamicamente estruturas curriculares completas, resumos de aulas e quizzes personalizados em segundos usando Inteligência Artificial.
          </p>
        </div>

        {/* Panel 4: Avatars & Soft-skills */}
        <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Compass className="h-5 w-5 text-indigo-400" />
            Treino com Avatares
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Melhore as suas habilidades de comunicação, pitches de investimento e soft-skills gerais gravando áudio/vídeo em simulações interativas com avatares de IA que respondem e avaliam a sua atitude profissional.
          </p>
        </div>
      </div>
    </div>
  );
}
