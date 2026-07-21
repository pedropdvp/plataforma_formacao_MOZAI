"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0" />,
  error: <XCircle className="h-5 w-5 text-rose-400 flex-shrink-0" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />,
  info: <Info className="h-5 w-5 text-sky-400 flex-shrink-0" />,
};

const BORDER_COLORS: Record<ToastType, string> = {
  success: "border-emerald-500/30",
  error: "border-rose-500/30",
  warning: "border-amber-500/30",
  info: "border-sky-500/30",
};

const GLOW_COLORS: Record<ToastType, string> = {
  success: "via-emerald-500/50",
  error: "via-rose-500/50",
  warning: "via-amber-500/50",
  info: "via-sky-500/50",
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: number) => void }) {
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, toast.duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [toast.id, toast.duration, onRemove]);

  const handleDismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  return (
    <div
      className={`relative flex items-start gap-3 w-full max-w-sm px-4 py-3.5 rounded-xl border ${BORDER_COLORS[toast.type]} bg-[#0a0f1e]/95 backdrop-blur-xl shadow-2xl transition-all duration-300 ${
        isExiting ? "opacity-0 translate-x-8 scale-95" : "opacity-100 translate-x-0 scale-100"
      }`}
      style={{ animation: isExiting ? undefined : "toastSlideIn 350ms cubic-bezier(0.16,1,0.3,1)" }}
    >
      {/* Glow decorativo superior */}
      <div className={`absolute -top-px left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent ${GLOW_COLORS[toast.type]} to-transparent`} />
      
      {ICONS[toast.type]}
      <p className="text-sm text-slate-200 leading-relaxed flex-1 pr-1">{toast.message}</p>
      <button
        onClick={handleDismiss}
        className="text-slate-500 hover:text-white transition-colors flex-shrink-0 cursor-pointer mt-0.5"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idCounter = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = "info", duration = 4000) => {
    const id = ++idCounter.current;
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Container de toasts — canto inferior direito */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[9998] flex flex-col-reverse gap-3 items-end pointer-events-none">
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem toast={toast} onRemove={removeToast} />
            </div>
          ))}
        </div>
      )}

      <style jsx global>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(24px) scale(0.92); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
