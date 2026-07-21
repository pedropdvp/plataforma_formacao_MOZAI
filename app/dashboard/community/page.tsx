"use client";

import { useToast } from "@/components/ui/toast-provider";

import React, { useState } from "react";
import { Users, Send, CheckCircle2, ShieldAlert, Sparkles, MessageCircle } from "lucide-react";

interface Post {
  id: string;
  author: string;
  avatar: string;
  content: string;
  likes: number;
  time: string;
}

const INITIAL_POSTS: Post[] = [
  {
    id: "post-1",
    author: "Pedro Pinto",
    avatar: "P",
    content: "Acabei de implementar um bot RAG usando embeddings locais do BGE-M3. O tempo de resposta caiu para 120ms no meu MVP corporativo!",
    likes: 8,
    time: "Há 1 hora",
  },
  {
    id: "post-2",
    author: "Marta Gonçalves",
    avatar: "M",
    content: "Dica para quem está no módulo de Next.js 16: usem middleware dinâmico para multitenancy de forma a isolar as conexões de banco de dados nativamente.",
    likes: 12,
    time: "Há 3 horas",
  },
];

export default function CommunityPage() {
  const { showToast } = useToast();
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [postText, setPostText] = useState("");
  const [isPending, setIsPending] = useState(false);

  const handleSubmitPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postText.trim()) return;

    setIsPending(true);
    setPostText("");
    
    setTimeout(() => {
      setIsPending(false);
      showToast("Post enviado para moderação com sucesso! Aparecerá no feed assim que for validado pela equipa técnica.", "success");
    }, 1000);
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
          Partilha casos e descobertas com os teus colegas. Os posts são moderados antes de aparecerem.
        </p>
      </div>

      {/* Info warning */}
      <div className="border border-indigo-500/10 bg-[#070b13] rounded-3xl p-5 flex items-start gap-3.5">
        <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
          <ShieldAlert className="h-4.5 w-4.5" />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-bold text-white">Política de Moderação Ativa</span>
          <p className="text-xs text-slate-400 leading-relaxed">
            Mantemos o foco 100% técnico. Partilhe insights práticos, códigos úteis, conquistas profissionais ou dúvidas arquiteturais. Conteúdo duplicado ou fora do escopo do desenvolvimento será ignorado.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        {/* Left column: Feed list */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-900">
            Feed Recente
          </h3>

          <div className="space-y-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4 hover:border-slate-800 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs">
                      {post.avatar}
                    </div>
                    <div>
                      <span className="font-bold text-xs text-white block">{post.author}</span>
                      <span className="text-[9px] text-slate-500 font-mono">{post.time}</span>
                    </div>
                  </div>

                  <span className="text-[10px] text-emerald-450 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
                    Aprovado
                  </span>
                </div>

                <p className="text-xs leading-relaxed text-slate-300">{post.content}</p>

                <div className="flex items-center gap-4 pt-2 border-t border-slate-900/60 text-[10px] text-slate-500">
                  <button
                    onClick={() => showToast("Gosto registado!", "success")}
                    className="hover:text-indigo-400 transition-colors flex items-center gap-1"
                  >
                    <span>👍 {post.likes} gostos</span>
                  </button>
                  <button
                    onClick={() => showToast("A carregar comentários...", "info")}
                    className="hover:text-indigo-400 transition-colors flex items-center gap-1"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Comentar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column: Write post */}
        <div className="border border-slate-900 bg-[#070b13] rounded-3xl p-6 space-y-4">
          <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider">Criar Publicação</h3>
          
          <form onSubmit={handleSubmitPost} className="space-y-4">
            <textarea
              placeholder="Partilhe um caso de sucesso ou código..."
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              className="w-full h-32 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none transition-colors"
            />
            
            <button
              type="submit"
              disabled={isPending}
              className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10 cursor-pointer"
            >
              <Send className="h-4 w-4" />
              {isPending ? "A enviar..." : "Submeter Post"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
