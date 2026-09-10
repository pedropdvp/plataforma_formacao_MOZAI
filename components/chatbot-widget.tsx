"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Bot,
  X,
  Send,
  Loader2,
  Plus,
  History,
  Paperclip,
  Mic,
  Volume2,
  Globe,
  Trash2,
  Pencil,
  Star,
  RefreshCw,
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ConversationSummary {
  id: string;
  title: string;
  favorite: boolean;
  updatedAt: string;
}

interface PendingFile {
  name: string;
  mimeType: string;
  data: string; // base64
}

const OK_FILE_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const STORAGE_KEY = "mozai-chatbot-conversation";

type LangId = "pt" | "en" | "fr";

/** Idiomas do assistente. `voice` serve tanto o reconhecimento de fala como a leitura em
 *  voz alta, que antes estavam fixos em pt-PT independentemente da língua da resposta. */
const LANGS: Record<LangId, { label: string; voice: string }> = {
  pt: { label: "PT", voice: "pt-PT" },
  en: { label: "EN", voice: "en-GB" },
  fr: { label: "FR", voice: "fr-FR" },
};

/** Rótulos da interface por idioma — de pouco servia responder em inglês com os botões
 *  todos em português. */
const UI_TEXT: Record<LangId, Record<string, string>> = {
  pt: {
    placeholder: "Escreva a sua pergunta...",
    regenerate: "Regenerar resposta",
    creativity: "Criatividade",
    precise: "Preciso",
    creative: "Criativo",
    commError: "Erro de comunicação. Tente novamente.",
    genericError: "Ocorreu um erro. Tente novamente.",
  },
  en: {
    placeholder: "Type your question...",
    regenerate: "Regenerate answer",
    creativity: "Creativity",
    precise: "Precise",
    creative: "Creative",
    commError: "Communication error. Please try again.",
    genericError: "An error occurred. Please try again.",
  },
  fr: {
    placeholder: "Écrivez votre question...",
    regenerate: "Régénérer la réponse",
    creativity: "Créativité",
    precise: "Précis",
    creative: "Créatif",
    commError: "Erreur de communication. Veuillez réessayer.",
    genericError: "Une erreur est survenue. Veuillez réessayer.",
  },
};

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [webSearchOn, setWebSearchOn] = useState(false);
  const [persona, setPersona] = useState("assistente");
  const [lang, setLang] = useState<LangId>("pt");
  const [temperature, setTemperature] = useState(0.5);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  /** Guardada para o botão "Regenerar" poder reenviar a mesma pergunta. */
  const lastQuestionRef = useRef<string>("");

  const [recognizing, setRecognizing] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);

  const msgsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const hasSpeechRecognition =
    typeof window !== "undefined" && (("SpeechRecognition" in window) || ("webkitSpeechRecognition" in window));
  const hasSpeechSynthesis = typeof window !== "undefined" && "speechSynthesis" in window;

  // --- Hidratação inicial: conversa guardada localmente (se existir) ---
  useEffect(() => {
    if (!open || hydrated) return;
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (savedId) {
      loadConversation(savedId).finally(() => setHydrated(true));
    } else {
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hydrated]);

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, [messages, sending]);

  // Sugestões do idioma activo. Falhar aqui não é motivo para avisar ninguém — o chat
  // continua utilizável sem elas, só sem atalhos.
  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    fetch(`/api/chatbot/suggestions?lang=${lang}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelado && Array.isArray(data?.suggestions)) setSuggestions(data.suggestions);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [open, lang]);

  const loadConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/chatbot/conversations/${id}`);
      if (!res.ok) throw new Error("not found");
      const data = await res.json();
      setConversationId(id);
      localStorage.setItem(STORAGE_KEY, id);
      setMessages((data.messages || []).map((m: any) => ({ role: m.role, content: m.content })));
      setShowHistory(false);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setConversationId(null);
      setMessages([]);
    }
  };

  const startNewConversation = () => {
    setConversationId(null);
    localStorage.removeItem(STORAGE_KEY);
    setMessages([]);
    setShowHistory(false);
  };

  const openHistory = async () => {
    setShowHistory(true);
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/chatbot/conversations");
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch {
      setConversations([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleRename = async (conv: ConversationSummary) => {
    const name = window.prompt("Novo nome da conversa:", conv.title);
    if (!name || !name.trim()) return;
    await fetch(`/api/chatbot/conversations/${conv.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: name.trim() }),
    });
    await openHistory();
  };

  const handleFavorite = async (conv: ConversationSummary) => {
    await fetch(`/api/chatbot/conversations/${conv.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !conv.favorite }),
    });
    await openHistory();
  };

  const handleDelete = async (conv: ConversationSummary) => {
    if (!window.confirm(`Apagar a conversa "${conv.title}"?`)) return;
    await fetch(`/api/chatbot/conversations/${conv.id}`, { method: "DELETE" });
    if (conv.id === conversationId) startNewConversation();
    await openHistory();
  };

  // --- Anexos ---
  const acceptFile = (f: File | undefined) => {
    setFileError(null);
    if (!f) return;
    if (!OK_FILE_TYPES.includes(f.type)) {
      setFileError("Só imagens (PNG/JPEG/WEBP) ou PDF.");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setFileError("Ficheiro demasiado grande (máx. 3 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = String(reader.result).split(",")[1] || "";
      setPendingFile({ name: f.name, mimeType: f.type, data: b64 });
    };
    reader.readAsDataURL(f);
  };

  // --- Voz: reconhecimento (STT) ---
  const toggleMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (recognizing) {
      recognitionRef.current?.stop();
      return;
    }
    const recog = new SR();
    recog.lang = LANGS[lang].voice;
    recog.continuous = false;
    recog.interimResults = true;
    recog.onstart = () => setRecognizing(true);
    recog.onend = () => setRecognizing(false);
    recog.onerror = () => setRecognizing(false);
    recog.onresult = (e: any) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript;
      setInput(text);
    };
    recognitionRef.current = recog;
    recog.start();
  };

  // --- Voz: leitura (TTS) ---
  const speak = (text: string, index: number) => {
    if (!hasSpeechSynthesis) return;
    const synth = window.speechSynthesis;
    if (speakingIndex === index) {
      synth.cancel();
      setSpeakingIndex(null);
      return;
    }
    synth.cancel();
    const clean = text.replace(/[#*_`>~]+/g, " ").replace(/\s+/g, " ").trim();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = LANGS[lang].voice;
    u.onend = () => setSpeakingIndex(null);
    u.onerror = () => setSpeakingIndex(null);
    utterRef.current = u;
    setSpeakingIndex(index);
    synth.speak(u);
  };

  /**
   * Envia uma pergunta. Com `regenerate`, reenvia a última em vez de acrescentar uma nova:
   * a bolha da resposta anterior é substituída no ecrã e o servidor apaga-a na base de
   * dados, para a conversa não ficar com duas respostas seguidas à mesma pergunta.
   */
  const sendMessage = async (options?: { regenerate?: boolean; text?: string }) => {
    const regenerate = options?.regenerate === true;
    // `text` explícito serve os botões de sugestão: passar pelo estado `input` e disparar a
    // seguir não funcionaria, porque esta função leria o valor antigo do closure.
    const text = regenerate ? lastQuestionRef.current : (options?.text ?? input).trim();
    if ((!text && !pendingFile) || sending) return;

    const fileToSend = regenerate ? null : pendingFile;
    if (regenerate) {
      // Retira do ecrã a resposta que vai ser substituída.
      setMessages((prev) => (prev.length && prev[prev.length - 1].role === "assistant" ? prev.slice(0, -1) : prev));
    } else {
      setInput("");
      setPendingFile(null);
      lastQuestionRef.current = text;
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text + (fileToSend ? ` 📎 ${fileToSend.name}` : "") },
      ]);
    }
    setSending(true);

    try {
      const res = await fetch("/api/chatbot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId,
          file: fileToSend || undefined,
          webSearch: webSearchOn,
          persona,
          lang,
          temperature,
          regenerate,
        }),
      });

      const newConvId = res.headers.get("X-Conversation-Id");
      if (newConvId && newConvId !== conversationId) {
        setConversationId(newConvId);
        localStorage.setItem(STORAGE_KEY, newConvId);
      }

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setMessages((prev) => [...prev, { role: "assistant", content: data.error || UI_TEXT[lang].genericError }]);
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
        const fallback = "Ocorreu um erro ao gerar a resposta. Necessário adicionar crédito à conta da API na OpenAI.";
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: fallback };
          return next;
        });
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: UI_TEXT[lang].commError }]);
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
        <div className="no-3d-effect w-[380px] h-[560px] max-h-[78vh] rounded-3xl border border-slate-850 bg-slate-950 shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-900 bg-slate-950/60 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                <Bot className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-extrabold text-white truncate">Assistente MOZAI</h3>
                <p className="text-[10px] text-slate-500">Pergunte-me o que precisar</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={startNewConversation}
                aria-label="Nova conversa"
                title="Nova conversa"
                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white cursor-pointer"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={openHistory}
                aria-label="Histórico"
                title="Histórico"
                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white cursor-pointer"
              >
                <History className="h-4 w-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="px-4 py-2 border-b border-slate-900 bg-slate-950/40 shrink-0 space-y-2">
            <div className="flex gap-2">
              <select
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                aria-label="Escolher persona do assistente"
                className="flex-1 h-7 px-2 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 cursor-pointer"
              >
                <option value="assistente">🤖 Assistente Geral</option>
                <option value="mentor">🧭 Mentor</option>
                <option value="coach_carreira">💼 Coach de Carreira</option>
                <option value="code_reviewer">🧑‍💻 Code Reviewer</option>
                <option value="examinador">📝 Examinador</option>
              </select>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as LangId)}
                aria-label="Idioma da resposta"
                title="Idioma da resposta"
                className="h-7 px-2 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 cursor-pointer"
              >
                {(Object.keys(LANGS) as LangId[]).map((id) => (
                  <option key={id} value={id}>
                    {LANGS[id].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="chatbot-temperature" className="text-[10px] text-slate-500 shrink-0">
                {UI_TEXT[lang].creativity}
              </label>
              <input
                id="chatbot-temperature"
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="flex-1 h-1 accent-indigo-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 w-14 text-right shrink-0">
                {temperature <= 0.3 ? UI_TEXT[lang].precise : temperature >= 0.7 ? UI_TEXT[lang].creative : temperature.toFixed(1)}
              </span>
            </div>
          </div>

          {showHistory ? (
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 custom-scrollbar">
              {loadingHistory ? (
                <div className="flex items-center justify-center h-full text-slate-500 gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">A carregar...</span>
                </div>
              ) : conversations.length === 0 ? (
                <p className="text-xs text-slate-500 italic px-2 py-4">Ainda não tem conversas guardadas.</p>
              ) : (
                conversations.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-center gap-1 px-2 py-2 rounded-xl text-xs cursor-pointer ${
                      c.id === conversationId ? "bg-indigo-600/10 border border-indigo-500/20" : "hover:bg-slate-900"
                    }`}
                  >
                    <button
                      onClick={() => handleFavorite(c)}
                      aria-label="Favorito"
                      className={`h-6 w-6 rounded-lg flex items-center justify-center shrink-0 cursor-pointer ${
                        c.favorite ? "text-amber-400" : "text-slate-600 hover:text-slate-400"
                      }`}
                    >
                      <Star className="h-3.5 w-3.5" fill={c.favorite ? "currentColor" : "none"} />
                    </button>
                    <button onClick={() => loadConversation(c.id)} className="flex-1 min-w-0 text-left truncate text-slate-200 cursor-pointer">
                      {c.title}
                    </button>
                    <button
                      onClick={() => handleRename(c)}
                      aria-label="Renomear"
                      className="h-6 w-6 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800 shrink-0 cursor-pointer"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      aria-label="Apagar"
                      className="h-6 w-6 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-slate-800 shrink-0 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div ref={msgsRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 custom-scrollbar">
              {!hydrated ? (
                <div className="flex items-center justify-center h-full text-slate-500 gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">A carregar...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="space-y-2">
                  <div className="text-xs text-slate-400 bg-slate-900/40 border border-slate-900 rounded-2xl p-3">
                    Olá! Sou o assistente virtual da MOZAI. Em que posso ajudar?
                  </div>
                  {/* Uma conversa em branco não diz o que se pode perguntar — estes atalhos
                      dizem, e são configuráveis por empresa em Configurações > ChatBot. */}
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage({ text: s })}
                      className="w-full text-left text-[11px] text-slate-300 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/30 rounded-xl px-3 py-2 cursor-pointer transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "ml-auto max-w-[85%]" : "max-w-[85%]"}>
                    <div
                      className={`text-xs rounded-2xl p-3 whitespace-pre-wrap leading-relaxed ${
                        m.role === "user"
                          ? "bg-indigo-600/20 border border-indigo-500/20 text-slate-100"
                          : "bg-slate-900/40 border border-slate-900 text-slate-300"
                      }`}
                    >
                      {m.content || (sending && i === messages.length - 1 ? "…" : "")}
                    </div>
                    {m.role === "assistant" && m.content && (
                      <div className="mt-1 flex items-center gap-1">
                        {hasSpeechSynthesis && (
                          <button
                            onClick={() => speak(m.content, i)}
                            aria-label="Ouvir"
                            className={`h-6 px-2 rounded-lg flex items-center gap-1 text-[10px] cursor-pointer ${
                              speakingIndex === i ? "text-indigo-400" : "text-slate-500 hover:text-slate-300"
                            }`}
                          >
                            <Volume2 className="h-3 w-3" />
                            {speakingIndex === i ? "A ler…" : "Ouvir"}
                          </button>
                        )}
                        {/* Só na última resposta: regenerar uma do meio da conversa deixaria
                            o histórico incoerente com o que veio depois. */}
                        {i === messages.length - 1 && !sending && lastQuestionRef.current && (
                          <button
                            onClick={() => sendMessage({ regenerate: true })}
                            aria-label={UI_TEXT[lang].regenerate}
                            title={UI_TEXT[lang].regenerate}
                            className="h-6 px-2 rounded-lg flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer"
                          >
                            <RefreshCw className="h-3 w-3" />
                            {UI_TEXT[lang].regenerate}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {!showHistory && (
            <div className="border-t border-slate-900 shrink-0">
              {(pendingFile || fileError) && (
                <div className="px-3 pt-2 flex items-center gap-2">
                  {pendingFile && (
                    <span className="text-[10px] px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1.5">
                      📎 {pendingFile.name}
                      <button onClick={() => setPendingFile(null)} aria-label="Remover anexo" className="text-slate-500 hover:text-white cursor-pointer">
                        ✕
                      </button>
                    </span>
                  )}
                  {fileError && <span className="text-[10px] text-rose-450">{fileError}</span>}
                </div>
              )}

              <div className="p-3 flex items-end gap-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  hidden
                  onChange={(e) => {
                    acceptFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Anexar ficheiro"
                  title="Anexar ficheiro"
                  className="h-9 w-9 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900 text-slate-400 flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                {hasSpeechRecognition && (
                  <button
                    onClick={toggleMic}
                    aria-label="Falar"
                    title="Falar"
                    className={`h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 cursor-pointer ${
                      recognizing
                        ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                        : "border-slate-800 bg-slate-900/40 hover:bg-slate-900 text-slate-400"
                    }`}
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setWebSearchOn((v) => !v)}
                  aria-label="Pesquisar na Web"
                  title="Pesquisar na Web"
                  className={`h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 cursor-pointer ${
                    webSearchOn
                      ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-400"
                      : "border-slate-800 bg-slate-900/40 hover:bg-slate-900 text-slate-400"
                  }`}
                >
                  <Globe className="h-4 w-4" />
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder={UI_TEXT[lang].placeholder}
                  className="flex-1 resize-none max-h-24 px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={sending || (!input.trim() && !pendingFile)}
                  aria-label="Enviar"
                  className="h-9 w-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
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
