"use client";

import React, { useEffect, useState } from "react";
import { UserCircle2, Loader2, Flame, Trophy, Clock, Brain, Target, Plus, Eye, Pencil, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface Derived {
  streak: number;
  level: number;
  xp: number;
  peakActivityHour: number | null;
  confusionRatePct: number | null;
  topSkill: { label: string; score: number } | null;
  totalActivityLogs: number;
}

type EntryType = "objetivo" | "motivacao" | "habito";

interface Entry {
  id: string;
  type: EntryType;
  content: string;
  createdAt: string;
  updatedAt: string;
}

const TYPE_LABELS: Record<EntryType, string> = {
  objetivo: "Objetivo",
  motivacao: "Motivação",
  habito: "Hábito",
};

export default function DigitalTwinPage() {
  const { showToast } = useToast();
  const confirmDialog = useConfirm();
  const [derived, setDerived] = useState<Derived | null>(null);
  const [loading, setLoading] = useState(true);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [newType, setNewType] = useState<EntryType>("objetivo");
  const [newContent, setNewContent] = useState("");
  const [creating, setCreating] = useState(false);

  const [viewingEntry, setViewingEntry] = useState<Entry | null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const loadDerived = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/digital-twin");
      const data = await res.json();
      if (res.ok) setDerived(data.derived);
    } catch {
      showToast("Erro ao carregar o Digital Twin.", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadEntries = async () => {
    setLoadingEntries(true);
    try {
      const res = await fetch("/api/digital-twin/entries");
      const data = await res.json();
      if (res.ok) setEntries(data.entries || []);
    } catch {
      showToast("Erro ao carregar os registos.", "error");
    } finally {
      setLoadingEntries(false);
    }
  };

  useEffect(() => {
    loadDerived();
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) {
      showToast("Escreva o conteúdo do registo.", "error");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/digital-twin/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: newType, content: newContent.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Registo guardado.", "success");
        setNewContent("");
        loadEntries();
      } else {
        showToast(data.error || "Erro ao guardar o registo.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao guardar o registo.", "error");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (entry: Entry) => {
    setEditingEntry(entry);
    setEditContent(entry.content);
  };

  const handleSaveEdit = async () => {
    if (!editingEntry || !editContent.trim()) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/digital-twin/entries/${editingEntry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Registo atualizado.", "success");
        setEditingEntry(null);
        loadEntries();
      } else {
        showToast(data.error || "Erro ao editar o registo.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao editar o registo.", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (entry: Entry) => {
    const confirmed = await confirmDialog({
      title: "Apagar registo",
      message: `Tem a certeza de que deseja apagar este registo (${TYPE_LABELS[entry.type]})?`,
      confirmLabel: "Apagar",
      cancelLabel: "Cancelar",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/digital-twin/entries/${entry.id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Registo apagado.", "success");
        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      } else {
        showToast("Erro ao apagar o registo.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao apagar o registo.", "error");
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
        </>
      )}

      <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
        <h3 className="font-bold text-sm text-white flex items-center gap-2"><Target className="h-4.5 w-4.5 text-indigo-400" /> Objetivos & Motivação</h3>

        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-2">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as EntryType)}
            className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none sm:w-40 shrink-0"
          >
            <option value="objetivo">Objetivo</option>
            <option value="motivacao">Motivação</option>
            <option value="habito">Hábito</option>
          </select>
          <input
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Escreva o novo registo..."
            className="flex-1 h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
          />
          <button type="submit" disabled={creating} className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55 shrink-0">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Guardar
          </button>
        </form>

        <div className="space-y-2 pt-2 border-t border-slate-900">
          {loadingEntries ? (
            <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 text-indigo-500 animate-spin" /></div>
          ) : entries.length === 0 ? (
            <span className="text-xs text-slate-500">Ainda não tem registos guardados.</span>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-900">
                <div className="min-w-0">
                  <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">{TYPE_LABELS[entry.type]}</span>
                  <p className="text-xs text-slate-200 truncate">{entry.content}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => setViewingEntry(entry)} title="Visualizar" className="h-7 w-7 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer">
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => openEdit(entry)} title="Editar" className="h-7 w-7 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(entry)} title="Apagar" className="h-7 w-7 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 flex items-center justify-center cursor-pointer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal de Visualização */}
      {viewingEntry && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setViewingEntry(null)}>
          <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-900 flex items-center justify-between">
              <h4 className="font-bold text-sm text-white">{TYPE_LABELS[viewingEntry.type]}</h4>
              <button onClick={() => setViewingEntry(null)} className="text-slate-500 hover:text-slate-300 cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 space-y-2">
              <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{viewingEntry.content}</p>
              <span className="text-[10px] text-slate-500 block">Criado em {new Date(viewingEntry.createdAt).toLocaleString("pt-PT")}</span>
              {viewingEntry.updatedAt !== viewingEntry.createdAt && (
                <span className="text-[10px] text-slate-500 block">Editado em {new Date(viewingEntry.updatedAt).toLocaleString("pt-PT")}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setEditingEntry(null)}>
          <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-900 flex items-center justify-between">
              <h4 className="font-bold text-sm text-white">Editar {TYPE_LABELS[editingEntry.type]}</h4>
              <button onClick={() => setEditingEntry(null)} className="text-slate-500 hover:text-slate-300 cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full h-24 p-3 rounded-xl border border-slate-800 bg-slate-900 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none"
              />
              <button onClick={handleSaveEdit} disabled={savingEdit} className="w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55">
                {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar Alterações"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
