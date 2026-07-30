"use client";

import React, { useEffect, useState } from "react";
import { UserSquare2, Loader2, Plus, Lock, Unlock, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";

interface Team {
  id: string;
  name: string;
  description: string;
  goal: string;
  leaderName: string;
  openMembership: boolean;
  membersCount: number;
  isMember: boolean;
  isLeader: boolean;
  pendingRequestsCount: number;
  myRequestPending: boolean;
}
interface JoinRequest {
  id: string;
  userName: string;
  requestedAt: string;
}

export default function TeamsPage() {
  const { showToast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [openMembership, setOpenMembership] = useState(true);
  const [creating, setCreating] = useState(false);

  const [managingTeam, setManagingTeam] = useState<Team | null>(null);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const loadTeams = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/community/teams");
      const data = await res.json();
      if (res.ok) setTeams(data.teams || []);
    } catch {
      showToast("Erro ao carregar as equipas.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/community/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, goal, openMembership }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Equipa criada!", "success");
        setName(""); setDescription(""); setGoal("");
        setShowForm(false);
        loadTeams();
      } else {
        showToast(data.error || "Erro ao criar a equipa.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao criar a equipa.", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (team: Team) => {
    try {
      const res = await fetch(`/api/community/teams/${team.id}/join`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast(data.joined ? "Entrou na equipa!" : "Pedido de entrada enviado — aguarde aprovação.", "success");
        loadTeams();
      } else {
        showToast(data.error || "Erro ao pedir entrada.", "error");
      }
    } catch {
      showToast("Erro de comunicação.", "error");
    }
  };

  const openManage = async (team: Team) => {
    setManagingTeam(team);
    setLoadingRequests(true);
    try {
      const res = await fetch(`/api/community/teams/${team.id}/requests`);
      const data = await res.json();
      if (res.ok) setRequests(data.requests || []);
    } catch {
      showToast("Erro ao carregar os pedidos.", "error");
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleRespond = async (reqId: string, action: "approve" | "reject") => {
    if (!managingTeam) return;
    try {
      const res = await fetch(`/api/community/teams/${managingTeam.id}/requests/${reqId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        openManage(managingTeam);
        loadTeams();
      }
    } catch {
      showToast("Erro ao responder ao pedido.", "error");
    }
  };

  return (
    <div className="space-y-8 workspace-page-container">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <UserSquare2 className="h-6 w-6 text-indigo-400" />
            Equipas
          </h1>
          <p className="text-sm text-slate-400">Equipas de trabalho persistentes com um objetivo comum — abertas ou por aprovação do líder.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer">
          <Plus className="h-4 w-4" /> Nova Equipa
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da equipa" className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição..." className="w-full h-16 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none" />
          <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Objetivo (opcional)" className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={openMembership} onChange={(e) => setOpenMembership(e.target.checked)} className="h-4 w-4 accent-indigo-500" />
            <span className="text-xs text-slate-300">Entrada aberta (sem checkbox = pedidos precisam da sua aprovação)</span>
          </label>
          <button type="submit" disabled={creating} className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-55">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Equipa"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 text-indigo-500 animate-spin" /></div>
      ) : teams.length === 0 ? (
        <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-12 text-center">
          <span className="text-sm text-slate-500 italic">Ainda não há equipas.</span>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((t) => (
            <div key={t.id} className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-3 flex flex-col">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                {t.openMembership ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />} {t.openMembership ? "Aberta" : "Por aprovação"}
              </span>
              <h3 className="text-sm font-bold text-white">{t.name}</h3>
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 flex-1">{t.description}</p>
              {t.goal && <span className="text-[10px] text-slate-500">Objetivo: {t.goal}</span>}
              <span className="text-[10px] text-slate-500">{t.membersCount} membros · líder {t.leaderName}</span>
              <div className="flex gap-2">
                {t.isMember ? (
                  <span className="flex-1 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold flex items-center justify-center">Membro</span>
                ) : t.myRequestPending ? (
                  <span className="flex-1 h-8 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[11px] font-semibold flex items-center justify-center">Pedido pendente</span>
                ) : (
                  <button onClick={() => handleJoin(t)} className="flex-1 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold cursor-pointer">
                    {t.openMembership ? "Entrar" : "Pedir Entrada"}
                  </button>
                )}
                {t.isLeader && t.pendingRequestsCount > 0 && (
                  <button onClick={() => openManage(t)} className="h-8 px-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[11px] font-semibold cursor-pointer">
                    {t.pendingRequestsCount} pedidos
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {managingTeam && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setManagingTeam(null)}>
          <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-900 flex items-center justify-between">
              <h4 className="font-bold text-sm text-white">Pedidos de Entrada — {managingTeam.name}</h4>
              <button onClick={() => setManagingTeam(null)} className="text-slate-500 hover:text-slate-300 cursor-pointer text-xs">Fechar</button>
            </div>
            <div className="p-4 space-y-2">
              {loadingRequests ? (
                <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
              ) : requests.length === 0 ? (
                <span className="text-xs text-slate-500">Sem pedidos pendentes.</span>
              ) : (
                requests.map((r) => (
                  <div key={r.id} className="p-2.5 rounded-lg bg-slate-900/40 flex items-center justify-between">
                    <span className="text-xs text-white">{r.userName}</span>
                    <div className="flex gap-1.5">
                      <button onClick={() => handleRespond(r.id, "reject")} className="h-7 w-7 rounded-lg border border-slate-800 hover:bg-slate-900 text-slate-400 flex items-center justify-center cursor-pointer"><XCircle className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleRespond(r.id, "approve")} className="h-7 w-7 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center cursor-pointer"><CheckCircle2 className="h-3.5 w-3.5" /></button>
                    </div>
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
