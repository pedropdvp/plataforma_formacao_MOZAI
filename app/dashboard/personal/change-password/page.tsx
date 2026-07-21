"use client";

import { useToast } from "@/components/ui/toast-provider";

import React, { useState } from "react";
import { Key, ShieldCheck, ArrowLeft, Send } from "lucide-react";
import Link from "next/link";

export default function ChangePasswordPage() {
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast("A nova password e a confirmação não coincidem.", "warning");
      return;
    }

    setIsUpdating(true);
    setTimeout(() => {
      setIsUpdating(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("A password foi alterada com sucesso via Clerk Security.", "success");
    }, 1200);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <Key className="h-7 w-7 text-indigo-400" />
          Alterar Password
        </h1>
        <p className="text-sm text-slate-400">
          Atualize a sua palavra-passe de segurança para proteger a sua conta de estudante.
        </p>
      </div>

      <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 max-w-md space-y-6">
        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-slate-500 font-medium">Password Atual</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none transition-colors"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-500 font-medium">Nova Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none transition-colors"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-500 font-medium">Confirmar Nova Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none transition-colors"
              required
            />
          </div>

          <div className="pt-2 flex items-center justify-between gap-4">
            <Link
              href="/dashboard/personal/profile"
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Cancelar
            </Link>

            <button
              type="submit"
              disabled={isUpdating}
              className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10 cursor-pointer"
            >
              <Send className="h-4 w-4" />
              {isUpdating ? "A guardar..." : "Alterar Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
