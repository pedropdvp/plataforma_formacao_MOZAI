"use client";

import React, { useState, useEffect, useRef } from "react";
import { Bot, X, Send, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const msgsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !hydrated) {
      fetch("/api/chatbot/conversation")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.messages) setMessages(data.messages);
          setHydrated(true);
        })
        .catch(() => setHydrated(true));
    }
  }, [open, hydrated]);

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, [messages, sending]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setSending(true);

    try {
      const res = await fetch("/api/chatbot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setMessages((prev) => [...prev, { role: "assistant", content: data.error || "Ocorreu um erro. Tente novamente." }]);
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: full };
          return next;
        });
      }

      if (!full.trim()) {
        const fallback = "Ocorreu um erro ao gerar a resposta. Tente novamente dentro de instantes.";
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: fallback };
          return next;
        });
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Erro de comunicação. Tente novamente." }]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9998] flex flex-col items-end gap-3">
      {open && (
        <div className="no-3d-effect w-[360px] h-[520px] max-h-[75vh] rounded-3xl border border-slate-850 bg-slate-950 shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-900 bg-slate-950/60 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Bot className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-white">Assistente MOZAI</h3>
                <p className="text-[10px] text-slate-500">Pergunte-me o que precisar</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={msgsRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 custom-scrollbar">
            {!hydrated ? (
              <div className="flex items-center justify-center h-full text-slate-500 gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">A carregar...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-xs text-slate-400 bg-slate-900/40 border border-slate-900 rounded-2xl p-3">
                Olá! Sou o assistente virtual da MOZAI. Em que posso ajudar?
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={`text-xs rounded-2xl p-3 whitespace-pre-wrap leading-relaxed max-w-[85%] ${
                    m.role === "user"
                      ? "ml-auto bg-indigo-600/20 border border-indigo-500/20 text-slate-100"
                      : "bg-slate-900/40 border border-slate-900 text-slate-300"
                  }`}
                >
                  {m.content || (sending && i === messages.length - 1 ? "…" : "")}
                </div>
              ))
            )}
          </div>

          <div className="p-3 border-t border-slate-900 flex items-end gap-2 shrink-0">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Escreva a sua mensagem…"
              className="flex-1 resize-none max-h-24 px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            <button
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              aria-label="Enviar"
              className="h-9 w-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fechar assistente" : "Abrir assistente"}
        className="h-14 w-14 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xl shadow-indigo-500/20 flex items-center justify-center cursor-pointer"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>
    </div>
  );
}
