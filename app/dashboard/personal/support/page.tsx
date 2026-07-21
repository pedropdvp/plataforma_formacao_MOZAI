"use client";

import React, { useState, useEffect } from "react";
import { LifeBuoy, Send, MessageSquare, ShieldAlert, Loader2, Clock, CheckCircle, User, MessageCircle } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { useAccess } from "@/hooks/use-access";
import { useToast } from "@/components/ui/toast-provider";

interface SupportTicket {
  _id: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  message: string;
  status: string;
  replyMessage?: string;
  repliedAt?: string;
  replierName?: string;
  createdAt: string;
}

export default function SupportPage() {
  const { t } = useLanguage();
  const { activeRole } = useAccess();
  const isAdminOrSupport = activeRole === "ADMIN" || activeRole === "SUPORTE";

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  // Estados exclusivos do painel administrativo
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const { showToast } = useToast();

  // Carregar histórico de pedidos de suporte (seus próprios se for aluno, todos se for admin)
  const loadTickets = async () => {
    try {
      setLoadingTickets(true);
      const res = await fetch("/api/support/tickets");
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (err) {
      console.error("Erro ao carregar tickets de suporte:", err);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (activeRole) {
      loadTickets();
    }
  }, [activeRole]);

  // Submissão do Aluno (Criar Ticket)
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setIsSending(true);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message })
      });
      if (res.ok) {
        const data = await res.json();
        setTickets([data.ticket, ...tickets]);
        setSubject("");
        setMessage("");
        showToast("Pedido de suporte enviado com sucesso! Resposta em até 24h úteis.", "success", 5000);
      } else {
        const data = await res.json();
        showToast(data.error || "Erro ao submeter pedido de suporte.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Erro de rede ao submeter pedido de suporte.", "error");
    } finally {
      setIsSending(false);
    }
  };

  // Submissão do Admin (Responder a Ticket)
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;

    setIsReplying(true);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: selectedTicket._id,
          replyMessage: replyText
        })
      });
      if (res.ok) {
        const data = await res.json();
        // Atualizar lista local de tickets
        setTickets(tickets.map(t => t._id === selectedTicket._id ? data.ticket : t));
        setSelectedTicket(data.ticket);
        setReplyText("");
        showToast("Resposta enviada com sucesso!", "success");
      } else {
        const data = await res.json();
        showToast(data.error || "Erro ao submeter resposta.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Erro ao enviar resposta.", "error");
    } finally {
      setIsReplying(false);
    }
  };

  // --- RENDER VISUAL PARA ADMIN / SUPORTE ---
  if (isAdminOrSupport) {
    return (
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
            <LifeBuoy className="h-7 w-7 text-indigo-400" />
            Consola de Suporte Técnico
          </h1>
          <p className="text-sm text-slate-400">
            Responda e acompanhe as solicitações e incidentes técnicos abertos pelos utilizadores da plataforma.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 items-start">
          {/* Coluna 1 & 2: Lista de Todos os Pedidos */}
          <div className="lg:col-span-2 border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <MessageSquare className="h-4.5 w-4.5 text-indigo-400" />
              Lista Geral de Pedidos
            </h3>

            {loadingTickets ? (
              <div className="flex items-center gap-2 text-slate-500 py-4">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                <span>A carregar tickets...</span>
              </div>
            ) : tickets.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">
                Nenhum ticket aberto no sistema.
              </p>
            ) : (
              <div className="space-y-3">
                {tickets.map((t) => (
                  <div
                    key={t._id}
                    onClick={() => {
                      setSelectedTicket(t);
                      setReplyText("");
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 ${
                      selectedTicket?._id === t._id
                        ? "border-indigo-500 bg-indigo-500/5"
                        : "border-slate-900 bg-[#070b13]/60 hover:border-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-white truncate max-w-[250px]">
                        {t.subject}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                        t.status === "Pendente"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      }`}>
                        {t.status === "Pendente" ? <Clock className="h-2.5 w-2.5" /> : <CheckCircle className="h-2.5 w-2.5" />}
                        {t.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2">{t.message}</p>

                    <div className="text-[10px] text-slate-500 border-t border-slate-900/60 pt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-400">{t.userName}</span>
                        <span className="text-slate-600">({t.userEmail})</span>
                      </div>
                      <span>{new Date(t.createdAt).toLocaleString("pt-PT")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Coluna 3: Responder ao Pedido Selecionado */}
          <div className="border border-slate-900 bg-[#070b13] rounded-3xl p-6 space-y-5">
            <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
              <MessageCircle className="h-4.5 w-4.5 text-indigo-400" />
              Responder ao Ticket
            </h3>

            {selectedTicket ? (
              <div className="space-y-4">
                {/* Detalhes do Ticket Selecionado */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-900 space-y-2">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Assunto</span>
                    <h4 className="text-xs font-bold text-white leading-snug">{selectedTicket.subject}</h4>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Mensagem do Aluno</span>
                    <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{selectedTicket.message}</p>
                  </div>
                </div>

                {/* Exibir resposta anterior se houver */}
                {selectedTicket.replyMessage ? (
                  <div className="p-3.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold text-indigo-400">
                      <span>RESPONDIDO POR {selectedTicket.replierName?.toUpperCase()}</span>
                      {selectedTicket.repliedAt && (
                        <span>{new Date(selectedTicket.repliedAt).toLocaleDateString("pt-PT")}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-350 leading-relaxed whitespace-pre-wrap">{selectedTicket.replyMessage}</p>
                  </div>
                ) : (
                  // Formulário de Resposta se estiver Pendente
                  <form onSubmit={handleSendReply} className="space-y-3.5 pt-2">
                    <div className="space-y-2">
                      <label className="text-xs text-slate-500 font-medium">Escreva a Resposta</label>
                      <textarea
                        placeholder="Insira as instruções ou suporte para o utilizador..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="w-full h-32 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none transition-colors"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isReplying}
                      className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/15"
                    >
                      <Send className="h-4 w-4" />
                      {isReplying ? "A enviar..." : "Enviar Resposta"}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic py-4 text-center">
                Selecione um pedido à esquerda para consultar detalhes e responder.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER VISUAL PARA ALUNO ---
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <LifeBuoy className="h-7 w-7 text-indigo-400" />
          {t("nav_support", "Suporte Técnico")}
        </h1>
        <p className="text-sm text-slate-400">
          Abra um pedido de suporte para esclarecer qualquer dúvida administrativa ou técnica sobre a plataforma.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        {/* Left Form */}
        <div className="lg:col-span-2 border border-slate-900 bg-slate-950/20 rounded-3xl p-6">
          <form onSubmit={handleSubmitTicket} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-slate-500 font-medium">Assunto do Pedido</label>
              <input
                type="text"
                placeholder="Ex: Dificuldade no carregamento de lição"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none transition-colors"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs text-slate-500 font-medium">Mensagem Detalhada</label>
              <textarea
                placeholder="Descreva detalhadamente o seu problema..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full h-36 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none transition-colors"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10 cursor-pointer"
            >
              <Send className="h-4 w-4" />
              {isSending ? "A enviar..." : "Enviar Pedido"}
            </button>
          </form>
        </div>

        {/* Right Info Box */}
        <div className="border border-slate-900 bg-[#070b13] rounded-3xl p-6 space-y-4 text-xs text-slate-450 leading-relaxed">
          <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4 text-indigo-400" />
            Canais de Atendimento
          </h3>
          <p>
            O nosso horário de atendimento técnico é de Segunda a Sexta-feira, das 09:00 às 18:00 (Hora de Lisboa / GMT).
          </p>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-900 flex items-start gap-3">
            <ShieldAlert className="h-4 w-4 text-indigo-400 mt-0.5 flex-shrink-0" />
            <span>
              Para urgências sobre mensalidades ou acessos, recomendamos contactar também via grupo exclusivo do Telegram.
            </span>
          </div>
        </div>
      </div>

      {/* Histórico de Pedidos */}
      <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-4">
        <h3 className="font-bold text-base text-white flex items-center gap-2">
          <MessageSquare className="h-4.5 w-4.5 text-indigo-400" />
          Histórico de Pedidos
        </h3>
        
        {loadingTickets ? (
          <div className="flex items-center gap-2 text-slate-500 py-4">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
            <span>A carregar histórico...</span>
          </div>
        ) : tickets.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-2">
            Não submeteu nenhum pedido de suporte até ao momento.
          </p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {tickets.map((ticket) => (
              <div key={ticket._id} className="p-4 rounded-2xl border border-slate-900 bg-[#070b13]/60 flex flex-col justify-between gap-3 hover:border-slate-800 transition-colors">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-white truncate max-w-[200px]" title={ticket.subject}>
                      {ticket.subject}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                      ticket.status === "Pendente" 
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}>
                      {ticket.status === "Pendente" ? <Clock className="h-2.5 w-2.5" /> : <CheckCircle className="h-2.5 w-2.5" />}
                      {ticket.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3" title={ticket.message}>
                    {ticket.message}
                  </p>

                  {/* Exibir resposta se houver */}
                  {ticket.replyMessage && (
                    <div className="mt-3.5 p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/10 space-y-1">
                      <span className="text-[10px] font-bold text-indigo-400 block">Resposta de {ticket.replierName || "Suporte Técnico"}:</span>
                      <p className="text-xs text-slate-350 leading-relaxed whitespace-pre-wrap">{ticket.replyMessage}</p>
                      {ticket.repliedAt && (
                        <span className="text-[9px] text-slate-500 block text-right">{new Date(ticket.repliedAt).toLocaleDateString("pt-PT")}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 border-t border-slate-900/60 pt-2 flex items-center justify-between">
                  <span>ID: {ticket._id.substring(ticket._id.length - 8)}</span>
                  <span>{new Date(ticket.createdAt).toLocaleDateString("pt-PT")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
