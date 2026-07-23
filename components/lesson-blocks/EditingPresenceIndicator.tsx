"use client";

import React, { useEffect, useState } from "react";
import { Users } from "lucide-react";

const HEARTBEAT_MS = 8000;

/**
 * Indicador informativo "quem mais está a editar esta lição agora" — sem bloqueio
 * de edição nem resolução de conflitos, apenas um aviso (polling sobre MongoDB,
 * mesmo padrão já usado no passo GERAÇÃO do wizard e no upload de vídeo Mux).
 */
export function EditingPresenceIndicator({ courseId, lessonKey }: { courseId: string; lessonKey: string }) {
  const [editors, setEditors] = useState<{ userId: string; userName: string }[]>([]);

  useEffect(() => {
    if (!courseId || !lessonKey) return;
    let cancelled = false;

    const heartbeat = () => {
      fetch("/api/admin/courses/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, lessonKey }),
      }).catch(() => {});
    };

    const poll = async () => {
      try {
        const res = await fetch(`/api/admin/courses/presence?courseId=${encodeURIComponent(courseId)}&lessonKey=${encodeURIComponent(lessonKey)}`);
        const data = await res.json();
        if (!cancelled && res.ok) setEditors(data.editors || []);
      } catch {
        // silencioso — indicador puramente informativo
      }
    };

    heartbeat();
    poll();
    const interval = setInterval(() => {
      heartbeat();
      poll();
    }, HEARTBEAT_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [courseId, lessonKey]);

  if (editors.length === 0) return null;

  const names = editors.map((e) => e.userName).join(", ");

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-300 w-fit">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
      </span>
      <Users className="h-3 w-3" />
      Também a editar agora: {names}
    </div>
  );
}
