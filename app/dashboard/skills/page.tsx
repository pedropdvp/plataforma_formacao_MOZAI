"use client";

import React, { useState, useEffect } from "react";
import { Network, Award, Zap, ChevronRight, HelpCircle, Loader2 } from "lucide-react";

interface SkillNode {
  id: string;
  label: string;
  score: number;
  type: string;
  level: string;
  connections: string[];
}

export default function SkillsOSPage() {
  const [skills, setSkills] = useState<SkillNode[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<SkillNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadProgressAndSkills() {
      try {
        const res = await fetch("/api/progress");
        if (res.ok) {
          const data = await res.json();
          const progressList = data.progress || [];

          // Helper check functions
          const isLessonCompleted = (courseId: string, lessonId: string) =>
            progressList.some(
              (p: any) => p.courseId === courseId && p.lessonId === lessonId && p.status === "completed"
            );

          const isCourseStarted = (courseId: string) =>
            progressList.some((p: any) => p.courseId === courseId);

          const computedSkills: SkillNode[] = [
            // Curso 1 Nodes: Engenharia de IA
            {
              id: "python",
              label: "Python Core",
              score: isLessonCompleted("course-1", "lesson-1-1") ? 92 : (isCourseStarted("course-1") ? 25 : 0),
              type: "Linguagem",
              level: isLessonCompleted("course-1", "lesson-1-1") ? "Avançado" : (isCourseStarted("course-1") ? "Básico" : "Bloqueado"),
              connections: ["fastapi", "rest"],
            },
            {
              id: "fastapi",
              label: "FastAPI Routing",
              score: isLessonCompleted("course-1", "lesson-1-1") ? 65 : (isCourseStarted("course-1") ? 15 : 0),
              type: "Framework",
              level: isLessonCompleted("course-1", "lesson-1-1") ? "Intermédio" : (isCourseStarted("course-1") ? "Básico" : "Bloqueado"),
              connections: ["rest"],
            },
            {
              id: "rest",
              label: "REST API Design",
              score: isLessonCompleted("course-1", "lesson-1-1") ? 84 : (isCourseStarted("course-1") ? 20 : 0),
              type: "Arquitetura",
              level: isLessonCompleted("course-1", "lesson-1-1") ? "Avançado" : (isCourseStarted("course-1") ? "Básico" : "Bloqueado"),
              connections: ["docker"],
            },
            {
              id: "docker",
              label: "Docker Containers",
              score: isLessonCompleted("course-1", "lesson-1-2") ? 71 : (isCourseStarted("course-1") ? 10 : 0),
              type: "Infraestrutura",
              level: isLessonCompleted("course-1", "lesson-1-2") ? "Intermédio" : (isCourseStarted("course-1") ? "Básico" : "Bloqueado"),
              connections: ["cloud"],
            },
            {
              id: "cloud",
              label: "AWS & GCP Cloud",
              score: isLessonCompleted("course-1", "lesson-1-2") ? 52 : (isCourseStarted("course-1") ? 5 : 0),
              type: "Infraestrutura",
              level: isLessonCompleted("course-1", "lesson-1-2") ? "Básico" : (isCourseStarted("course-1") ? "Iniciado" : "Bloqueado"),
              connections: ["agents"],
            },
            {
              id: "agents",
              label: "AI Agents System",
              score: isLessonCompleted("course-1", "lesson-1-3") ? 43 : (isCourseStarted("course-1") ? 5 : 0),
              type: "IA & Orquestração",
              level: isLessonCompleted("course-1", "lesson-1-3") ? "Básico" : (isCourseStarted("course-1") ? "Iniciado" : "Bloqueado"),
              connections: ["rag"],
            },
            {
              id: "rag",
              label: "RAG & Search Atlas",
              score: isLessonCompleted("course-1", "lesson-1-3") ? 58 : (isCourseStarted("course-1") ? 10 : 0),
              type: "IA & Orquestração",
              level: isLessonCompleted("course-1", "lesson-1-3") ? "Básico" : (isCourseStarted("course-1") ? "Iniciado" : "Bloqueado"),
              connections: [],
            },

            // Curso 2 Nodes: Next.js 16
            {
              id: "nextjs",
              label: "Next.js 16 RSC",
              score: isLessonCompleted("course-2", "lesson-1-1") ? 88 : (isCourseStarted("course-2") ? 30 : 0),
              type: "Framework",
              level: isLessonCompleted("course-2", "lesson-1-1") ? "Avançado" : (isCourseStarted("course-2") ? "Básico" : "Bloqueado"),
              connections: ["clerk_auth"],
            },
            {
              id: "clerk_auth",
              label: "Clerk & B2B SSO",
              score: isLessonCompleted("course-2", "lesson-1-2") ? 75 : (isCourseStarted("course-2") ? 15 : 0),
              type: "Identidade/Segurança",
              level: isLessonCompleted("course-2", "lesson-1-2") ? "Intermédio" : (isCourseStarted("course-2") ? "Iniciado" : "Bloqueado"),
              connections: ["sanity_cms"],
            },
            {
              id: "sanity_cms",
              label: "Sanity CMS & GROQ",
              score: isLessonCompleted("course-2", "lesson-1-3") ? 67 : (isCourseStarted("course-2") ? 10 : 0),
              type: "Arquitetura/Dados",
              level: isLessonCompleted("course-2", "lesson-1-3") ? "Intermédio" : (isCourseStarted("course-2") ? "Iniciado" : "Bloqueado"),
              connections: [],
            },

            // Curso 3 Nodes: Solidity
            {
              id: "solidity",
              label: "Solidity Core",
              score: isLessonCompleted("course-3", "lesson-1-1") ? 90 : (isCourseStarted("course-3") ? 20 : 0),
              type: "Linguagem Web3",
              level: isLessonCompleted("course-3", "lesson-1-1") ? "Avançado" : (isCourseStarted("course-3") ? "Básico" : "Bloqueado"),
              connections: ["erc_tokens"],
            },
            {
              id: "erc_tokens",
              label: "ERC-20 & ERC-721 Standards",
              score: isLessonCompleted("course-3", "lesson-1-2") ? 82 : (isCourseStarted("course-3") ? 10 : 0),
              type: "Blockchain Protocol",
              level: isLessonCompleted("course-3", "lesson-1-2") ? "Avançado" : (isCourseStarted("course-3") ? "Iniciado" : "Bloqueado"),
              connections: ["smart_security"],
            },
            {
              id: "smart_security",
              label: "Smart Contract Audit",
              score: isLessonCompleted("course-3", "lesson-1-3") ? 77 : (isCourseStarted("course-3") ? 5 : 0),
              type: "Segurança/Auditoria",
              level: isLessonCompleted("course-3", "lesson-1-3") ? "Intermédio" : (isCourseStarted("course-3") ? "Iniciado" : "Bloqueado"),
              connections: ["bitcoin"],
            },
            // Curso 4 Nodes: Criptomoedas e Blockchain
            {
              id: "bitcoin",
              label: "Bitcoin & Descentralização",
              score: isLessonCompleted("course-criptomoedas-n1", "introducao-as-criptomoedas-e-satoshi-nakamoto") || isLessonCompleted("course-4", "lesson-1-1") ? 95 : (isCourseStarted("course-4") || isCourseStarted("course-criptomoedas-n1") ? 20 : 0),
              type: "Protocolo",
              level: isLessonCompleted("course-criptomoedas-n1", "introducao-as-criptomoedas-e-satoshi-nakamoto") || isLessonCompleted("course-4", "lesson-1-1") ? "Avançado" : (isCourseStarted("course-4") || isCourseStarted("course-criptomoedas-n1") ? "Básico" : "Bloqueado"),
              connections: ["stablecoins"],
            },
            {
              id: "stablecoins",
              label: "Stablecoins & Altcoins",
              score: isLessonCompleted("course-criptomoedas-n1", "stablecoins-e-altcoins") || isLessonCompleted("course-4", "lesson-1-2") ? 88 : (isCourseStarted("course-4") || isCourseStarted("course-criptomoedas-n1") ? 15 : 0),
              type: "Ativos Digitais",
              level: isLessonCompleted("course-criptomoedas-n1", "stablecoins-e-altcoins") || isLessonCompleted("course-4", "lesson-1-2") ? "Avançado" : (isCourseStarted("course-4") || isCourseStarted("course-criptomoedas-n1") ? "Básico" : "Bloqueado"),
              connections: ["crypto_wallets"],
            },
            {
              id: "crypto_wallets",
              label: "Wallets & Segurança Segura",
              score: isLessonCompleted("course-criptomoedas-n1", "wallets-e-armazenamento-seguro") || isLessonCompleted("course-4", "lesson-1-3") ? 91 : (isCourseStarted("course-4") || isCourseStarted("course-criptomoedas-n1") ? 10 : 0),
              type: "Criptografia/Armazenamento",
              level: isLessonCompleted("course-criptomoedas-n1", "wallets-e-armazenamento-seguro") || isLessonCompleted("course-4", "lesson-1-3") ? "Avançado" : (isCourseStarted("course-4") || isCourseStarted("course-criptomoedas-n1") ? "Básico" : "Bloqueado"),
              connections: [],
            },
          ];

          setSkills(computedSkills);
          // Pré-selecionar o primeiro nó ativo ou o primeiro da lista
          setSelectedSkill(computedSkills[0]);
        }
      } catch (error) {
        console.error("Erro ao carregar competências:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadProgressAndSkills();
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
          A IA mede continuamente os seus conhecimentos, velocidade de resolução e retenção de conceitos ao longo de toda a plataforma.
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
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Zap className="h-4.5 w-4.5 text-yellow-400" />
              Estrutura de Fluência (Mapeamento Dinâmico)
            </h3>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
              {skills.map((node) => {
                const isSelected = selectedSkill?.id === node.id;
                const isLocked = node.level === "Bloqueado" || node.score === 0;

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
                        <h4 className={`font-bold text-sm ${isLocked ? "text-slate-500" : "text-white"}`}>
                          {node.label}
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
                      <span className="font-bold text-white">{selectedSkill.score > 0 ? "88%" : "0%"}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: selectedSkill.score > 0 ? "88%" : "0%" }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Velocidade de Execução</span>
                      <span className="font-bold text-white">{selectedSkill.score > 0 ? "72%" : "0%"}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 rounded-full transition-all duration-300" style={{ width: selectedSkill.score > 0 ? "72%" : "0%" }} />
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
