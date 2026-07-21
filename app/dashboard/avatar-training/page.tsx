"use client";

import React, { useState } from "react";
import { Users, Bot, Play, Video, Mic, MessageSquare, Award, CheckCircle2, RefreshCw } from "lucide-react";

interface Avatar {
  id: string;
  name: string;
  role: string;
  description: string;
  imageUrl: string;
  difficulty: "Fácil" | "Médio" | "Difícil";
  scenario: string;
}

const AVATARS: Avatar[] = [
  {
    id: "avatar-1",
    name: "Sophia Martinez",
    role: "Cliente corporativa insatisfeita",
    description: "Treine a gestão de reclamações e negociação de contratos em cenários de alta pressão.",
    imageUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200",
    difficulty: "Difícil",
    scenario: "Negociação de Renovação de Licenças SaaS",
  },
  {
    id: "avatar-2",
    name: "David Sterling",
    role: "Investidor de capital de risco",
    description: "Defenda o pitch do seu SaaS e justifique as suas escolhas de arquitetura técnica e rentabilidade.",
    imageUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=200",
    difficulty: "Médio",
    scenario: "Ronda de Investimento Seed (500k€)",
  },
  {
    id: "avatar-3",
    name: "Elena Rostova",
    role: "Diretora de Recursos Humanos (HR)",
    description: "Participe numa entrevista de emprego focada em soft skills, liderança técnica e cultura ágil.",
    imageUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=200",
    difficulty: "Fácil",
    scenario: "Vaga de Tech Lead / Solution Architect",
  },
];

export default function AvatarTrainingPage() {
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);
  const [trainingActive, setTrainingActive] = useState(false);
  const [messages, setMessages] = useState<{ sender: "user" | "avatar"; text: string }[]>([]);
  const [inputVal, setInputVal] = useState("");

  const handleStartTraining = (avatar: Avatar) => {
    setSelectedAvatar(avatar);
    setTrainingActive(true);
    setMessages([
      {
        sender: "avatar",
        text: `Olá! Eu sou o ${avatar.name} (${avatar.role}). Estou pronto para iniciar o cenário: "${avatar.scenario}". Como queres começar?`,
      },
    ]);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    const userText = inputVal;
    setMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setInputVal("");

    // Resposta simulada simples
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          sender: "avatar",
          text: `Entendo o teu ponto em relação a isso. No entanto, no meu papel de ${selectedAvatar?.role}, preciso de analisar com cuidado. Como respondes a este ponto?`,
        },
      ]);
    }, 1200);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <Bot className="h-7 w-7 text-indigo-400" />
          Treino com Avatares
        </h1>
        <p className="text-sm text-slate-400">
          Aperfeiçoe as suas técnicas de negociação, pitch de investimento e liderança técnica conversando em tempo real com avatares de IA.
        </p>
      </div>

      {!trainingActive ? (
        /* Selection screen */
        <div className="space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-900">
            <Users className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">Escolha um Avatar para Treinar</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {AVATARS.map((avatar) => (
              <div
                key={avatar.id}
                className="border border-slate-900 bg-slate-950/40 rounded-3xl overflow-hidden hover:border-slate-800 transition-all flex flex-col justify-between group shadow-xl"
              >
                {/* Photo and Difficulty */}
                <div className="h-44 bg-slate-900 relative flex items-center justify-center p-6 border-b border-slate-900/60 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent opacity-60 z-10" />
                  
                  {/* Mock image fallback using styling since we are in offline environment */}
                  <div className="w-24 h-24 rounded-full border-2 border-indigo-500/25 bg-slate-950 flex items-center justify-center relative z-20 text-slate-400 font-bold overflow-hidden shadow-lg">
                    <span className="text-2xl">{avatar.name[0]}</span>
                  </div>

                  <span className={`absolute top-4 right-4 text-[9px] font-bold px-2 py-0.5 rounded-full border z-20 ${
                    avatar.difficulty === "Difícil"
                      ? "bg-rose-500/10 border-rose-500/25 text-rose-450"
                      : avatar.difficulty === "Médio"
                      ? "bg-amber-500/10 border-amber-500/25 text-amber-400"
                      : "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                  }`}>
                    Dificuldade: {avatar.difficulty}
                  </span>
                </div>

                {/* Details */}
                <div className="p-6 space-y-4 flex-grow flex flex-col justify-between">
                  <div className="space-y-2">
                    <h3 className="font-bold text-base text-white group-hover:text-indigo-400 transition-colors">
                      {avatar.name}
                    </h3>
                    <span className="text-xs text-indigo-300 font-medium block">
                      {avatar.role}
                    </span>
                    <p className="text-slate-400 text-xs leading-relaxed line-clamp-3">
                      {avatar.description}
                    </p>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-900/60">
                    <div className="text-[10px] text-slate-500">
                      <strong>Cenário:</strong> {avatar.scenario}
                    </div>

                    <button
                      onClick={() => handleStartTraining(avatar)}
                      className="w-full inline-flex items-center justify-center h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white transition-all group-hover:bg-indigo-600 gap-1.5 cursor-pointer"
                    >
                      Iniciar Treino
                      <Play className="h-3.5 w-3.5 fill-white" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Training Chat Simulator Screen */
        <div className="grid lg:grid-cols-3 gap-8 items-stretch min-h-[500px]">
          {/* Avatar video feed card */}
          <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 flex flex-col justify-between items-center text-center space-y-6">
            <div className="space-y-2">
              <span className="text-xs text-indigo-400 font-semibold uppercase tracking-wider block">Sessão de Treino Ativa</span>
              <h3 className="text-lg font-bold text-white">{selectedAvatar?.name}</h3>
              <span className="text-xs text-slate-500">{selectedAvatar?.role}</span>
            </div>

            {/* Simulated camera preview */}
            <div className="w-44 h-44 rounded-full border-4 border-indigo-500/20 bg-slate-950 flex items-center justify-center relative overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-indigo-500/5 animate-pulse" />
              <Bot className="h-16 w-16 text-indigo-400 animate-bounce-slow" />
              {/* Mic/Video overlay status */}
              <div className="absolute bottom-2 flex gap-1.5">
                <span className="p-1 rounded-full bg-slate-900/90 text-emerald-450 border border-emerald-500/20">
                  <Mic className="h-3.5 w-3.5" />
                </span>
                <span className="p-1 rounded-full bg-slate-900/90 text-indigo-400 border border-indigo-500/20">
                  <Video className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>

            <div className="space-y-3 w-full">
              <div className="p-3 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 text-[10px] text-slate-400 text-left">
                <strong>Objetivo:</strong> Convencer o avatar a validar a sua proposta técnica ou financeira no cenário de <em>{selectedAvatar?.scenario}</em>.
              </div>
              <button
                onClick={() => setTrainingActive(false)}
                className="w-full h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-350 border border-slate-850 hover:border-slate-800 transition-colors"
              >
                Terminar Sessão
              </button>
            </div>
          </div>

          {/* Training chat interactive view */}
          <div className="lg:col-span-2 border border-slate-900 bg-slate-950/20 rounded-3xl p-6 flex flex-col justify-between h-[500px]">
            {/* Conversation log */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[75%] p-4 rounded-2xl text-xs leading-relaxed ${
                    m.sender === "user"
                      ? "bg-indigo-600 text-white rounded-br-none"
                      : "bg-[#070b13] border border-slate-900 text-slate-300 rounded-bl-none"
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Input message form */}
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                placeholder={`Fale com ${selectedAvatar?.name}...`}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                className="flex-1 h-11 px-4 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none transition-colors"
              />
              <button
                type="submit"
                className="px-5 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all shadow-lg shadow-indigo-600/10 cursor-pointer"
              >
                Enviar Resposta
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
