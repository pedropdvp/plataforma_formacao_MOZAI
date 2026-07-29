"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Compass, AlertTriangle, Brain, Flame, CheckCircle2, Loader2 } from "lucide-react";

interface Recommendation {
  id: string;
  type: "review" | "reinforce" | "pace" | "healthy";
  priority: "alta" | "media" | "baixa";
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}

const TYPE_ICONS: Record<Recommendation["type"], React.ElementType> = {
  review: AlertTriangle,
  reinforce: Brain,
  pace: Flame,
  healthy: CheckCircle2,
};

const TYPE_COLORS: Record<Recommendation["type"], string> = {
  review: "text-rose-400 bg-rose-500/5 border-rose-500/10",
  reinforce: "text-amber-400 bg-amber-500/5 border-amber-500/10",
  pace: "text-cyan-400 bg-cyan-500/5 border-cyan-500/10",
  healthy: "text-emerald-400 bg-emerald-500/5 border-emerald-500/10",
};

/**
 * Percurso Adaptativo — Passo 1 (regras sobre retenção/velocidade) + Passo 2 (áreas
 * fracas por lição + tópicos de dificuldade do Digital Twin). Ver lib/adaptive-learning.ts.
 */
export default function AdaptiveLearningPanel() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/adaptive-learning");
        if (res.ok) {
          const data = await res.json();
          setRecommendations(data.recommendations || []);
        }
      } catch (error) {
        console.error("Erro ao carregar percurso adaptativo:", error);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading) {
    return (
      <section className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 md:p-8 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Compass className="h-4.5 w-4.5 text-indigo-400" />
          Percurso Adaptativo
        </h2>
        <div className="flex items-center justify-center py-6 text-slate-500 gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
          <span className="text-xs font-medium">A analisar o seu desempenho...</span>
        </div>
      </section>
    );
  }

  if (recommendations.length === 0) return null;

  return (
    <section className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 md:p-8 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Compass className="h-4.5 w-4.5 text-indigo-400" />
          Percurso Adaptativo
        </h2>
        <p className="text-[11px] text-slate-500 mt-1">
          Recomendações personalizadas com base no seu desempenho real — retenção, ritmo e dúvidas ao Tutor de IA.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {recommendations.map((rec) => {
          const Icon = TYPE_ICONS[rec.type];
          return (
            <div key={rec.id} className={`p-4 rounded-2xl border space-y-2 ${TYPE_COLORS[rec.type]}`}>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0" />
                <h3 className="font-bold text-xs text-white">{rec.title}</h3>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{rec.description}</p>
              <Link href={rec.actionHref} className="inline-block text-[11px] font-semibold underline hover:no-underline">
                {rec.actionLabel} →
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
