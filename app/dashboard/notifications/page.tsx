"use client";

import { useToast } from "@/components/ui/toast-provider";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Award, MessageSquare, AlertCircle, Video, Loader2 } from "lucide-react";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Agora mesmo";
  if (minutes < 60) return `Há ${minutes} minuto${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Há ${hours} hora${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Ontem";
  return `Há ${days} dias`;
}

function iconFor(type: string) {
  switch (type) {
    case "achievement":
      return { Icon: Award, cls: "bg-amber-500/10 border-amber-500/20 text-amber-400" };
    case "forum":
      return { Icon: MessageSquare, cls: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" };
    case "live_class_reservation":
      return { Icon: Video, cls: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" };
    default:
      return { Icon: AlertCircle, cls: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400" };
  }
}

export default function NotificationsPage() {
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = () => {
    setLoading(true);
    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => setNotifications(data.notifications || []))
      .catch(() => showToast("Erro ao carregar notificações.", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await fetch("/api/notifications", { method: "PATCH" });
    } catch {
      showToast("Erro ao marcar notificações como lidas.", "error");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
            <Bell className="h-7 w-7 text-indigo-400" />
            Notificações
          </h1>
          <p className="text-sm text-slate-400">
            As tuas notificações e alertas reais da plataforma.
          </p>
        </div>

        {notifications.some((n) => !n.isRead) && (
          <button
            onClick={handleMarkAllRead}
            className="h-10 px-4 rounded-xl bg-slate-950 border border-slate-900 text-xs font-semibold text-slate-400 hover:text-white hover:border-slate-800 transition-colors cursor-pointer"
          >
            Marcar como lidas
          </button>
        )}
      </div>

      <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center text-slate-500 text-xs py-8">
            Sem notificações de momento.
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => {
              const { Icon, cls } = iconFor(notif.type);
              const content = (
                <div
                  className={`p-4 rounded-2xl border flex items-start gap-4 transition-all ${
                    notif.isRead
                      ? "bg-[#070b13]/40 border-slate-900/60 text-slate-400"
                      : "bg-[#070b13] border-indigo-500/10 text-slate-200 shadow-lg"
                  }`}
                >
                  <div className={`p-2.5 rounded-xl border flex-shrink-0 mt-0.5 ${cls}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className={`text-xs font-bold ${notif.isRead ? "text-slate-400" : "text-white"}`}>
                        {notif.title}
                      </h4>
                      <span className="text-[9px] text-slate-600 font-mono whitespace-nowrap">{formatRelativeTime(notif.createdAt)}</span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-400 max-w-2xl">{notif.body}</p>
                  </div>
                </div>
              );
              return notif.link ? (
                <Link key={notif.id} href={notif.link} className="block">
                  {content}
                </Link>
              ) : (
                <div key={notif.id}>{content}</div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
