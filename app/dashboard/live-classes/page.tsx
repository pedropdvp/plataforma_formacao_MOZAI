"use client";

import { useToast } from "@/components/ui/toast-provider";

import React, { useState } from "react";
import { Video, Calendar, Clock, User, Bell, Radio } from "lucide-react";

interface LiveSession {
  id: string;
  title: string;
  trainer: string;
  date: string;
  time: string;
  description: string;
}

const INITIAL_LIVES: LiveSession[] = [
  {
    id: "live-1",
    title: "Workshop RAG Avançado & Multi-Agent Systems",
    trainer: "Dr. Valter Silva",
    date: "18/07/2026",
    time: "19:00 - 20:30",
    description: "Sessão prática tira-dúvidas de implementação e infraestrutura corporativa.",
  },
];

export default function LiveClassesPage() {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<LiveSession[]>(INITIAL_LIVES);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
            <Video className="h-7 w-7 text-indigo-400" />
            Aulas ao Vivo
          </h1>
          <p className="text-sm text-slate-400">
            Sessões ao vivo agendadas com os formadores.
          </p>
        </div>

        {/* Simulator Toggle */}
        <button
          onClick={() => setSessions((prev) => (prev.length > 0 ? [] : INITIAL_LIVES))}
          className="px-3 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-400 font-semibold transition-colors"
        >
          {sessions.length > 0 ? "Simular Sem Aulas" : "Simular Com Aulas"}
        </button>
      </div>

      {/* Sessions Container */}
      {sessions.length === 0 ? (
        <div className="border border-slate-900 border-dashed rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4 min-h-[350px]">
          <div className="p-4 rounded-full bg-slate-950 border border-slate-900 text-slate-700">
            <Radio className="h-10 w-10" />
          </div>
          <div className="space-y-1">
            <span className="block text-sm font-bold text-slate-350">Sem aulas agendadas.</span>
            <p className="text-xs text-slate-500 max-w-[280px] mx-auto leading-relaxed">
              Não há sessões ao vivo agendadas de momento.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-8">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="border border-indigo-500/10 bg-[#070b13] rounded-3xl p-6 space-y-6 hover:border-indigo-500/25 transition-all shadow-xl relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 h-24 w-24 bg-indigo-500/5 rounded-full blur-2xl" />

              <div className="space-y-3">
                <span className="inline-flex items-center gap-1.5 text-[9px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping" />
                  Agendada
                </span>
                <h3 className="text-base font-extrabold text-white leading-snug group-hover:text-indigo-400 transition-colors">
                  {session.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {session.description}
                </p>
              </div>

              {/* Session Meta */}
              <div className="grid grid-cols-2 gap-4 py-4 border-t border-b border-slate-900/60 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 block">Formador</span>
                  <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                    <User className="h-4 w-4 text-slate-400" />
                    {session.trainer}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 block">Horário</span>
                  <span className="text-slate-300 flex items-center gap-1.5 font-medium font-mono">
                    <Clock className="h-4 w-4 text-slate-400" />
                    {session.time}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  {session.date}
                </span>

                <button
                  onClick={() => showToast(`Inscrição confirmada na sessão do dia ${session.date}!`, "success")}
                  className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/10"
                >
                  <Bell className="h-3.5 w-3.5" />
                  Reservar Lugar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
