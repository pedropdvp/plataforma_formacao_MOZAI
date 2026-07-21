"use client";

import React from "react";
import { BookOpen, GraduationCap, Clock, Award, ShieldCheck } from "lucide-react";

export default function StudentGuidePage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <BookOpen className="h-7 w-7 text-indigo-400" />
          Guia do Formando
        </h1>
        <p className="text-sm text-slate-400">
          Tudo o que precisa de saber para aproveitar ao máximo a sua jornada de aprendizagem técnica na MOZAI.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        {/* Left main guidelines */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1 */}
          <div className="border border-slate-900 bg-[#070b13] rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-indigo-400" />
              1. Estrutura de Aprendizagem
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Os nossos cursos são compostos por lições em vídeo articuladas com ambientes práticos no <strong>Coding Lab</strong>. O utilizador pode codificar diretamente no ecrã com feedback instantâneo de corretores automáticos alimentados por Inteligência Artificial.
            </p>
          </div>

          {/* Section 2 */}
          <div className="border border-slate-900 bg-[#070b13] rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-400" />
              2. Assistência IA Tutor (RAG)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sempre que tiver dúvidas sobre uma aula, utilize a <strong>Chatbar lateral de IA Tutor</strong> no player. Ela tem acesso ao contexto da aula corrente, código base e transcrissões para dar suporte de esclarecimento personalizado 24/7.
            </p>
          </div>

          {/* Section 3 */}
          <div className="border border-slate-900 bg-[#070b13] rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Award className="h-5 w-5 text-indigo-400" />
              3. Diplomas e Certificações
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              A conclusão a 100% de qualquer curso confere a emissão de um <strong>Certificado de Conclusão</strong> verificado. Alunos de especializações podem também gerar e exportar o seu <strong>Diploma Académico</strong> e <strong>Cartão Profissional</strong>.
            </p>
          </div>
        </div>

        {/* Right tips card */}
        <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
            <ShieldCheck className="h-4.5 w-4.5 text-indigo-400" />
            Dicas Rápidas de Sucesso
          </h3>
          <ul className="space-y-3.5 text-xs text-slate-400 leading-relaxed">
            <li className="flex gap-2">
              <span className="text-indigo-400 font-bold">•</span>
              <span>Dedique pelo menos 30 minutos diários de prática de codificação.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-indigo-400 font-bold">•</span>
              <span>Interaja com os avatares nas salas de treino para melhorar as soft-skills.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-indigo-400 font-bold">•</span>
              <span>Utilize a comunidade oficial para discutir ideias de projetos práticos.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
