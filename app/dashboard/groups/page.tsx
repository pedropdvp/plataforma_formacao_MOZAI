"use client";

import React, { useEffect, useState } from "react";
import { UsersRound, Loader2, Plus, Heart, Send } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";

interface Group {
  id: string;
  name: string;
  description: string;
  topic: string;
  membersCount: number;
  isMember: boolean;
}
interface GroupPost {
  id: string;
  authorName: string;
  content: string;
  likesCount: number;
  likedByMe: boolean;
  createdAt: string;
}

export default function GroupsPage() {
  const { showToast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [topic, setTopic] = useState("");
  const [creating, setCreating] = useState(false);

  const [selected, setSelected] = useState<Group | null>(null);
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/community/groups");
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
      const res = await fetch("/api/community/groups", {
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

  const handleToggleMembership = async (group: Group) => {
    try {
      const res = await fetch(`/api/community/groups/${group.id}/membership`, { method: "POST" });
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

  const openGroup = async (g: Group) => {
    setSelected(g);
    setLoadingPosts(true);
    try {
      const res = await fetch(`/api/community/groups/${g.id}/posts`);
      const data = await res.json();
      if (res.ok) setPosts(data.posts || []);
    } catch {
      showToast("Erro ao carregar as publicações.", "error");
    } finally {
      setLoadingPosts(false);
    }
  };

  const handlePost = async () => {
    if (!selected || !newPost.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/community/groups/${selected.id}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newPost.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewPost("");
        openGroup(selected);
      } else {
        showToast(data.error || "Erro ao publicar.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao publicar.", "error");
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (post: GroupPost) => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/community/groups/${selected.id}/posts/${post.id}/like`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, likedByMe: data.liked, likesCount: data.likesCount } : p)));
      }
    } catch {
      // silencioso
    }
  };

  return (
    <div className="space-y-8 workspace-page-container">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <UsersRound className="h-6 w-6 text-indigo-400" />
            Grupos
          </h1>
          <p className="text-sm text-slate-400">Grupos de discussão por tópico — junte-se e participe no feed próprio de cada grupo.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer">
          <Plus className="h-4 w-4" /> Novo Grupo
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do grupo" className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Tópico (ex: React, Carreira)" className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
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
          <span className="text-sm text-slate-500 italic">Ainda não há grupos.</span>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((g) => (
            <div key={g.id} className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-3 flex flex-col">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">{g.topic}</span>
              <h3 className="text-sm font-bold text-white">{g.name}</h3>
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 flex-1">{g.description}</p>
              <span className="text-[10px] text-slate-500">{g.membersCount} membros</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleToggleMembership(g)}
                  className={`flex-1 h-8 rounded-lg text-[11px] font-semibold cursor-pointer ${g.isMember ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400" : "bg-indigo-600 hover:bg-indigo-500 text-white"}`}
                >
                  {g.isMember ? "Membro" : "Juntar-me"}
                </button>
                <button onClick={() => openGroup(g)} className="h-8 px-3 rounded-lg border border-slate-800 hover:bg-slate-900 text-[11px] font-semibold text-slate-300 cursor-pointer">
                  Ver Feed
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
              <h4 className="font-bold text-sm text-white">{selected.name}</h4>
              <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-slate-300 cursor-pointer text-xs">Fechar</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selected.isMember && (
                <div className="flex gap-2">
                  <input value={newPost} onChange={(e) => setNewPost(e.target.value)} placeholder="Escreva algo para o grupo..." className="flex-1 h-9 px-3 rounded-lg border border-slate-800 bg-slate-900 text-white text-xs focus:border-indigo-500 focus:outline-none" />
                  <button onClick={handlePost} disabled={posting} className="h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shrink-0 disabled:opacity-55">
                    {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )}
              {loadingPosts ? (
                <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
              ) : posts.length === 0 ? (
                <span className="text-xs text-slate-500">Ainda não há publicações neste grupo.</span>
              ) : (
                posts.map((p) => (
                  <div key={p.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-900 space-y-1.5">
                    <span className="text-xs font-bold text-white">{p.authorName}</span>
                    <p className="text-[11px] text-slate-300">{p.content}</p>
                    <button onClick={() => handleLike(p)} className={`text-[10px] flex items-center gap-1 cursor-pointer ${p.likedByMe ? "text-rose-400" : "text-slate-500 hover:text-slate-300"}`}>
                      <Heart className={`h-3.5 w-3.5 ${p.likedByMe ? "fill-rose-400" : ""}`} /> {p.likesCount}
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
