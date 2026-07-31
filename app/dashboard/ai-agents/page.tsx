"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Bot, Loader2, Send, Info, Eye, Pencil, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useAccess } from "@/hooks/use-access";

interface AgentInfo {
  id: string;
  name: string;
  role: string;
  category: string;
  description: string;
  scopeNote: string | null;
}

interface AgentFull extends AgentInfo {
  systemPrompt: string;
}

const EMPTY_EDIT = { name: "", role: "", category: "", description: "", scopeNote: "", systemPrompt: "" };

export default function AiAgentsPage() {
  const { showToast } = useToast();
  const confirmDialog = useConfirm();
  const { activeRole } = useAccess();
  const canManage = activeRole === "ADMIN" || activeRole === "GESTOR_ACADEMICO" || activeRole === "FORMADOR";

  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [activeAgent, setActiveAgent] = useState<AgentInfo | null>(null);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const [viewingAgent, setViewingAgent] = useState<AgentFull | null>(null);
  const [editingAgent, setEditingAgent] = useState<AgentInfo | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadAgents = () => {
    setLoading(true);
    fetch("/api/ai-agents-catalog")
      .then((res) => res.json())
      .then((data) => setAgents(data.agents || []))
      .catch(() => showToast("Erro ao carregar o catálogo de agentes.", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openView = async (agent: AgentInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/ai-agents-catalog/${agent.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setViewingAgent(data.agent);
    } catch {
      showToast("Erro ao carregar detalhes do agente.", "error");
    }
  };

  const openEdit = async (agent: AgentInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/ai-agents-catalog/${agent.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditingAgent(agent);
      setEditForm({
        name: data.agent.name,
        role: data.agent.role,
        category: data.agent.category,
        description: data.agent.description,
        scopeNote: data.agent.scopeNote || "",
        systemPrompt: data.agent.systemPrompt,
      });
    } catch {
      showToast("Erro ao carregar detalhes do agente.", "error");
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/ai-agents-catalog/${editingAgent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditingAgent(null);
      showToast("Agente atualizado com sucesso.", "success");
      loadAgents();
    } catch (err: any) {
      showToast(err.message || "Erro ao atualizar o agente.", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (agent: AgentInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirmDialog({
      title: "Apagar Agente IA",
      message: `Tem a certeza que quer remover o agente "${agent.name}" do catálogo? Esta ação não pode ser revertida.`,
      confirmLabel: "Apagar",
      cancelLabel: "Cancelar",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/ai-agents-catalog/${agent.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("Agente removido do catálogo.", "success");
      loadAgents();
    } catch (err: any) {
      showToast(err.message || "Erro ao remover o agente.", "error");
    }
  };

  const categories = useMemo(() => {
    const groups: Record<string, AgentInfo[]> = {};
    const filtered = agents.filter(
      (a) => !search.trim() || a.name.toLowerCase().includes(search.toLowerCase()) || a.role.toLowerCase().includes(search.toLowerCase())
    );
    filtered.forEach((a) => {
      groups[a.category] = groups[a.category] || [];
      groups[a.category].push(a);
    });
    return groups;
  }, [agents, search]);

  const openAgent = (agent: AgentInfo) => {
    setActiveAgent(agent);
    setMessages([]);
    setInput("");
  };

  const handleSend = async () => {
    if (!input.trim() || !activeAgent) return;
    const userMessage = { role: "user" as const, content: input.trim() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    try {
      const res = await fetch(`/api/ai-agents-catalog/${activeAgent.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Erro ao conversar com este agente.", "error");
        setSending(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: assistantText };
          return copy;
        });
      }
    } catch {
      showToast("Erro de comunicação com o agente.", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-8 workspace-page-container">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Bot className="h-6 w-6 text-indigo-400" />
          AI Agents
        </h1>
        <p className="text-sm text-slate-400">23 personas especializadas, cada uma com um papel e regras próprias — todas executadas no mesmo motor real de IA da plataforma.</p>
      </div>

      <div className="border border-slate-900 bg-slate-950/40 rounded-2xl p-4 flex items-start gap-2.5">
        <Info className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Estas personas não são modelos de IA distintos nem têm capacidades diferentes entre si
          (ex: nenhuma tem voz real, acesso à internet em tempo real, ou memória entre sessões) — a
          especialização vem inteiramente das instruções próprias de cada uma, tal como um Modelo
          IA que criasses no Marketplace. Algumas (Blockchain Advisor, Crypto Analyst, Legal
          Assistant) incluem avisos explícitos de âmbito — nunca substituem aconselhamento
          profissional real.
        </p>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Pesquisar agente por nome ou papel..."
        className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
      />

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 text-indigo-500 animate-spin" /></div>
      ) : (
        Object.entries(categories).map(([category, list]) => (
          <div key={category} className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{category}</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {list.map((a) => (
                <div
                  key={a.id}
                  onClick={() => openAgent(a)}
                  className="ai-agent-card text-left border border-slate-900 rounded-2xl p-4 space-y-2 cursor-pointer transition-colors"
                >
                  <h4 className="font-bold text-sm text-white">{a.name}</h4>
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">{a.role}</span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{a.description}</p>
                  {a.scopeNote && <p className="text-[10px] text-amber-400 italic">{a.scopeNote}</p>}
                  {canManage && (
                    <div className="flex items-center gap-1 pt-2 mt-1 border-t border-slate-900/60">
                      <button onClick={(e) => openView(a, e)} title="Visualizar" className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-900 transition-colors cursor-pointer">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={(e) => openEdit(a, e)} title="Editar" className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-900 transition-colors cursor-pointer">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={(e) => handleDelete(a, e)} title="Apagar" className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors cursor-pointer">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {activeAgent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setActiveAgent(null)}>
          <div
            className="w-full max-w-lg h-[70vh] bg-slate-950 border border-slate-800 rounded-3xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-900 flex items-center justify-between shrink-0">
              <div>
                <h4 className="font-bold text-sm text-white">{activeAgent.name}</h4>
                <span className="text-[10px] text-slate-500">{activeAgent.role}</span>
              </div>
              <button onClick={() => setActiveAgent(null)} className="text-slate-500 hover:text-slate-300 cursor-pointer text-xs">Fechar</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <span className="text-xs text-slate-600 italic">Escreva uma mensagem para começar a conversar com {activeAgent.name}.</span>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`text-xs p-3 rounded-2xl max-w-[85%] leading-relaxed whitespace-pre-wrap ${
                    m.role === "user" ? "bg-indigo-600 text-white ml-auto" : "bg-slate-900 text-slate-200"
                  }`}
                >
                  {m.content || (sending && i === messages.length - 1 ? "..." : "")}
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-slate-900 flex gap-2 shrink-0">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !sending) handleSend(); }}
                placeholder="Escreva a sua mensagem..."
                className="flex-1 h-10 px-3 rounded-xl border border-slate-800 bg-slate-900 text-white text-xs focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={handleSend}
                disabled={sending}
                className="h-10 w-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center cursor-pointer disabled:opacity-55 shrink-0"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingAgent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setViewingAgent(null)}>
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{viewingAgent.name}</h3>
              <button onClick={() => setViewingAgent(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-300">
              <p><strong className="text-slate-500">Papel:</strong> {viewingAgent.role}</p>
              <p><strong className="text-slate-500">Categoria:</strong> {viewingAgent.category}</p>
              <p><strong className="text-slate-500">Descrição:</strong> {viewingAgent.description}</p>
              {viewingAgent.scopeNote && <p><strong className="text-slate-500">Nota de âmbito:</strong> {viewingAgent.scopeNote}</p>}
              <div className="pt-3 border-t border-slate-900">
                <span className="text-slate-500 font-bold block mb-1.5">System Prompt (instruções reais da persona):</span>
                <p className="whitespace-pre-wrap leading-relaxed bg-slate-900/60 border border-slate-900 rounded-xl p-3">{viewingAgent.systemPrompt}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingAgent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setEditingAgent(null)}>
          <form onSubmit={handleSaveEdit} className="bg-slate-950 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-3 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Editar Agente IA</h3>
              <button type="button" onClick={() => setEditingAgent(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Nome" className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
            <input type="text" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} placeholder="Papel" className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
            <input type="text" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} placeholder="Categoria" className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
            <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Descrição" rows={2} className="w-full px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none" />
            <input type="text" value={editForm.scopeNote} onChange={(e) => setEditForm({ ...editForm, scopeNote: e.target.value })} placeholder="Nota de âmbito (opcional)" className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
            <textarea value={editForm.systemPrompt} onChange={(e) => setEditForm({ ...editForm, systemPrompt: e.target.value })} placeholder="System Prompt (instruções reais da persona)" rows={6} className="w-full px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none font-mono" />
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditingAgent(null)} className="h-9 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer">Cancelar</button>
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
