"use client";

import { useToast } from "@/components/ui/toast-provider";

import React from "react";
import { Users, Video, Play, Award, ShieldAlert, Cpu } from "lucide-react";

interface TrainingRoom {
  id: string;
  name: string;
  topic: string;
  participantsCount: number;
  maxParticipants: number;
}

const ACTIVE_ROOMS: TrainingRoom[] = [
  { id: "room-1", name: "Sala Alpha", topic: "Revisão de Prompt Engineering & System Prompts", participantsCount: 2, maxParticipants: 4 },
  { id: "room-2", name: "Sala Beta", topic: "Mock Interview - Solution Architect Next.js", participantsCount: 1, maxParticipants: 2 },
];

export default function TrainingRoomsPage() {
  const { showToast } = useToast();
  const handleJoinRoom = (roomName: string) => {
    alert(`A entrar na ${roomName}... A ligar câmara e microfone. O Agente de IA está pronto para gravar e analisar a sua performance.`);
  };

  const handleCreateRoom = () => {
    showToast("Criação de nova sala iniciada. Escolha o tema e configure a gravação de análise IA.", "info");
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
            <Users className="h-7 w-7 text-indigo-400" />
            Salas de Treino Coletivo
          </h1>
          <p className="text-sm text-slate-400">
            Treina com colegas em tempo real com gravação e análise IA automáticas.
          </p>
        </div>

        <button
          onClick={handleCreateRoom}
          className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all shadow-lg shadow-indigo-600/10 cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
        >
          Criar Nova Sala
        </button>
      </div>

      {/* Info Callout */}
      <div className="border border-indigo-500/15 bg-indigo-500/5 rounded-3xl p-5 flex items-start gap-4">
        <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl flex-shrink-0">
          <Cpu className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-bold text-white">Análise IA em Tempo Real</span>
          <p className="text-xs text-slate-400 leading-relaxed">
            As salas de treino gravam as interações de áudio e vídeo com o seu consentimento. Ao terminar a sessão, o nosso modelo de linguagem envia um relatório detalhado de feedback sobre dicção, clareza técnica e linguagem corporal para a sua caixa de correio.
          </p>
        </div>
      </div>

      {/* Active rooms list */}
      <div className="space-y-6">
        <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-900">
          Salas Ativas no Momento
        </h3>

        <div className="grid md:grid-cols-2 gap-8">
          {ACTIVE_ROOMS.map((room) => (
            <div
              key={room.id}
              className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 flex flex-col justify-between hover:border-slate-800 transition-colors shadow-xl group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-white group-hover:text-indigo-400 transition-colors">
                    {room.name}
                  </span>
                  <span className="text-[10px] text-indigo-300 font-semibold bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
                    {room.participantsCount} / {room.maxParticipants} Alunos
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  <strong>Tema:</strong> {room.topic}
                </p>
              </div>

              <div className="pt-6 border-t border-slate-900/60 mt-6 flex items-center justify-between">
                <span className="text-[10px] text-emerald-450 font-semibold flex items-center gap-1.5">
                  <Video className="h-3.5 w-3.5" />
                  Gravação IA Ativa
                </span>
                
                <button
                  onClick={() => handleJoinRoom(room.name)}
                  className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white transition-colors group-hover:bg-indigo-600 gap-1.5 cursor-pointer flex items-center"
                >
                  Entrar na Sala
                  <Play className="h-3.5 w-3.5 fill-white" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
