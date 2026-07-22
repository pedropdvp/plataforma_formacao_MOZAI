"use client";

import React, { createContext, useContext, useCallback, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType>({
  confirm: async () => false,
});

export function useConfirm() {
  return useContext(ConfirmContext).confirm;
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const normalized: ConfirmOptions = typeof options === "string" ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setPending({ ...normalized, resolve });
    });
  }, []);

  const handleAnswer = (value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {pending && (
        <div className="fixed inset-0 z-[9999] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm border border-slate-850 bg-slate-950 rounded-3xl p-6 shadow-2xl space-y-4 no-3d-effect">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${pending.destructive ? "bg-rose-500/10 text-rose-400" : "bg-indigo-500/10 text-indigo-400"}`}>
                <AlertTriangle className="h-4.5 w-4.5" />
              </div>
              <h3 className="font-extrabold text-white text-sm">{pending.title || "Confirmação"}</h3>
            </div>

            <p className="text-xs text-slate-350 leading-relaxed">{pending.message}</p>

            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => handleAnswer(false)}
                className="flex-1 h-10 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                {pending.cancelLabel || "Cancelar"}
              </button>
              <button
                onClick={() => handleAnswer(true)}
                className={`flex-1 h-10 rounded-xl font-semibold text-xs transition-colors cursor-pointer text-white ${
                  pending.destructive ? "bg-rose-600 hover:bg-rose-500" : "bg-indigo-600 hover:bg-indigo-500"
                }`}
              >
                {pending.confirmLabel || "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
