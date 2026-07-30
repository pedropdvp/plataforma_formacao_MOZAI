"use client";

import React, { useEffect, useState } from "react";
import { CalendarDays, Loader2, MapPin, Users, Plus, Trash2, Video } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { useAccess } from "@/hooks/use-access";

interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  startsAt: string;
  endsAt: string | null;
  location: string;
  isOnline: boolean;
  organizerName: string;
  organizerId: string;
  attendeesCount: number;
  attending: boolean;
}

export default function EventsPage() {
  const { showToast } = useToast();
  const { userId, activeRole } = useAccess();
  const isModerator = activeRole === "ADMIN" || activeRole === "SUPORTE";

  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [location, setLocation] = useState("");
  const [creating, setCreating] = useState(false);
  const [rsvpingId, setRsvpingId] = useState<string | null>(null);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/community/events");
      const data = await res.json();
      if (res.ok) setEvents(data.events || []);
    } catch {
      showToast("Erro ao carregar os eventos.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !startsAt) {
      showToast("Preencha o título, descrição e data.", "error");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/community/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category: category.trim(),
          startsAt,
          location: location.trim(),
          isOnline,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Evento criado com sucesso!", "success");
        setTitle("");
        setDescription("");
        setCategory("");
        setStartsAt("");
        setLocation("");
        setShowForm(false);
        loadEvents();
      } else {
        showToast(data.error || "Erro ao criar o evento.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao criar o evento.", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleRsvp = async (event: CommunityEvent) => {
    setRsvpingId(event.id);
    try {
      const res = await fetch(`/api/community/events/${event.id}/rsvp`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, attending: data.attending, attendeesCount: data.attendeesCount } : e)));
      }
    } catch {
      showToast("Erro ao inscrever-se no evento.", "error");
    } finally {
      setRsvpingId(null);
    }
  };

  const handleCancel = async (event: CommunityEvent) => {
    try {
      const res = await fetch(`/api/community/events/${event.id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Evento cancelado.", "success");
        setEvents((prev) => prev.filter((e) => e.id !== event.id));
      }
    } catch {
      showToast("Erro ao cancelar o evento.", "error");
    }
  };

  return (
    <div className="space-y-8 workspace-page-container">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-indigo-400" />
            Eventos
          </h1>
          <p className="text-sm text-slate-400">Webinars, workshops e encontros da comunidade — organize ou inscreva-se.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Novo Evento
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do evento" className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Categoria (ex: Webinar, Workshop)" className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
          </div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição do evento..." className="w-full h-20 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none" />
          <div className="grid sm:grid-cols-2 gap-3">
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
            <select value={isOnline ? "online" : "presencial"} onChange={(e) => setIsOnline(e.target.value === "online")} className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none">
              <option value="online">Online</option>
              <option value="presencial">Presencial</option>
            </select>
          </div>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={isOnline ? "Link da videochamada (opcional)" : "Morada (opcional)"} className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
          <button type="submit" disabled={creating} className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-55">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Evento"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 text-indigo-500 animate-spin" /></div>
      ) : events.length === 0 ? (
        <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-12 text-center">
          <span className="text-sm text-slate-500 italic">Ainda não há eventos agendados.</span>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((e) => (
            <div key={e.id} className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-3 flex flex-col">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">{e.category}</span>
              <h3 className="text-sm font-bold text-white">{e.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 flex-1">{e.description}</p>
              <span className="text-[11px] text-slate-500">{new Date(e.startsAt).toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" })}</span>
              {e.location && (
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  {e.isOnline ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />} {e.location}
                </span>
              )}
              <span className="text-[10px] text-slate-500 flex items-center gap-1"><Users className="h-3 w-3" /> {e.attendeesCount} inscritos · por {e.organizerName}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRsvp(e)}
                  disabled={rsvpingId === e.id}
                  className={`flex-1 h-8 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-55 ${
                    e.attending ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400" : "bg-indigo-600 hover:bg-indigo-500 text-white"
                  }`}
                >
                  {rsvpingId === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : e.attending ? "Inscrito" : "Inscrever-me"}
                </button>
                {(e.organizerId === userId || isModerator) && (
                  <button onClick={() => handleCancel(e)} className="h-8 w-8 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 flex items-center justify-center cursor-pointer shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
