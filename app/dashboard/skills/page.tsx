"use client";

import React, { useState, useEffect } from "react";
import { Network, Award, Zap, ChevronRight, HelpCircle, Loader2, TrendingDown, GitBranch, List } from "lucide-react";
import { SkillsGraphCanvas } from "@/components/skills-graph-canvas";

interface SkillNode {
  id: string;
  label: string;
  score: number;
  type: string;
  level: string;
  connections: string[];
  daysSinceActivity: number | null;
}

export default function SkillsOSPage() {
  const [skills, setSkills] = useState<SkillNode[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<SkillNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retentionPct, setRetentionPct] = useState(0);
  const [velocityPct, setVelocityPct] = useState(0);
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph");

  useEffect(() => {
    async function loadSkills() {
      try {
        const res = await fetch("/api/skills-os");
        if (res.ok) {
          const data = await res.json();
          const nodes: SkillNode[] = data.nodes || [];
          setSkills(nodes);
          setSelectedSkill(nodes[0] || null);
          setRetentionPct(data.retentionPct || 0);
          setVelocityPct(data.velocityPct || 0);
        }
      } catch (error) {
        console.error("Erro ao carregar o Grafo de Competências:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSkills();
  }, []);

  return (
    <div className="space-y-8 workspace-page-container">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Network className="h-6 w-6 text-indigo-400" />
          AI Skills OS: Grafo de Competências
        </h1>
        <p className="text-sm text-slate-400">
          A pontuação de cada competência deriva da média real dos seus quizzes, com decaimento se não praticar — não é um valor fixo.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          <span className="text-xs font-medium">A compilar o grafo de fluência...</span>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Grafo / Lista de Nós interativos */}
          <div className="lg:col-span-2 border border-slate-900 bg-slate-900/10 rounded-3xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Zap className="h-4.5 w-4.5 text-yellow-400" />
                Estrutura de Fluência (Mapeamento Dinâmico)
              </h3>
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-900">
                <button
                  onClick={() => setViewMode("graph")}
                  className={`h-7 px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                    viewMode === "graph" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <GitBranch className="h-3.5 w-3.5" /> Grafo
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`h-7 px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                    viewMode === "list" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <List className="h-3.5 w-3.5" /> Lista
                </button>
              </div>
            </div>

            {viewMode === "graph" ? (
              <SkillsGraphCanvas
                nodes={skills}
                selectedId={selectedSkill?.id || null}
                onSelect={(id) => setSelectedSkill(skills.find((s) => s.id === id) || null)}
              />
            ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
              {skills.map((node) => {
                const isSelected = selectedSkill?.id === node.id;
                const isLocked = node.level === "Bloqueado" || node.score === 0;
                const isDecaying = node.daysSinceActivity !== null && node.daysSinceActivity > 30;

                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedSkill(node)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-500/5 shadow-md shadow-indigo-500/10"
                        : isLocked
                        ? "border-slate-950 bg-slate-950/20 opacity-55 hover:border-slate-900"
                        : "border-slate-900 bg-slate-950/40 hover:border-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Circle metric */}
                      <div className={`h-10 w-10 rounded-full border bg-slate-950 flex items-center justify-center font-mono text-xs font-bold ${
                        isLocked ? "border-slate-900 text-slate-600" : "border-slate-800 text-indigo-400"
                      }`}>
                        {node.score}%
                      </div>
                      <div>
                        <h4 className={`font-bold text-sm flex items-center gap-1.5 ${isLocked ? "text-slate-500" : "text-white"}`}>
                          {node.label}
                          {isDecaying && !isLocked && (
                            <span title="Em decaimento por inatividade">
                              <TrendingDown className="h-3.5 w-3.5 text-amber-400" />
                            </span>
                          )}
                        </h4>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                          {node.type} &bull; {node.level}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Relacionamento com seta para o próximo nó */}
                      {node.connections.length > 0 && !isLocked && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <span>Requisito para:</span>
                          {node.connections.map((c) => (
                            <span key={c} className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 font-mono text-[10px]">
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                      <ChevronRight className="h-4 w-4 text-slate-650" />
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>

          {/* Painel Lateral de Detalhes da Habilidade Selecionada */}
          <div className="space-y-6">
            {selectedSkill ? (
              <div className="border border-indigo-500/20 bg-slate-900/10 rounded-3xl p-6 space-y-6">
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">
                    Avaliação da IA
                  </span>
                  <h3 className="text-xl font-bold text-white">{selectedSkill.label}</h3>
                </div>

                {/* Métricas Detalhadas do Digital Twin */}
                <div className="space-y-4 pt-4 border-t border-slate-900">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Retenção Pedagógica</span>
                      <span className="font-bold text-white" title="Média real de acerto em todos os quizzes respondidos">{retentionPct}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${retentionPct}%` }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Velocidade de Execução</span>
                      <span className="font-bold text-white" title="Ritmo real de lições concluídas nos últimos 7 dias">{velocityPct}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 rounded-full transition-all duration-300" style={{ width: `${velocityPct}%` }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Confiança da Fluência</span>
                      <span className="font-bold text-white">{selectedSkill.score}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${selectedSkill.score}%` }} />
                    </div>
                    {selectedSkill.daysSinceActivity !== null && selectedSkill.daysSinceActivity > 30 && (
                      <p className="text-[10px] text-amber-400 flex items-center gap-1 pt-1">
                        <TrendingDown className="h-3 w-3" />
                        Sem prática há {selectedSkill.daysSinceActivity} dias — a fluência está a decair.
                      </p>
                    )}
                  </div>
                </div>

                {/* Recomendação Personalizada por IA */}
                <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-3">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Award className="h-4 w-4 text-indigo-400" />
                    Gap Analysis Recomendada
                  </h4>
                  <p className="text-[11px] text-slate-450 leading-relaxed">
                    {selectedSkill.score === 0 ? (
                      `Esta competência encontra-se bloqueada. Inicie o curso e conclua as lições associadas para abrir esta ramificação do Grafo de Competências.`
                    ) : selectedSkill.daysSinceActivity !== null && selectedSkill.daysSinceActivity > 30 ? (
                      `Já não pratica "${selectedSkill.label}" há ${selectedSkill.daysSinceActivity} dias e a sua fluência está a decair. Refaça o quiz ou reveja a lição para recuperar a pontuação.`
                    ) : selectedSkill.score < 70 ? (
                      `A IA detetou fragilidades em ${selectedSkill.label}. Sugerimos concluir os exercícios práticos da aula correspondente para subir a sua proficiência.`
                    ) : (
                      `Excelente domínio! A sua fluência em ${selectedSkill.label} está consolidada. A IA recomenda focar no preenchimento de requisitos para: ${selectedSkill.connections.join(", ") || 'novos temas'}.`
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div className="border border-slate-900 bg-slate-900/10 rounded-3xl p-6 text-center text-slate-500">
                <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Selecione uma competência para ver os detalhes
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
