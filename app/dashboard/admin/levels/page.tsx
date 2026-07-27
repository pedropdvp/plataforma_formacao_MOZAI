"use client";

import React, { useState, useEffect } from "react";
import { Layers, Loader2, ShieldAlert, Save, Trash2, Plus } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useAccess } from "@/hooks/use-access";

interface LevelDoc {
  id: string;
  name: string;
  threshold: number;
}

export default function LevelsPage() {
  const { showToast } = useToast();
  const confirmDialog = useConfirm();
  const { activeRole, isLoading: loadingRole } = useAccess();
  const isAdmin = activeRole === "ADMIN" || activeRole === "SUPORTE";

  const [levels, setLevels] = useState<LevelDoc[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { name: string; threshold: string }>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newThreshold, setNewThreshold] = useState("");

  const fetchLevels = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/levels");
      if (res.ok) {
        const data = await res.json();
        const list: LevelDoc[] = data.levels || [];
        setLevels(list);
        setDrafts(Object.fromEntries(list.map((l) => [l.id, { name: l.name, threshold: String(l.threshold) }])));
      }
    } catch (err) {
      console.error("Erro ao ler os níveis:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchLevels();
  }, [isAdmin]);

  const isDirty = (l: LevelDoc) => {
    const d = drafts[l.id];
    return !!d && (d.name !== l.name || d.threshold !== String(l.threshold));
  };

  const handleSave = async (l: LevelDoc) => {
    const draft = drafts[l.id];
    const threshold = Number(draft.threshold);
    if (!draft.name.trim()) {
      showToast("O nome do nível é obrigatório.", "error");
      return;
    }
    if (!Number.isFinite(threshold) || threshold < 0) {
      showToast("O limiar de pontos tem de ser um número válido (≥ 0).", "error");
      return;
    }

    setSavingId(l.id);
    try {
      const res = await fetch(`/api/admin/levels/${l.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name.trim(), threshold }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Nível atualizado.", "success");
        setLevels(data.levels || []);
        setDrafts(Object.fromEntries((data.levels || []).map((x: LevelDoc) => [x.id, { name: x.name, threshold: String(x.threshold) }])));
      } else {
        showToast(data.error || "Erro ao guardar o nível.", "error");
      }
    } catch (err) {
      showToast("Erro de comunicação ao guardar o nível.", "error");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (l: LevelDoc) => {
    const confirmed = await confirmDialog({
      title: "Apagar Nível",
      message: `Isto vai eliminar o nível "${l.name}". Os alunos que estejam neste nível passam automaticamente para o nível anterior mais próximo. Tem a certeza?`,
      confirmLabel: "Apagar",
      destructive: true,
    });
    if (!confirmed) return;

    setDeletingId(l.id);
    try {
      const res = await fetch(`/api/admin/levels/${l.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        showToast(`Nível "${l.name}" eliminado.`, "success");
        setLevels(data.levels || []);
        setDrafts(Object.fromEntries((data.levels || []).map((x: LevelDoc) => [x.id, { name: x.name, threshold: String(x.threshold) }])));
      } else {
        showToast(data.error || "Erro ao apagar o nível.", "error");
      }
    } catch (err) {
      showToast("Erro de comunicação ao apagar o nível.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreate = async () => {
    const threshold = Number(newThreshold);
    if (!newName.trim()) {
      showToast("O nome do nível é obrigatório.", "error");
      return;
    }
    if (!Number.isFinite(threshold) || threshold < 0) {
      showToast("O limiar de pontos tem de ser um número válido (≥ 0).", "error");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), threshold }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Nível "${newName.trim()}" criado.`, "success");
        setNewName("");
        setNewThreshold("");
        setLevels(data.levels || []);
        setDrafts(Object.fromEntries((data.levels || []).map((x: LevelDoc) => [x.id, { name: x.name, threshold: String(x.threshold) }])));
      } else {
        showToast(data.error || "Erro ao criar o nível.", "error");
      }
    } catch (err) {
      showToast("Erro de comunicação ao criar o nível.", "error");
    } finally {
      setCreating(false);
    }
  };

  if (loadingRole) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        <span className="text-sm font-semibold">A verificar permissões...</span>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center text-center space-y-4 px-6">
        <div className="p-4 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-white">Acesso Restrito</h1>
        <p className="text-sm text-slate-400 max-w-[420px]">
          Só administradores globais (ADMIN ou SUPORTE) podem gerir os níveis dos alunos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl report-page-container">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2.5">
          <Layers className="h-6 w-6 text-orange-400" />
          Níveis
        </h1>
        <p className="text-sm text-slate-400">
          Defina os nomes e os limiares de pontos (MZ) que determinam o nível de cada aluno na plataforma — ex:
          "Aprendiz" a partir de 0 MZ, "Estudante" a partir de 500 MZ. Aplica-se a toda a plataforma.
        </p>
      </div>

      <div className="border border-slate-900 bg-slate-950/40 rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-200">Escala de Níveis</h2>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-500 gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
            <span className="text-xs font-semibold">A carregar níveis...</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {levels.map((l, idx) => {
              const draft = drafts[l.id] || { name: l.name, threshold: String(l.threshold) };
              const dirty = isDirty(l);
              return (
                <div
                  key={l.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-2.5 border border-slate-900 bg-slate-950/30 rounded-2xl p-3.5"
                >
                  <span className="text-xs font-extrabold text-indigo-400 w-16 shrink-0">Nível {idx + 1}</span>
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [l.id]: { ...draft, name: e.target.value } }))}
                    placeholder="Nome do nível"
                    className="flex-1 h-9 px-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      min={0}
                      value={draft.threshold}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [l.id]: { ...draft, threshold: e.target.value } }))}
                      className="w-24 h-9 px-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                    <span className="text-[10px] text-slate-500 font-bold">MZ</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                    <button
                      onClick={() => handleSave(l)}
                      disabled={!dirty || savingId === l.id}
                      className="h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[11px] font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {savingId === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Guardar
                    </button>
                    <button
                      onClick={() => handleDelete(l)}
                      disabled={deletingId === l.id || levels.length <= 1}
                      title={levels.length <= 1 ? "Tem de existir pelo menos um nível." : "Apagar"}
                      className="h-9 w-9 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-450 flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {deletingId === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-2 border-t border-slate-900 flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome do novo nível"
            className="flex-1 h-9 px-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <input
              type="number"
              min={0}
              value={newThreshold}
              onChange={(e) => setNewThreshold(e.target.value)}
              placeholder="0"
              className="w-24 h-9 px-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            <span className="text-[10px] text-slate-500 font-bold">MZ</span>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[11px] font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Adicionar Nível
          </button>
        </div>
      </div>
    </div>
  );
}
