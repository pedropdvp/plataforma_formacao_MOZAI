"use client";

import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useAccess } from "@/hooks/use-access";

import React, { useState, useEffect } from "react";
import { MessageSquare, ArrowRight, Plus, Trash2, Loader2 } from "lucide-react";

interface CourseForum {
  id: string;
  title: string;
  category: string;
  threadsCount: number;
}

export default function ForumPage() {
  const { showToast } = useToast();
  const confirmDialog = useConfirm();
  const { hasPermission } = useAccess();
  const canManage = hasPermission("FORUM_MANAGE");

  const [forums, setForums] = useState<CourseForum[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("");

  const fetchForums = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/forum");
      if (res.ok) {
        const data = await res.json();
        setForums(data.forums || []);
      }
    } catch (err) {
      console.error("Erro ao ler os fóruns:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForums();
  }, []);

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      showToast("O título do fórum é obrigatório.", "error");
      return;
    }
    if (!newCategory.trim()) {
      showToast("A categoria do fórum é obrigatória.", "error");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/forum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), category: newCategory.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Fórum "${newTitle.trim()}" criado.`, "success");
        setForums(data.forums || []);
        setNewTitle("");
        setNewCategory("");
        setShowCreateForm(false);
      } else {
        showToast(data.error || "Erro ao criar o fórum.", "error");
      }
    } catch (err) {
      showToast("Erro de comunicação ao criar o fórum.", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (forum: CourseForum) => {
    const confirmed = await confirmDialog({
      title: `Apagar Fórum "${forum.title}"`,
      message: `Isto vai eliminar definitivamente o fórum "${forum.title}" e todos os seus tópicos de discussão. Tem a certeza?`,
      confirmLabel: "Apagar",
      destructive: true,
    });
    if (!confirmed) return;

    setDeletingId(forum.id);
    try {
      const res = await fetch(`/api/forum/${forum.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        showToast(`Fórum "${forum.title}" eliminado.`, "success");
        setForums(data.forums || []);
      } else {
        showToast(data.error || "Erro ao apagar o fórum.", "error");
      }
    } catch (err) {
      showToast("Erro de comunicação ao apagar o fórum.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
            <MessageSquare className="h-7 w-7 text-indigo-400" />
            Fórum de Discussão
          </h1>
          <p className="text-sm text-slate-400">
            Selecione um curso para aceder ao fórum.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setShowCreateForm((v) => !v)}
            className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            Criar Fórum
          </button>
        )}
      </div>

      {/* Create Forum Form */}
      {canManage && showCreateForm && (
        <div className="border border-slate-900 bg-slate-950/40 rounded-2xl p-5 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Título do fórum (ex: nome do curso)"
            className="flex-1 h-10 px-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Categoria"
            className="sm:w-56 h-10 px-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
          <button
            onClick={handleCreate}
            disabled={creating}
            className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar
          </button>
        </div>
      )}

      {/* Forums List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          <span className="text-xs font-semibold">A carregar fóruns...</span>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-8">
          {forums.map((forum) => (
            <div
              key={forum.id}
              className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 flex flex-col justify-between hover:border-slate-800 transition-colors shadow-xl group"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider block">
                    {forum.category}
                  </span>
                  {canManage && (
                    <button
                      onClick={() => handleDelete(forum)}
                      disabled={deletingId === forum.id}
                      title="Apagar Fórum"
                      className="h-7 w-7 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    >
                      {deletingId === forum.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
                <h3 className="font-bold text-base text-white group-hover:text-indigo-400 transition-colors">
                  {forum.title}
                </h3>
                <p className="text-xs text-slate-500">
                  {forum.threadsCount} tópicos de discussão ativos
                </p>
              </div>

              <div className="pt-6 border-t border-slate-900/60 mt-6">
                <button
                  onClick={() => showToast(`A abrir fórum do curso: ${forum.title}`, "info")}
                  className="w-full inline-flex items-center justify-center h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white transition-colors group-hover:bg-indigo-600 gap-1.5 cursor-pointer"
                >
                  Aceder ao Fórum
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          {forums.length === 0 && (
            <div className="col-span-full text-center py-16 text-slate-500 text-sm">
              Ainda não existem fóruns criados.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
