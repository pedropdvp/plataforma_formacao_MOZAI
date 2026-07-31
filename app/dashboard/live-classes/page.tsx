"use client";

import { useToast } from "@/components/ui/toast-provider";

import React, { useEffect, useState } from "react";
import { Video, Calendar, Clock, User, CheckCircle2, Radio, Plus, ExternalLink, Loader2 } from "lucide-react";
import SecureRender from "@/components/secure-render";

interface LiveSession {
  id: string;
  title: string;
  trainer: string;
  description: string;
  date: string;
  time: string;
  joinUrl: string;
  reservedByMe: boolean;
  myReservedAt: string | null;
}

const EMPTY_FORM = { title: "", trainer: "", description: "", date: "", time: "", joinUrl: "" };

export default function LiveClassesPage() {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [reservingId, setReservingId] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const loadSessions = () => {
    setLoading(true);
    fetch("/api/live-classes")
      .then((res) => res.json())
      .then((data) => setSessions(data.classes || []))
      .catch(() => showToast("Erro ao carregar as aulas ao vivo.", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReserve = async (session: LiveSession) => {
    setReservingId(session.id);
    try {
      const res = await fetch(`/api/live-classes/${session.id}/reserve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao reservar lugar.");
      setSessions((prev) => prev.map((s) => (s.id === session.id ? { ...s, reservedByMe: true, myReservedAt: data.reservedAt } : s)));
      showToast(`Lugar reservado na sessão do dia ${session.date}!`, "success");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setReservingId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.trainer.trim() || !form.date.trim() || !form.time.trim() || !form.joinUrl.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/live-classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao agendar a aula.");
      setForm(EMPTY_FORM);
      setShowCreateForm(false);
      showToast("Aula ao vivo agendada com sucesso.", "success");
      loadSessions();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
            <Video className="h-7 w-7 text-indigo-400" />
            Aulas ao Vivo
          </h1>
          <p className="text-sm text-slate-400">
            Sessões ao vivo agendadas com os formadores. Reserve o seu lugar e entre na sessão à hora marcada.
          </p>
        </div>

        <SecureRender requiredPermission="COURSES_CREATE">
          <button
            onClick={() => setShowCreateForm((v) => !v)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors cursor-pointer flex-shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Agendar Aula
          </button>
        </SecureRender>
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreate} className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400">Título</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400">Formador</label>
              <input type="text" value={form.trainer} onChange={(e) => setForm({ ...form, trainer: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400">Data (dd/mm/aaaa)</label>
              <input type="text" placeholder="18/08/2026" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400">Horário</label>
              <input type="text" placeholder="19:00 - 20:30" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[11px] font-semibold text-slate-400">Link da Sessão (onde o aluno entra na aula)</label>
              <input type="url" placeholder="https://meet.google.com/..." value={form.joinUrl} onChange={(e) => setForm({ ...form, joinUrl: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400">Descrição</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowCreateForm(false)} className="h-9 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer">Cancelar</button>
            <button type="submit" disabled={creating} className="h-9 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors disabled:opacity-50 cursor-pointer">
              {creating ? "A agendar..." : "Agendar Aula"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
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

              <div className="flex items-center justify-between pt-2 gap-3">
                <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  {session.date}
                </span>

                {session.reservedByMe ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={session.joinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-600/10"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Entrar na Aula
                    </a>
                  </div>
                ) : (
                  <button
                    onClick={() => handleReserve(session)}
                    disabled={reservingId === session.id}
                    className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/10 disabled:opacity-50"
                  >
                    {reservingId === session.id ? "A reservar..." : "Reservar Lugar"}
                  </button>
                )}
              </div>

              {session.reservedByMe && session.myReservedAt && (
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-3 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Reservada por si em {new Date(session.myReservedAt).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
