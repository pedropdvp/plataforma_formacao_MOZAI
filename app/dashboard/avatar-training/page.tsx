"use client";

import React, { useEffect, useState } from "react";
import { Users, Bot, Play, Video, Mic, Plus, Eye, Pencil, Trash2, X, Loader2 } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";

interface Avatar {
  id: string;
  name: string;
  role: string;
  subject: string;
  scenario: string;
  difficulty: "Fácil" | "Médio" | "Difícil";
  createdById: string;
  createdByName: string;
}

interface AvatarDetail extends Avatar {
  createdAt: string;
}

const DIFFICULTIES: Avatar["difficulty"][] = ["Fácil", "Médio", "Difícil"];

const EMPTY_FORM = { name: "", role: "", subject: "", scenario: "", difficulty: "Médio" as Avatar["difficulty"] };

export default function AvatarTrainingPage() {
  const confirmDialog = useConfirm();
  const { showToast } = useToast();

  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loadingAvatars, setLoadingAvatars] = useState(true);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const [viewingAvatar, setViewingAvatar] = useState<AvatarDetail | null>(null);
  const [editingAvatar, setEditingAvatar] = useState<Avatar | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [savingEdit, setSavingEdit] = useState(false);

  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);
  const [trainingActive, setTrainingActive] = useState(false);
  const [messages, setMessages] = useState<{ sender: "user" | "avatar"; text: string }[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [sending, setSending] = useState(false);

  const loadAvatars = () => {
    setLoadingAvatars(true);
    fetch("/api/avatar-training")
      .then((res) => res.json())
      .then((data) => setAvatars(data.avatars || []))
      .catch(() => showToast("Erro ao carregar os avatares de treino.", "error"))
      .finally(() => setLoadingAvatars(false));
  };

  useEffect(() => {
    loadAvatars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.role.trim() || !form.subject.trim() || !form.scenario.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/avatar-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setForm(EMPTY_FORM);
      setShowCreateForm(false);
      showToast("Avatar de treino criado com sucesso.", "success");
      loadAvatars();
    } catch {
      showToast("Erro ao criar o avatar.", "error");
    } finally {
      setCreating(false);
    }
  };

  const openView = async (avatar: Avatar) => {
    try {
      const res = await fetch(`/api/avatar-training/${avatar.id}`);
      const data = await res.json();
      if (data.avatar) setViewingAvatar(data.avatar);
    } catch {
      showToast("Erro ao carregar detalhes do avatar.", "error");
    }
  };

  const openEdit = (avatar: Avatar) => {
    setEditingAvatar(avatar);
    setEditForm({ name: avatar.name, role: avatar.role, subject: avatar.subject, scenario: avatar.scenario, difficulty: avatar.difficulty });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAvatar) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/avatar-training/${editingAvatar.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error();
      setEditingAvatar(null);
      showToast("Avatar atualizado com sucesso.", "success");
      loadAvatars();
    } catch {
      showToast("Erro ao atualizar o avatar.", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (avatar: Avatar) => {
    const confirmed = await confirmDialog({
      title: "Apagar avatar",
      message: `Tem a certeza que quer apagar o avatar "${avatar.name}"? Esta ação não pode ser revertida.`,
      confirmLabel: "Apagar",
      cancelLabel: "Cancelar",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/avatar-training/${avatar.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast("Avatar apagado.", "success");
      loadAvatars();
    } catch {
      showToast("Erro ao apagar o avatar.", "error");
    }
  };

  const handleStartTraining = (avatar: Avatar) => {
    setSelectedAvatar(avatar);
    setTrainingActive(true);
    setMessages([
      {
        sender: "avatar",
        text: `Olá! Eu sou o ${avatar.name} (${avatar.role}). Estou pronto para iniciar o cenário: "${avatar.scenario}", sobre "${avatar.subject}". Como queres começar?`,
      },
    ]);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || !selectedAvatar || sending) return;

    const userText = inputVal;
    const nextMessages = [...messages, { sender: "user" as const, text: userText }];
    setMessages(nextMessages);
    setInputVal("");
    setSending(true);

    try {
      const res = await fetch(`/api/avatar-training/${selectedAvatar.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.sender === "user" ? "user" : "assistant", content: m.text })),
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao comunicar com o avatar.");
      }

      setMessages((prev) => [...prev, { sender: "avatar", text: "" }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { sender: "avatar", text: acc };
          return copy;
        });
      }
    } catch (err: any) {
      showToast(err.message || "Erro ao comunicar com o avatar.", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <Bot className="h-7 w-7 text-indigo-400" />
          Treino com Avatares
        </h1>
        <p className="text-sm text-slate-400">
          Crie os seus próprios avatares de treino sobre qualquer tema — por exemplo Criptomoedas ou Inteligência Artificial — e converse em tempo real com um agente de IA que conduz a simulação.
        </p>
      </div>

      {!trainingActive ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-900">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">Os Teus Avatares de Treino</h2>
            </div>
            <button
              onClick={() => setShowCreateForm((v) => !v)}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Criar Avatar
            </button>
          </div>

          {showCreateForm && (
            <form onSubmit={handleCreate} className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-400">Nome do Avatar</label>
                  <input
                    type="text"
                    placeholder="Ex: Marco Silva"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-400">Papel / Persona</label>
                  <input
                    type="text"
                    placeholder="Ex: Analista de Investimento em Criptomoedas"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-400">Tema / Matéria</label>
                  <input
                    type="text"
                    placeholder="Ex: Criptomoedas, Inteligência Artificial..."
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-400">Dificuldade</label>
                  <select
                    value={form.difficulty}
                    onChange={(e) => setForm({ ...form, difficulty: e.target.value as Avatar["difficulty"] })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
                  >
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400">Cenário</label>
                <textarea
                  placeholder="Ex: O aluno tem de explicar a diferença entre Bitcoin e Ethereum e defender uma estratégia de investimento a longo prazo."
                  value={form.scenario}
                  onChange={(e) => setForm({ ...form, scenario: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="h-9 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="h-9 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {creating ? "A guardar..." : "Guardar Avatar"}
                </button>
              </div>
            </form>
          )}

          {loadingAvatars ? (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : avatars.length === 0 ? (
            <div className="border border-dashed border-slate-800 rounded-3xl p-10 text-center text-sm text-slate-500">
              Ainda não criou nenhum avatar de treino. Clique em "Criar Avatar" para começar.
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-8">
              {avatars.map((avatar) => (
                <div
                  key={avatar.id}
                  className="border border-slate-900 bg-slate-950/40 rounded-3xl overflow-hidden hover:border-slate-800 transition-all flex flex-col justify-between group shadow-xl"
                >
                  <div className="h-32 bg-slate-900 relative flex items-center justify-center p-6 border-b border-slate-900/60 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent opacity-60 z-10" />
                    <div className="w-20 h-20 rounded-full border-2 border-indigo-500/25 bg-slate-950 flex items-center justify-center relative z-20 text-slate-400 font-bold overflow-hidden shadow-lg">
                      <span className="text-2xl">{avatar.name[0]}</span>
                    </div>
                    <span className={`absolute top-4 right-4 text-[9px] font-bold px-2 py-0.5 rounded-full border z-20 ${
                      avatar.difficulty === "Difícil"
                        ? "bg-rose-500/10 border-rose-500/25 text-rose-450"
                        : avatar.difficulty === "Médio"
                        ? "bg-amber-500/10 border-amber-500/25 text-amber-400"
                        : "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                    }`}>
                      {avatar.difficulty}
                    </span>
                  </div>

                  <div className="p-6 space-y-4 flex-grow flex flex-col justify-between">
                    <div className="space-y-2">
                      <h3 className="font-bold text-base text-white group-hover:text-indigo-400 transition-colors">
                        {avatar.name}
                      </h3>
                      <span className="text-xs text-indigo-300 font-medium block">{avatar.role}</span>
                      <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">
                        <strong>Tema:</strong> {avatar.subject}
                      </p>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-slate-900/60">
                      <button
                        onClick={() => handleStartTraining(avatar)}
                        className="w-full inline-flex items-center justify-center h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white transition-all group-hover:bg-indigo-600 gap-1.5 cursor-pointer"
                      >
                        Iniciar Treino
                        <Play className="h-3.5 w-3.5 fill-white" />
                      </button>
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => openView(avatar)} title="Visualizar" className="p-2 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-900 transition-colors cursor-pointer">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => openEdit(avatar)} title="Editar" className="p-2 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-900 transition-colors cursor-pointer">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(avatar)} title="Apagar" className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors cursor-pointer">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8 items-stretch min-h-[500px]">
          <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 flex flex-col justify-between items-center text-center space-y-6">
            <div className="space-y-2">
              <span className="text-xs text-indigo-400 font-semibold uppercase tracking-wider block">Sessão de Treino Ativa</span>
              <h3 className="text-lg font-bold text-white">{selectedAvatar?.name}</h3>
              <span className="text-xs text-slate-500">{selectedAvatar?.role}</span>
            </div>

            <div className="w-44 h-44 rounded-full border-4 border-indigo-500/20 bg-slate-950 flex items-center justify-center relative overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-indigo-500/5 animate-pulse" />
              <Bot className="h-16 w-16 text-indigo-400 animate-bounce-slow" />
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
                <strong>Cenário:</strong> {selectedAvatar?.scenario}
              </div>
              <button
                onClick={() => setTrainingActive(false)}
                className="w-full h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-350 border border-slate-850 hover:border-slate-800 transition-colors cursor-pointer"
              >
                Terminar Sessão
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 border border-slate-900 bg-slate-950/20 rounded-3xl p-6 flex flex-col justify-between h-[500px]">
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] p-4 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                    m.sender === "user"
                      ? "bg-indigo-600 text-white rounded-br-none"
                      : "bg-[#070b13] border border-slate-900 text-slate-300 rounded-bl-none"
                  }`}>
                    {m.text || (sending && idx === messages.length - 1 ? "..." : "")}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                placeholder={`Fale com ${selectedAvatar?.name}...`}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                disabled={sending}
                className="flex-1 h-11 px-4 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={sending}
                className="px-5 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all shadow-lg shadow-indigo-600/10 cursor-pointer disabled:opacity-50"
              >
                {sending ? "A enviar..." : "Enviar Resposta"}
              </button>
            </form>
          </div>
        </div>
      )}

      {viewingAvatar && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setViewingAvatar(null)}>
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{viewingAvatar.name}</h3>
              <button onClick={() => setViewingAvatar(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs text-slate-300">
              <p><strong className="text-slate-500">Papel:</strong> {viewingAvatar.role}</p>
              <p><strong className="text-slate-500">Tema:</strong> {viewingAvatar.subject}</p>
              <p><strong className="text-slate-500">Cenário:</strong> {viewingAvatar.scenario}</p>
              <p><strong className="text-slate-500">Dificuldade:</strong> {viewingAvatar.difficulty}</p>
              <p><strong className="text-slate-500">Criado por:</strong> {viewingAvatar.createdByName}</p>
              <p><strong className="text-slate-500">Criado em:</strong> {new Date(viewingAvatar.createdAt).toLocaleDateString("pt-PT")}</p>
            </div>
          </div>
        </div>
      )}

      {editingAvatar && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setEditingAvatar(null)}>
          <form onSubmit={handleSaveEdit} className="bg-slate-950 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Editar Avatar</h3>
              <button type="button" onClick={() => setEditingAvatar(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Nome" className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
              <input type="text" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} placeholder="Papel" className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
              <input type="text" value={editForm.subject} onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })} placeholder="Tema" className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
              <select value={editForm.difficulty} onChange={(e) => setEditForm({ ...editForm, difficulty: e.target.value as Avatar["difficulty"] })} className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none">
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <textarea value={editForm.scenario} onChange={(e) => setEditForm({ ...editForm, scenario: e.target.value })} placeholder="Cenário" rows={3} className="w-full px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingAvatar(null)} className="h-9 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer">Cancelar</button>
              <button type="submit" disabled={savingEdit} className="h-9 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors disabled:opacity-50 cursor-pointer">
                {savingEdit ? "A guardar..." : "Guardar Alterações"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
