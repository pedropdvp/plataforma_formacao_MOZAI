"use client";

import React, { useEffect, useState } from "react";
import { UserCircle2, Loader2, Flame, Trophy, Clock, Brain, Target, Save } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";

interface Derived {
  streak: number;
  level: number;
  xp: number;
  peakActivityHour: number | null;
  confusionRatePct: number | null;
  topSkill: { label: string; score: number } | null;
  totalActivityLogs: number;
}

export default function DigitalTwinPage() {
  const { showToast } = useToast();
  const [derived, setDerived] = useState<Derived | null>(null);
  const [loading, setLoading] = useState(true);
  const [goalsInput, setGoalsInput] = useState("");
  const [motivation, setMotivation] = useState("");
  const [habitsNote, setHabitsNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/digital-twin");
      const data = await res.json();
      if (res.ok) {
        setDerived(data.derived);
        setGoalsInput((data.profile.goals || []).join("\n"));
        setMotivation(data.profile.motivation || "");
        setHabitsNote(data.profile.habitsNote || "");
      }
    } catch {
      showToast("Erro ao carregar o Digital Twin.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/digital-twin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goals: goalsInput.split("\n").filter(Boolean), motivation, habitsNote }),
      });
      if (res.ok) showToast("Digital Twin atualizado.", "success");
      else showToast("Erro ao guardar.", "error");
    } catch {
      showToast("Erro de comunicação.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 workspace-page-container">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <UserCircle2 className="h-6 w-6 text-indigo-400" />
          Digital Twin
        </h1>
        <p className="text-sm text-slate-400">O seu perfil real: traços derivados da sua atividade genuína na plataforma + objetivos que você define.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 text-indigo-500 animate-spin" /></div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="border border-slate-900 bg-slate-950/40 rounded-2xl p-4 space-y-1">
              <Flame className="h-5 w-5 text-orange-400" />
              <span className="text-lg font-bold text-white block">{derived?.streak || 0} dias</span>
              <span className="text-[10px] text-slate-500">Sequência de atividade real</span>
            </div>
            <div className="border border-slate-900 bg-slate-950/40 rounded-2xl p-4 space-y-1">
              <Trophy className="h-5 w-5 text-amber-400" />
              <span className="text-lg font-bold text-white block">Nível {derived?.level || 1}</span>
              <span className="text-[10px] text-slate-500">{derived?.xp || 0} XP acumulado</span>
            </div>
            <div className="border border-slate-900 bg-slate-950/40 rounded-2xl p-4 space-y-1">
              <Clock className="h-5 w-5 text-indigo-400" />
              <span className="text-lg font-bold text-white block">{derived?.peakActivityHour !== null ? `${derived?.peakActivityHour}h` : "—"}</span>
              <span className="text-[10px] text-slate-500">Hábito: hora de pico real</span>
            </div>
            <div className="border border-slate-900 bg-slate-950/40 rounded-2xl p-4 space-y-1">
              <Brain className="h-5 w-5 text-rose-400" />
              <span className="text-lg font-bold text-white block">{derived?.confusionRatePct !== null ? `${derived?.confusionRatePct}%` : "—"}</span>
              <span className="text-[10px] text-slate-500">Taxa de confusão (Tutor de IA)</span>
            </div>
          </div>

          {derived?.topSkill && (
            <div className="border border-slate-900 bg-slate-950/40 rounded-2xl p-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Competência mais forte (real)</span>
              <div className="text-sm font-bold text-white mt-1">{derived.topSkill.label} — {derived.topSkill.score}%</div>
            </div>
          )}

          <form onSubmit={handleSave} className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2"><Target className="h-4.5 w-4.5 text-indigo-400" /> Objetivos & Motivação</h3>
            <textarea value={goalsInput} onChange={(e) => setGoalsInput(e.target.value)} placeholder="Um objetivo por linha..." className="w-full h-20 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none" />
            <textarea value={motivation} onChange={(e) => setMotivation(e.target.value)} placeholder="O que te motiva a aprender?" className="w-full h-16 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none" />
            <textarea value={habitsNote} onChange={(e) => setHabitsNote(e.target.value)} placeholder="Notas sobre os seus hábitos de estudo..." className="w-full h-16 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none" />
            <button type="submit" disabled={saving} className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-55">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
            </button>
          </form>
        </>
      )}
    </div>
  );
}
