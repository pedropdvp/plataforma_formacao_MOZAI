"use client";

import { useToast } from "@/components/ui/toast-provider";

import React from "react";
import Link from "next/link";
import { MessageSquare, Library, Play, ArrowRight } from "lucide-react";

interface CourseForum {
  id: string;
  title: string;
  category: string;
  threadsCount: number;
}

const AVAILABLE_FORUMS: CourseForum[] = [
  { id: "course-1", title: "Engenharia de IA e RAG Avançado", category: "Inteligência Artificial", threadsCount: 24 },
  { id: "course-2", title: "Next.js 16 e Arquiteturas Composable SaaS", category: "Programação / Frontend", threadsCount: 15 },
  { id: "course-4", title: "Prompt Engineering Essentials", category: "Inteligência Artificial", threadsCount: 8 },
];

export default function ForumPage() {
  const { showToast } = useToast();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <MessageSquare className="h-7 w-7 text-indigo-400" />
          Fórum de Discussão
        </h1>
        <p className="text-sm text-slate-400">
          Selecione um curso para aceder ao fórum.
        </p>
      </div>

      {/* Forums List */}
      <div className="grid md:grid-cols-3 gap-8">
        {AVAILABLE_FORUMS.map((forum) => (
          <div
            key={forum.id}
            className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 flex flex-col justify-between hover:border-slate-800 transition-colors shadow-xl group"
          >
            <div className="space-y-2">
              <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider block">
                {forum.category}
              </span>
              <h3 className="font-bold text-base text-white group-hover:text-indigo-400 transition-colors">
                {forum.title}
              </h3>
              <p className="text-xs text-slate-500">
                {forum.threadsCount} tópicos de discussão ativos
              </p>
            </div>

            <div className="pt-6 border-t border-slate-900/60 mt-6">
              <button
                onClick={() => showToast(`A abrir fórum do curso: ${forum.title}`, "info")}
                className="w-full inline-flex items-center justify-center h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white transition-colors group-hover:bg-indigo-600 gap-1.5 cursor-pointer"
              >
                Aceder ao Fórum
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
