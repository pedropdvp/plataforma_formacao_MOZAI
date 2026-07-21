"use client";

import React, { useState, useEffect } from "react";
import { Trophy, Flame, Award, Clock, ArrowLeft, Loader2, Sparkles, Check } from "lucide-react";
import Link from "next/link";

interface Badge {
  badgeId: string;
  unlockedAt: string;
}

interface Profile {
  xp: number;
  level: number;
  streak: number;
  badges: Badge[];
}

interface LeaderboardItem {
  rank: number;
  name: string;
  xp: number;
  level: number;
  isCurrentUser: boolean;
}

export default function GamificationPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGamificationData = async () => {
    try {
      const res = await fetch("/api/gamification");
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setLeaderboard(data.leaderboard || []);
      }
    } catch (err) {
      console.error("Erro ao carregar dados de gamificação:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGamificationData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center text-slate-500 gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        <span className="text-sm font-semibold">A carregar painel de conquistas...</span>
      </div>
    );
  }

  const xp = profile?.xp || 0;
  const level = profile?.level || 1;
  const streak = profile?.streak || 0;
  const unlockedBadges = profile?.badges || [];

  // Próximo nível cálculo
  const currentLevelXpBase = (level - 1) * 100;
  const nextLevelXpBase = level * 100;
  const xpInCurrentLevel = xp - currentLevelXpBase;
  const xpNeededForNextLevel = 100;
  const progressPct = Math.min(Math.max((xpInCurrentLevel / xpNeededForNextLevel) * 100, 0), 100);

  const badgesList = [
    {
      id: "first-step",
      title: "Primeiro Passo",
      desc: "Concluiu a primeira lição na plataforma.",
      reward: "+15 XP",
    },
    {
      id: "quiz-master",
      title: "Mestre de Quizzes",
      desc: "Obteve nota máxima (100%) num teste rápido.",
      reward: "+30 XP",
    },
    {
      id: "streak-5",
      title: "Foco Inabalável",
      desc: "Manteve uma sequência de 5 dias seguidos de estudo.",
      reward: "+50 XP",
    },
    {
      id: "course-conqueror",
      title: "Desbravador de Cursos",
      desc: "Concluiu o primeiro curso com aproveitamento completo.",
      reward: "+100 XP",
    },
  ];

  const hasBadge = (badgeId: string) => unlockedBadges.some((b) => b.badgeId === badgeId);

  return (
    <div className="space-y-8 workspace-page-container">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-400" />
            Central de Gamificação
          </h1>
          <p className="text-sm text-slate-400">
            Acompanhe o seu nível, desbloqueie badges exclusivas e dispute o topo do ranking com os seus colegas.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex h-9 px-4 items-center justify-center rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white transition-colors gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Lado Esquerdo: Nível & Streak */}
        <div className="lg:col-span-1 space-y-6">
          {/* Card de Nível */}
          <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-6 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3">
              <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Nível Atual</span>
              <div className="text-5xl font-extrabold text-white">{level}</div>
              <span className="text-xs text-slate-500 font-medium">{xp} total de XP</span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                <span>Progresso para Nível {level + 1}</span>
                <span>{xpInCurrentLevel} / {xpNeededForNextLevel} XP</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
                <div
                  className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card de Streak */}
          <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Sequência de Estudo</span>
              <h3 className="text-lg font-bold text-white">
                {streak} {streak === 1 ? "Dia" : "Dias"} Seguidos
              </h3>
              <p className="text-[10px] text-slate-400 leading-tight">
                {streak > 0 ? "Foco total! Estude amanhã para manter a chama acesa." : "Comece a estudar hoje para iniciar uma sequência!"}
              </p>
            </div>
            <div className={`p-4 rounded-2xl flex items-center justify-center ${
              streak > 0 ? "bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse" : "bg-slate-900 text-slate-600"
            }`}>
              <Flame className="h-8 w-8 fill-current" />
            </div>
          </div>
        </div>

        {/* Lado Direito Superior: Badges */}
        <div className="lg:col-span-2 space-y-6">
          <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Award className="h-4.5 w-4.5 text-indigo-400" />
              Medalhas e Conquistas ({unlockedBadges.length} / {badgesList.length})
            </h3>

            <div className="grid sm:grid-cols-2 gap-4">
              {badgesList.map((badge) => {
                const unlocked = hasBadge(badge.id);
                return (
                  <div
                    key={badge.id}
                    className={`p-4 rounded-2xl border flex gap-4 transition-all ${
                      unlocked
                        ? "border-indigo-500 bg-indigo-500/5 text-white"
                        : "border-slate-900 bg-slate-950/40 opacity-50 text-slate-500"
                    }`}
                  >
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                      unlocked ? "bg-indigo-500/20 text-indigo-400" : "bg-slate-900 text-slate-600"
                    }`}>
                      {unlocked ? <Check className="h-5 w-5" /> : <Award className="h-5 w-5" />}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs truncate text-slate-200">{badge.title}</span>
                        <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-slate-900 text-slate-400">
                          {badge.reward}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        {badge.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabela de Liderança (Leaderboards por Turma) */}
          <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Trophy className="h-4.5 w-4.5 text-indigo-400" />
              Classificação da Turma (Top 10)
            </h3>

            <div className="border border-slate-900 bg-slate-950/30 rounded-2xl overflow-hidden">
              <table className="w-full text-xs text-left text-slate-400">
                <thead className="bg-slate-950 text-slate-500 font-bold">
                  <tr>
                    <th className="px-4 py-3 text-center w-12">Pos.</th>
                    <th className="px-4 py-3">Nome do Aluno</th>
                    <th className="px-4 py-3 text-center w-16">Nível</th>
                    <th className="px-4 py-3 text-right pr-6 w-24">Pontuação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {leaderboard.map((item) => (
                    <tr
                      key={item.rank}
                      className={`hover:bg-slate-900/10 transition-colors ${
                        item.isCurrentUser ? "bg-indigo-500/5 font-semibold text-white" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-center font-bold">
                        {item.rank === 1 ? (
                          <span className="text-amber-500 font-extrabold">1º</span>
                        ) : item.rank === 2 ? (
                          <span className="text-slate-350 font-extrabold">2º</span>
                        ) : item.rank === 3 ? (
                          <span className="text-amber-700 font-extrabold">3º</span>
                        ) : (
                          <span>{item.rank}º</span>
                        )}
                      </td>
                      <td className="px-4 py-3 truncate max-w-[200px]">{item.name}</td>
                      <td className="px-4 py-3 text-center">{item.level}</td>
                      <td className="px-4 py-3 text-right pr-6 font-bold text-slate-200">{item.xp} XP</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
