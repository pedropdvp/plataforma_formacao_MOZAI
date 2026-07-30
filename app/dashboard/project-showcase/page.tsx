"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, Loader2, Plus, Heart, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";

interface ShowcaseProject {
  id: string;
  title: string;
  description: string;
  link: string;
  tags: string[];
  authorName: string;
  likesCount: number;
  likedByMe: boolean;
}

export default function ProjectShowcasePage() {
  const { showToast } = useToast();
  const [projects, setProjects] = useState<ShowcaseProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [tags, setTags] = useState("");
  const [publishing, setPublishing] = useState(false);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/community/showcase");
      const data = await res.json();
      if (res.ok) setProjects(data.projects || []);
    } catch {
      showToast("Erro ao carregar o showcase.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/community/showcase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, link, tags }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Projeto partilhado!", "success");
        setTitle(""); setDescription(""); setLink(""); setTags("");
        setShowForm(false);
        loadProjects();
      } else {
        showToast(data.error || "Erro ao publicar o projeto.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao publicar o projeto.", "error");
    } finally {
      setPublishing(false);
    }
  };

  const handleLike = async (project: ShowcaseProject) => {
    try {
      const res = await fetch(`/api/community/showcase/${project.id}/like`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, likedByMe: data.liked, likesCount: data.likesCount } : p)));
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
            <Sparkles className="h-6 w-6 text-indigo-400" />
            Projetos (Showcase)
          </h1>
          <p className="text-sm text-slate-400">Mostre o que construiu à comunidade e receba reconhecimento — não é uma vaga nem uma entrega de curso.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer">
          <Plus className="h-4 w-4" /> Partilhar Projeto
        </button>
      </div>

      {showForm && (
        <form onSubmit={handlePublish} className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do projeto" className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição do que construiu..." className="w-full h-20 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none" />
          <div className="grid sm:grid-cols-2 gap-3">
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link (repositório, demo...)" className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags, separadas por vírgula" className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
          </div>
          <button type="submit" disabled={publishing} className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-55">
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publicar"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 text-indigo-500 animate-spin" /></div>
      ) : projects.length === 0 ? (
        <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-12 text-center">
          <span className="text-sm text-slate-500 italic">Ainda não há projetos partilhados.</span>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((p) => (
            <div key={p.id} className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-3 flex flex-col">
              <h3 className="text-sm font-bold text-white">{p.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 flex-1">{p.description}</p>
              {p.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {p.tags.map((t) => (
                    <span key={t} className="text-[9px] font-mono font-bold text-indigo-400 bg-indigo-500/5 border border-indigo-500/10 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              )}
              {p.link && (
                <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-[11px] text-indigo-400 underline flex items-center gap-1 w-fit">
                  Ver projeto <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Por {p.authorName}</span>
                <button onClick={() => handleLike(p)} className={`text-[11px] flex items-center gap-1 cursor-pointer ${p.likedByMe ? "text-rose-400" : "text-slate-500 hover:text-slate-300"}`}>
                  <Heart className={`h-4 w-4 ${p.likedByMe ? "fill-rose-400" : ""}`} /> {p.likesCount}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
