"use client";

import React, { useState } from "react";
import { Route, CheckCircle2, XCircle, ArrowRight, RotateCcw } from "lucide-react";

interface SimulationChoice {
  id: string;
  text: string;
  feedback: string;
  isBest: boolean;
}

interface SimulationStep {
  id: string;
  scenario: string;
  choices: SimulationChoice[];
}

interface SimulationLabBlockViewProps {
  title: string;
  steps: SimulationStep[];
  exerciseId?: string;
  courseId?: string;
  lessonKey?: string;
}

/**
 * Simulação Guiada — cenário com escolhas e feedback imediato, sem execução de código.
 * Cobre casos de uso que o Coding Lab/Terminal Lab não cobrem: decisões de negócio,
 * segurança, atendimento, etc. A conclusão é registada em /api/simulation-lab/complete,
 * atribuindo XP na primeira vez, tal como os outros laboratórios.
 */
export function SimulationLabBlockView({ title, steps, exerciseId, courseId, lessonKey }: SimulationLabBlockViewProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [bestChoices, setBestChoices] = useState(0);
  const [finished, setFinished] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);
  const [badgeUnlocked, setBadgeUnlocked] = useState(false);

  const step = steps[stepIndex];
  const selectedChoice = step?.choices.find((c) => c.id === selectedChoiceId) || null;
  const isLastStep = stepIndex === steps.length - 1;

  const handleSelectChoice = (choice: SimulationChoice) => {
    if (selectedChoiceId) return; // já escolheu neste passo
    setSelectedChoiceId(choice.id);
    if (choice.isBest) setBestChoices((prev) => prev + 1);
  };

  const handleContinue = async () => {
    if (!isLastStep) {
      setStepIndex((i) => i + 1);
      setSelectedChoiceId(null);
      return;
    }

    setFinished(true);
    if (!exerciseId) return;

    try {
      const finalBestChoices = bestChoices; // já inclui a escolha do último passo (setState síncrono no clique)
      const res = await fetch("/api/simulation-lab/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseId, courseId, lessonKey, totalSteps: steps.length, bestChoices: finalBestChoices }),
      });
      const data = await res.json();
      if (res.ok) {
        setXpAwarded(data.xpAwarded || 0);
        setBadgeUnlocked(!!data.badgeUnlocked);
      }
    } catch {
      // silencioso — a simulação já foi concluída para o aluno, a gamificação é um extra
    }
  };

  const handleRestart = () => {
    setStepIndex(0);
    setSelectedChoiceId(null);
    setBestChoices(0);
    setFinished(false);
    setXpAwarded(0);
    setBadgeUnlocked(false);
  };

  if (!step) return null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden no-3d-effect">
      <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Route className="h-3.5 w-3.5" /> {title}
        </span>
        <span className="text-[10px] text-slate-600 font-mono">
          Cenário {Math.min(stepIndex + 1, steps.length)} / {steps.length}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {!finished ? (
          <>
            <p className="text-sm text-slate-200 leading-relaxed">{step.scenario}</p>

            <div className="space-y-2">
              {step.choices.map((choice) => {
                const isSelected = selectedChoiceId === choice.id;
                const showFeedback = !!selectedChoiceId;
                return (
                  <button
                    key={choice.id}
                    onClick={() => handleSelectChoice(choice)}
                    disabled={!!selectedChoiceId}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-colors ${
                      isSelected
                        ? choice.isBest
                          ? "border-emerald-500/40 bg-emerald-500/5"
                          : "border-amber-500/40 bg-amber-500/5"
                        : showFeedback
                        ? "border-slate-900 bg-slate-950/40 opacity-50"
                        : "border-slate-800 bg-slate-900/30 hover:border-indigo-500/40 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-slate-200">
                      {isSelected && (choice.isBest ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />)}
                      {choice.text}
                    </div>
                    {isSelected && <p className="mt-1.5 text-slate-400 leading-relaxed">{choice.feedback}</p>}
                  </button>
                );
              })}
            </div>

            {selectedChoice && (
              <button
                onClick={handleContinue}
                className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all flex items-center gap-2 cursor-pointer"
              >
                {isLastStep ? "Concluir Simulação" : "Continuar"}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        ) : (
          <div className="text-center space-y-3 py-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
            <div>
              <h4 className="font-bold text-white text-sm">Simulação Concluída</h4>
              <p className="text-xs text-slate-400 mt-1">
                Escolheu a melhor opção em {bestChoices} de {steps.length} cenários.
              </p>
            </div>
            {!!xpAwarded && (
              <div className="text-xs font-bold text-amber-400">
                +{xpAwarded} XP{badgeUnlocked ? " · Distintivo \"Estratega de Cenários\" desbloqueado!" : ""}
              </div>
            )}
            <button
              onClick={handleRestart}
              className="h-8 px-3.5 rounded-xl border border-slate-800 hover:bg-slate-900 text-[11px] font-semibold text-slate-400 transition-colors flex items-center gap-1.5 cursor-pointer mx-auto"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Repetir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
