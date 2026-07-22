"use client";

import { useToast } from "@/components/ui/toast-provider";

import React, { useState } from "react";
import { Bell, BellRing, CheckCheck, Award, MessageSquare, AlertCircle } from "lucide-react";

interface NotificationItem {
  id: string;
  type: "achievement" | "forum" | "alert";
  title: string;
  body: string;
  time: string;
  isRead: boolean;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-1",
    type: "achievement",
    title: "Parabéns!",
    body: "Pedro Varela Pinto: Subiu para o nível 2 - Parabéns",
    time: "Há 10 minutos",
    isRead: false,
  },
  {
    id: "notif-2",
    type: "forum",
    title: "Nova resposta no Fórum",
    body: "O formador Dr. Valter Silva respondeu à sua dúvida sobre embeddings na aula 1.3.",
    time: "Há 2 horas",
    isRead: false,
  },
  {
    id: "notif-3",
    type: "alert",
    title: "Atualização de Curso",
    body: "Nova lição adicionada no curso Engenharia de IA e RAG Avançado: 'Orquestração com LangGraph'.",
    time: "Ontem",
    isRead: true,
  },
];

export default function NotificationsPage() {
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [activeMode, setActiveMode] = useState(false);

  const handleToggleNotifications = () => {
    setActiveMode((prev) => !prev);
    showToast(activeMode ? "Notificações do sistema desativadas." : "Notificações ativadas! Receberá alertas em tempo real.", "success");
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
            <Bell className="h-7 w-7 text-indigo-400" />
            Notificações
          </h1>
          <p className="text-sm text-slate-400">
            As tuas notificações e alertas.
          </p>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleNotifications}
            className={`h-10 px-5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeMode
                ? "bg-emerald-600 text-white"
                : "bg-slate-900 hover:bg-slate-800 text-indigo-400"
            }`}
          >
            <BellRing className="h-4 w-4" />
            {activeMode ? "Notificações Ativas" : "Activar notificações"}
          </button>

          {notifications.some((n) => !n.isRead) && (
            <button
              onClick={handleMarkAllRead}
              className="h-10 px-4 rounded-xl bg-slate-950 border border-slate-900 text-xs font-semibold text-slate-400 hover:text-white hover:border-slate-800 transition-colors"
            >
              Marcar como lidas
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-4">
        {notifications.length === 0 ? (
          <div className="text-center text-slate-500 text-xs py-8">
            Sem notificações de momento.
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-4 rounded-2xl border flex items-start gap-4 transition-all ${
                  notif.isRead
                    ? "bg-[#070b13]/40 border-slate-900/60 text-slate-400"
                    : "bg-[#070b13] border-indigo-500/10 text-slate-200 shadow-lg"
                }`}
              >
                {/* Icon wrapper based on notification type */}
                <div className={`p-2.5 rounded-xl border flex-shrink-0 mt-0.5 ${
                  notif.type === "achievement"
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                    : notif.type === "forum"
                    ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                    : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
                }`}>
                  {notif.type === "achievement" && <Award className="h-4.5 w-4.5" />}
                  {notif.type === "forum" && <MessageSquare className="h-4.5 w-4.5" />}
                  {notif.type === "alert" && <AlertCircle className="h-4.5 w-4.5" />}
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className={`text-xs font-bold ${notif.isRead ? "text-slate-400" : "text-white"}`}>
                      {notif.title}
                    </h4>
                    <span className="text-[9px] text-slate-600 font-mono whitespace-nowrap">{notif.time}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-400 max-w-2xl">{notif.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
