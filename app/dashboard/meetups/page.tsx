"use client";

import React, { useEffect, useState } from "react";
import { Users2, Loader2, Plus, MapPin, Video, CalendarDays } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";

interface MeetupGroup {
  id: string;
  name: string;
  description: string;
  topic: string;
  organizerName: string;
  membersCount: number;
  isMember: boolean;
}

interface MeetupSession {
  id: string;
  title: string;
  startsAt: string;
  location: string;
  isOnline: boolean;
  attendeesCount: number;
  attending: boolean;
}

export default function MeetupsPage() {
  const { showToast } = useToast();
  const [groups, setGroups] = useState<MeetupGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [topic, setTopic] = useState("");
  const [creating, setCreating] = useState(false);

  const [selected, setSelected] = useState<MeetupGroup | null>(null);
  const [sessions, setSessions] = useState<MeetupSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [newSessionDate, setNewSessionDate] = useState("");

  const loadGroups = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/community/meetups");
      const data = await res.json();
      if (res.ok) setGroups(data.groups || []);
    } catch {
      showToast("Erro ao carregar os grupos.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/community/meetups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, topic }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Grupo criado!", "success");
        setName(""); setDescription(""); setTopic("");
        setShowForm(false);
        loadGroups();
      } else {
        showToast(data.error || "Erro ao criar o grupo.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao criar o grupo.", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleMembership = async (group: MeetupGroup) => {
    try {
      const res = await fetch(`/api/community/meetups/${group.id}/membership`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, isMember: data.isMember, membersCount: data.membersCount } : g)));
      } else {
        showToast(data.error || "Erro ao atualizar a participação.", "error");
      }
    } catch {
      showToast("Erro de comunicação.", "error");
    }
  };

  const openGroup = async (g: MeetupGroup) => {
    setSelected(g);
    setLoadingSessions(true);
    try {
      const res = await fetch(`/api/community/meetups/${g.id}/sessions`);
      const data = await res.json();
      if (res.ok) setSessions(data.sessions || []);
    } catch {
      showToast("Erro ao carregar as sessões.", "error");
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleCreateSession = async () => {
    if (!selected || !newSessionTitle.trim() || !newSessionDate) return;
    try {
      const res = await fetch(`/api/community/meetups/${selected.id}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newSessionTitle, startsAt: newSessionDate, isOnline: true }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Sessão agendada!", "success");
        setNewSessionTitle(""); setNewSessionDate("");
        openGroup(selected);
      } else {
        showToast(data.error || "Erro ao agendar a sessão.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao agendar a sessão.", "error");
    }
  };

  const handleRsvpSession = async (session: MeetupSession) => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/community/meetups/${selected.id}/sessions/${session.id}/rsvp`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSessions((prev) => prev.map((s) => (s.id === session.id ? { ...s, attending: data.attending, attendeesCount: data.attendeesCount } : s)));
      }
    } catch {
      showToast("Erro ao inscrever-se na sessão.", "error");
    }
  };

  return (
    <div className="space-y-8 workspace-page-container">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Users2 className="h-6 w-6 text-emerald-400" />
            Meetups
          </h1>
          <p className="text-sm text-slate-400">Grupos de interesse recorrentes — junte-se a um e participe nas próximas sessões.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer">
          <Plus className="h-4 w-4" /> Novo Grupo
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do grupo" className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Tópico (ex: Python, Design)" className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
          </div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição do grupo..." className="w-full h-20 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none" />
          <button type="submit" disabled={creating} className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-55">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Grupo"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 text-indigo-500 animate-spin" /></div>
      ) : groups.length === 0 ? (
        <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-12 text-center">
          <span className="text-sm text-slate-500 italic">Ainda não há grupos de Meetup.</span>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((g) => (
            <div key={g.id} className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-3 flex flex-col">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">{g.topic}</span>
              <h3 className="text-sm font-bold text-white">{g.name}</h3>
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 flex-1">{g.description}</p>
              <span className="text-[10px] text-slate-500">{g.membersCount} membros · por {g.organizerName}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleToggleMembership(g)}
                  className={`flex-1 h-8 rounded-lg text-[11px] font-semibold cursor-pointer ${g.isMember ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400" : "bg-indigo-600 hover:bg-indigo-500 text-white"}`}
                >
                  {g.isMember ? "Membro" : "Juntar-me"}
                </button>
                <button onClick={() => openGroup(g)} className="h-8 px-3 rounded-lg border border-slate-800 hover:bg-slate-900 text-[11px] font-semibold text-slate-300 cursor-pointer flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" /> Sessões
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-xl max-h-[85vh] bg-slate-950 border border-slate-800 rounded-3xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-900 flex items-center justify-between shrink-0">
              <h4 className="font-bold text-sm text-white">{selected.name} — Sessões</h4>
              <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-slate-300 cursor-pointer text-xs">Fechar</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selected.isMember && (
                <div className="flex gap-2">
                  <input value={newSessionTitle} onChange={(e) => setNewSessionTitle(e.target.value)} placeholder="Título da sessão" className="flex-1 h-9 px-3 rounded-lg border border-slate-800 bg-slate-900 text-white text-xs focus:border-indigo-500 focus:outline-none" />
                  <input type="datetime-local" value={newSessionDate} onChange={(e) => setNewSessionDate(e.target.value)} className="h-9 px-3 rounded-lg border border-slate-800 bg-slate-900 text-white text-xs focus:border-indigo-500 focus:outline-none" />
                  <button onClick={handleCreateSession} className="h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[11px] font-semibold text-white cursor-pointer shrink-0">Agendar</button>
                </div>
              )}
              {loadingSessions ? (
                <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
              ) : sessions.length === 0 ? (
                <span className="text-xs text-slate-500">Ainda não há sessões agendadas.</span>
              ) : (
                sessions.map((s) => (
                  <div key={s.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-900 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-white">{s.title}</span>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                        {new Date(s.startsAt).toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" })}
                        {s.isOnline ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                        <span>{s.attendeesCount} inscritos</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRsvpSession(s)}
                      className={`h-8 px-3 rounded-lg text-[11px] font-semibold cursor-pointer shrink-0 ${s.attending ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400" : "bg-indigo-600 hover:bg-indigo-500 text-white"}`}
                    >
                      {s.attending ? "Inscrito" : "Inscrever-me"}
                    </button>
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
