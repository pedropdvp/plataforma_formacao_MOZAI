"use client";

import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useAccess } from "@/hooks/use-access";

import React, { useState, useEffect } from "react";
import { Users, Send, ThumbsUp, ShieldAlert, MessageCircle, Loader2, Trash2 } from "lucide-react";

interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

interface Post {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  mediaUrl: string | null;
  likesCount: number;
  likedByMe: boolean;
  comments: Comment[];
  createdAt: string;
}

export default function CommunityPage() {
  const { showToast } = useToast();
  const confirmDialog = useConfirm();
  const { userId, activeRole } = useAccess();
  const isModerator = activeRole === "ADMIN" || activeRole === "SUPORTE";

  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [postText, setPostText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openCommentsFor, setOpenCommentsFor] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [submittingCommentFor, setSubmittingCommentFor] = useState<string | null>(null);

  const loadPosts = async () => {
    try {
      const res = await fetch("/api/community/posts");
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (error) {
      console.error("Erro ao carregar o feed da Comunidade:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postText.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: postText.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setPosts((prev) => [data.post, ...prev]);
        setPostText("");
        showToast("Publicação criada com sucesso!", "success");
      } else {
        showToast(data.error || "Erro ao criar a publicação.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao criar a publicação.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLike = async (post: Post) => {
    // Otimista: reflete de imediato, corrige se o pedido falhar.
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id ? { ...p, likedByMe: !p.likedByMe, likesCount: p.likesCount + (p.likedByMe ? -1 : 1) } : p
      )
    );
    try {
      const res = await fetch(`/api/community/posts/${post.id}/like`, { method: "POST" });
      if (!res.ok) throw new Error();
    } catch {
      // reverte em caso de falha
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, likedByMe: post.likedByMe, likesCount: post.likesCount } : p
        )
      );
      showToast("Erro ao registar o gosto.", "error");
    }
  };

  const handleAddComment = async (postId: string) => {
    const text = (commentDrafts[postId] || "").trim();
    if (!text) return;

    setSubmittingCommentFor(postId);
    try {
      const res = await fetch(`/api/community/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (res.ok) {
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: data.comments } : p)));
        setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
      } else {
        showToast(data.error || "Erro ao comentar.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao comentar.", "error");
    } finally {
      setSubmittingCommentFor(null);
    }
  };

  const handleDeletePost = async (post: Post) => {
    const confirmed = await confirmDialog({
      title: "Eliminar Publicação",
      message: `Tem a certeza que quer eliminar esta publicação${post.authorId !== userId ? " (moderação)" : ""}? Esta ação não pode ser revertida.`,
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/community/posts/${post.id}`, { method: "DELETE" });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== post.id));
        showToast("Publicação eliminada.", "success");
      } else {
        const data = await res.json();
        showToast(data.error || "Erro ao eliminar a publicação.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao eliminar a publicação.", "error");
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <Users className="h-7 w-7 text-indigo-400" />
          Comunidade MOZAI
        </h1>
        <p className="text-sm text-slate-400">
          Partilhe conquistas, código e casos de sucesso com toda a comunidade. Para dúvidas sobre um curso específico, use o Fórum.
        </p>
      </div>

      {/* Info */}
      <div className="border border-indigo-500/10 bg-[#070b13] rounded-3xl p-5 flex items-start gap-3.5">
        <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
          <ShieldAlert className="h-4.5 w-4.5" />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-bold text-white">Foco Técnico e Profissional</span>
          <p className="text-xs text-slate-400 leading-relaxed">
            Partilhe insights práticos, código útil ou conquistas profissionais. Administradores e Suporte podem remover conteúdo fora do escopo.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        {/* Left column: Feed list */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-900">
            Feed Recente
          </h3>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
              <span className="text-xs font-medium">A carregar o feed...</span>
            </div>
          ) : posts.length === 0 ? (
            <div className="border border-slate-900 border-dashed rounded-3xl p-10 text-center">
              <span className="text-xs text-slate-500">Ainda não há publicações. Seja o primeiro a partilhar algo!</span>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => {
                const canDelete = post.authorId === userId || isModerator;
                const commentsOpen = openCommentsFor === post.id;
                return (
                  <div
                    key={post.id}
                    className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4 hover:border-slate-800 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs">
                          {post.authorName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-xs text-white block">{post.authorName}</span>
                          <span className="text-[9px] text-slate-500 font-mono">
                            {new Date(post.createdAt).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>

                      {canDelete && (
                        <button
                          onClick={() => handleDeletePost(post)}
                          title="Eliminar publicação"
                          className="h-7 w-7 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 flex items-center justify-center cursor-pointer shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <p className="text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">{post.content}</p>

                    <div className="flex items-center gap-4 pt-2 border-t border-slate-900/60 text-[10px] text-slate-500">
                      <button
                        onClick={() => handleToggleLike(post)}
                        className={`transition-colors flex items-center gap-1.5 cursor-pointer ${post.likedByMe ? "text-indigo-400 font-bold" : "hover:text-indigo-400"}`}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                        {post.likesCount} {post.likesCount === 1 ? "gosto" : "gostos"}
                      </button>
                      <button
                        onClick={() => setOpenCommentsFor(commentsOpen ? null : post.id)}
                        className="hover:text-indigo-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        {post.comments.length} {post.comments.length === 1 ? "comentário" : "comentários"}
                      </button>
                    </div>

                    {commentsOpen && (
                      <div className="space-y-3 pt-3 border-t border-slate-900/60">
                        {post.comments.map((c) => (
                          <div key={c.id} className="flex gap-2.5">
                            <div className="h-6 w-6 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-[9px] font-bold text-slate-400 shrink-0">
                              {c.authorName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 bg-slate-950/60 rounded-xl px-3 py-2">
                              <span className="text-[10px] font-bold text-white block">{c.authorName}</span>
                              <span className="text-[11px] text-slate-400">{c.text}</span>
                            </div>
                          </div>
                        ))}

                        <div className="flex gap-2">
                          <input
                            value={commentDrafts[post.id] || ""}
                            onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && handleAddComment(post.id)}
                            placeholder="Escreva um comentário..."
                            className="flex-1 h-8 px-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
                          />
                          <button
                            onClick={() => handleAddComment(post.id)}
                            disabled={submittingCommentFor === post.id}
                            className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[11px] font-semibold text-white cursor-pointer disabled:opacity-50 shrink-0"
                          >
                            {submittingCommentFor === post.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Enviar"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Write post */}
        <div className="border border-slate-900 bg-[#070b13] rounded-3xl p-6 space-y-4">
          <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider">Criar Publicação</h3>

          <form onSubmit={handleSubmitPost} className="space-y-4">
            <textarea
              placeholder="Partilhe um caso de sucesso, uma conquista ou código..."
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              className="w-full h-32 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none transition-colors"
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10 cursor-pointer"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSubmitting ? "A publicar..." : "Publicar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
