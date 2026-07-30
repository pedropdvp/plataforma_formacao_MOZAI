"use client";

import React, { useEffect, useState } from "react";
import { Trophy, Loader2, Plus, Users, Award, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { useAccess } from "@/hooks/use-access";

interface Hackathon {
  id: string;
  title: string;
  description: string;
  theme: string;
  startsAt: string;
  submissionDeadline: string;
  prizes: string;
  organizerName: string;
  organizerId: string;
  teamsCount: number;
}

interface Team {
  id: string;
  name: string;
  memberNames: string[];
  isMine: boolean;
  submission: { title: string; repoUrl: string; demoUrl: string; score: number | null; feedback: string | null } | null;
}

export default function HackathonsPage() {
  const { showToast } = useToast();
  const { activeRole } = useAccess();
  const isModerator = activeRole === "ADMIN" || activeRole === "SUPORTE";

  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [theme, setTheme] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [submissionDeadline, setSubmissionDeadline] = useState("");
  const [prizes, setPrizes] = useState("");
  const [creating, setCreating] = useState(false);

  const [selected, setSelected] = useState<Hackathon | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [submittingTeamId, setSubmittingTeamId] = useState<string | null>(null);
  const [subTitle, setSubTitle] = useState("");
  const [subDescription, setSubDescription] = useState("");
  const [subRepoUrl, setSubRepoUrl] = useState("");
  const [subDemoUrl, setSubDemoUrl] = useState("");
  const [scoringTeamId, setScoringTeamId] = useState<string | null>(null);
  const [scoreInput, setScoreInput] = useState("");
  const [feedbackInput, setFeedbackInput] = useState("");

  const loadHackathons = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/community/hackathons");
      const data = await res.json();
      if (res.ok) setHackathons(data.hackathons || []);
    } catch {
      showToast("Erro ao carregar os hackathons.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHackathons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !startsAt || !submissionDeadline) {
      showToast("Preencha os campos obrigatórios.", "error");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/community/hackathons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, theme, startsAt, submissionDeadline, prizes }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Hackathon criado!", "success");
        setTitle(""); setDescription(""); setTheme(""); setStartsAt(""); setSubmissionDeadline(""); setPrizes("");
        setShowForm(false);
        loadHackathons();
      } else {
        showToast(data.error || "Erro ao criar o hackathon.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao criar o hackathon.", "error");
    } finally {
      setCreating(false);
    }
  };

  const openHackathon = async (h: Hackathon) => {
    setSelected(h);
    setLoadingTeams(true);
    try {
      const res = await fetch(`/api/community/hackathons/${h.id}/teams`);
      const data = await res.json();
      if (res.ok) setTeams(data.teams || []);
    } catch {
      showToast("Erro ao carregar as equipas.", "error");
    } finally {
      setLoadingTeams(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!selected || !newTeamName.trim()) return;
    try {
      const res = await fetch(`/api/community/hackathons/${selected.id}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTeamName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Equipa criada!", "success");
        setNewTeamName("");
        openHackathon(selected);
      } else {
        showToast(data.error || "Erro ao criar a equipa.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao criar a equipa.", "error");
    }
  };

  const handleJoinTeam = async (team: Team) => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/community/hackathons/${selected.id}/teams/${team.id}/join`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast(`Entrou na equipa "${team.name}"!`, "success");
        openHackathon(selected);
      } else {
        showToast(data.error || "Erro ao entrar na equipa.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao entrar na equipa.", "error");
    }
  };

  const handleSubmitProject = async (team: Team) => {
    if (!selected || !subTitle.trim() || !subDescription.trim()) {
      showToast("Preencha o título e a descrição do projeto.", "error");
      return;
    }
    try {
      const res = await fetch(`/api/community/hackathons/${selected.id}/teams/${team.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: subTitle, description: subDescription, repoUrl: subRepoUrl, demoUrl: subDemoUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Projeto submetido!", "success");
        setSubmittingTeamId(null);
        setSubTitle(""); setSubDescription(""); setSubRepoUrl(""); setSubDemoUrl("");
        openHackathon(selected);
      } else {
        showToast(data.error || "Erro ao submeter o projeto.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao submeter o projeto.", "error");
    }
  };

  const handleScoreTeam = async (team: Team) => {
    if (!selected || !scoreInput.trim()) return;
    try {
      const res = await fetch(`/api/community/hackathons/${selected.id}/teams/${team.id}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: scoreInput, feedback: feedbackInput }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Pontuação registada.", "success");
        setScoringTeamId(null);
        setScoreInput(""); setFeedbackInput("");
        openHackathon(selected);
      } else {
        showToast(data.error || "Erro ao pontuar a equipa.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao pontuar a equipa.", "error");
    }
  };

  return (
    <div className="space-y-8 workspace-page-container">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-400" />
            Hackathons
          </h1>
          <p className="text-sm text-slate-400">Organize ou participe em hackathons: forme equipas, submeta projetos e veja a tabela de classificação.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer">
          <Plus className="h-4 w-4" /> Novo Hackathon
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
            <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Tema (ex: IA para Saúde)" className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
          </div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição e regras..." className="w-full h-20 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none" />
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500">Início</label>
              <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500">Prazo de Submissão</label>
              <input type="datetime-local" value={submissionDeadline} onChange={(e) => setSubmissionDeadline(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
            </div>
          </div>
          <input value={prizes} onChange={(e) => setPrizes(e.target.value)} placeholder="Prémios (opcional)" className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
          <button type="submit" disabled={creating} className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-55">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Hackathon"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 text-indigo-500 animate-spin" /></div>
      ) : hackathons.length === 0 ? (
        <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-12 text-center">
          <span className="text-sm text-slate-500 italic">Ainda não há hackathons agendados.</span>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {hackathons.map((h) => (
            <div key={h.id} className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-3 flex flex-col">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">{h.theme || "Geral"}</span>
              <h3 className="text-sm font-bold text-white">{h.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 flex-1">{h.description}</p>
              <span className="text-[11px] text-slate-500">Prazo: {new Date(h.submissionDeadline).toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" })}</span>
              <span className="text-[10px] text-slate-500 flex items-center gap-1"><Users className="h-3 w-3" /> {h.teamsCount} equipas</span>
              <button onClick={() => openHackathon(h)} className="h-8 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-[11px] font-semibold text-indigo-400 flex items-center justify-center gap-1.5 cursor-pointer">
                Ver Equipas & Classificação
              </button>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-2xl max-h-[85vh] bg-slate-950 border border-slate-800 rounded-3xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-900 flex items-center justify-between shrink-0">
              <h4 className="font-bold text-sm text-white">{selected.title}</h4>
              <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-slate-300 cursor-pointer text-xs">Fechar</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex gap-2">
                <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="Nome da nova equipa" className="flex-1 h-9 px-3 rounded-lg border border-slate-800 bg-slate-900 text-white text-xs focus:border-indigo-500 focus:outline-none" />
                <button onClick={handleCreateTeam} className="h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[11px] font-semibold text-white cursor-pointer">Criar Equipa</button>
              </div>
              {loadingTeams ? (
                <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
              ) : teams.length === 0 ? (
                <span className="text-xs text-slate-500">Ainda não há equipas.</span>
              ) : (
                teams.map((t, i) => (
                  <div key={t.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-900 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        {t.submission?.score !== null && t.submission?.score !== undefined && (
                          <span className="text-amber-400 flex items-center gap-1"><Award className="h-3.5 w-3.5" /> #{i + 1}</span>
                        )}
                        {t.name}
                      </span>
                      {t.submission?.score !== null && t.submission?.score !== undefined && (
                        <span className="text-xs font-bold text-emerald-400">{t.submission.score}/100</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500">{t.memberNames.join(", ")}</span>
                    {t.submission ? (
                      <div className="text-[11px] text-slate-300 space-y-1">
                        <span className="font-bold">{t.submission.title}</span>
                        {t.submission.repoUrl && (
                          <a href={t.submission.repoUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline flex items-center gap-1 w-fit">
                            Repositório <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {t.submission.feedback && <p className="text-slate-500 italic">"{t.submission.feedback}"</p>}
                        {isModerator && (
                          scoringTeamId === t.id ? (
                            <div className="flex gap-1.5 pt-1">
                              <input type="number" min={0} max={100} value={scoreInput} onChange={(e) => setScoreInput(e.target.value)} placeholder="0-100" className="w-16 h-7 px-2 rounded-lg border border-slate-800 bg-black text-white text-[10px]" />
                              <input value={feedbackInput} onChange={(e) => setFeedbackInput(e.target.value)} placeholder="Feedback (opcional)" className="flex-1 h-7 px-2 rounded-lg border border-slate-800 bg-black text-white text-[10px]" />
                              <button onClick={() => handleScoreTeam(t)} className="h-7 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[10px] font-semibold text-white cursor-pointer">OK</button>
                            </div>
                          ) : (
                            <button onClick={() => setScoringTeamId(t.id)} className="h-6 px-2 rounded-lg border border-slate-800 hover:bg-slate-900 text-[9px] font-semibold text-slate-400 cursor-pointer">
                              {t.submission.score !== null ? "Reavaliar" : "Avaliar"}
                            </button>
                          )
                        )}
                      </div>
                    ) : t.isMine ? (
                      submittingTeamId === t.id ? (
                        <div className="space-y-1.5 pt-1">
                          <input value={subTitle} onChange={(e) => setSubTitle(e.target.value)} placeholder="Título do projeto" className="w-full h-7 px-2 rounded-lg border border-slate-800 bg-black text-white text-[10px]" />
                          <textarea value={subDescription} onChange={(e) => setSubDescription(e.target.value)} placeholder="Descrição" className="w-full h-14 p-2 rounded-lg border border-slate-800 bg-black text-white text-[10px] resize-none" />
                          <input value={subRepoUrl} onChange={(e) => setSubRepoUrl(e.target.value)} placeholder="Link do repositório" className="w-full h-7 px-2 rounded-lg border border-slate-800 bg-black text-white text-[10px]" />
                          <button onClick={() => handleSubmitProject(t)} className="h-7 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[10px] font-semibold text-white cursor-pointer">Submeter</button>
                        </div>
                      ) : (
                        <button onClick={() => setSubmittingTeamId(t.id)} className="h-7 px-3 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-[10px] font-semibold text-indigo-400 cursor-pointer">
                          Submeter Projeto
                        </button>
                      )
                    ) : (
                      <button onClick={() => handleJoinTeam(t)} className="h-7 px-3 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-[10px] font-semibold text-indigo-400 cursor-pointer">
                        Entrar nesta equipa
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
