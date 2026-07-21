"use client";

import React, { useEffect, useRef, useState } from "react";
import { Send, Sparkles, User, AlertCircle, RefreshCcw } from "lucide-react";

interface AiTutorSidebarProps {
  courseId: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `m-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function AiTutorSidebar({ courseId }: AiTutorSidebarProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Garantir montagem apenas no cliente (evita avisos de hidratação no React 19)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Scroll automático para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Envia o histórico para /api/chat e lê a resposta em streaming (text stream)
  async function streamAssistant(history: ChatMessage[]) {
    setIsLoading(true);
    setError(null);

    const assistantId = uid();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m))
        );
      }

      // Se a stream não devolveu texto (ex.: só tool-call), remove a bolha vazia
      if (!acc.trim()) {
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      }
    } catch (err: any) {
      console.error("Erro no Tutor de IA:", err);
      setMessages((prev) => prev.filter((m) => m.content !== "" || m.role !== "assistant"));
      setError(err?.message || "Erro de ligação");
    } finally {
      setIsLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    await streamAssistant(next);
  };

  // Reenvia a última pergunta do utilizador
  const reload = async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser || isLoading) return;
    // remove eventuais respostas do assistente após a última pergunta
    const idx = messages.map((m) => m.id).lastIndexOf(lastUser.id);
    const history = messages.slice(0, idx + 1);
    setMessages(history);
    await streamAssistant(history);
  };

  return (
    <aside className="w-96 border-l border-slate-900 bg-slate-950 flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="p-4 border-b border-slate-900 flex items-center justify-between bg-slate-900/10">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
          <h3 className="font-bold text-white text-sm">Tutor de IA MOZAI</h3>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
          Contextual
        </span>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-4">
            <div className="p-4 bg-indigo-500/5 rounded-full border border-indigo-500/10 text-indigo-400">
              <BrainIcon className="h-10 w-10" />
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-white text-sm">Alguma dúvida sobre esta aula?</h4>
              <p className="text-slate-500 text-xs leading-relaxed max-w-[220px]">
                Pergunte-me qualquer conceito teórico ou código. Estou ancorado no currículo oficial.
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const isUser = message.role === "user";
            return (
              <div
                key={message.id}
                className={`flex gap-3 text-xs leading-relaxed ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <div className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center text-white flex-shrink-0">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                )}

                <div className="space-y-2 max-w-[80%]">
                  <div
                    className={`p-3 rounded-2xl whitespace-pre-wrap ${
                      isUser
                        ? "bg-indigo-600 text-white rounded-tr-none"
                        : "bg-slate-900 border border-slate-800/80 text-slate-200 rounded-tl-none"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>

                {isUser && (
                  <div className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 flex-shrink-0 ai-tutor-user-avatar">
                    <User className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Loading State (apenas antes de chegar o primeiro delta) */}
        {isLoading && messages[messages.length - 1]?.content === "" && (
          <div className="flex gap-3 text-xs leading-relaxed justify-start">
            <div className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center text-white flex-shrink-0 animate-pulse">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800/80 text-slate-400 rounded-tl-none flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        {/* Error Handle */}
        {error && (
          <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 flex flex-col gap-2 text-rose-400 text-xs">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertCircle className="h-4 w-4" />
              Erro de Ligação
            </div>
            <p className="text-[11px] text-rose-500/80">
              Ocorreu um problema ao enviar a mensagem. Por favor, tente novamente.
            </p>
            <button
              onClick={reload}
              className="inline-flex items-center justify-center gap-1.5 h-7 px-3 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-[10px] font-semibold text-rose-400 transition-colors self-start"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Reenviar
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Field Form - Renderizado apenas após montagem do cliente */}
      {mounted ? (
        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-900 bg-slate-950">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              placeholder="Diga qualquer dúvida sobre o curso..."
              className="w-full h-11 pl-4 pr-12 rounded-xl border border-slate-800 bg-slate-900 text-white text-xs focus:border-indigo-500 focus:outline-none transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-1.5 top-1.5 h-8 w-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      ) : (
        <div className="p-4 border-t border-slate-900 bg-slate-950 h-[77px] flex items-center justify-center text-slate-650 text-[10px] italic">
          A inicializar chat...
        </div>
      )}
    </aside>
  );
}

// Ícone Brain auxiliar
function BrainIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M12 5v14" />
      <path d="M12 12h6" />
      <path d="M12 12H6" />
    </svg>
  );
}
