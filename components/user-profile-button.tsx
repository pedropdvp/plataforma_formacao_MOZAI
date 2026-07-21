"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { User, Key, Smartphone, LogOut, ChevronUp, AlertTriangle } from "lucide-react";
import { useClerk } from "@clerk/nextjs";
import { useAccess } from "@/hooks/use-access";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/components/ui/toast-provider";

export default function UserProfileButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { signOut } = useClerk();
  const { userName, userEmail } = useAccess();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const displayName = userName || "Utilizador MOZAI";
  const displayEmail = userEmail || "email@mozai.education";

  const nameParts = displayName.trim().split(" ");
  const initials = nameParts.length >= 2 
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
    : displayName.substring(0, 2).toUpperCase();

  // Fechar o menu ao clicar fora dele
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Bloquear scroll do body quando o modal está aberto
  useEffect(() => {
    if (showLogoutModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [showLogoutModal]);

  const handleInstallApp = () => {
    showToast("A iniciar a instalação da aplicação MOZAI no ecrã inicial...", "info");
    setIsOpen(false);
  };

  const handleChangePassword = () => {
    showToast("A redirecionar para a página de alteração de password do Clerk...", "info");
    setIsOpen(false);
  };

  const handleSignOut = () => {
    setIsOpen(false);
    setShowLogoutModal(true);
  };

  const confirmSignOut = async () => {
    setIsLoggingOut(true);
    await signOut();
  };

  const cancelSignOut = () => {
    setShowLogoutModal(false);
  };

  return (
    <>
      <div className="relative w-full" ref={menuRef}>
        {/* Popover Menu (Aparece acima do botão) */}
        {isOpen && (
          <div className="absolute bottom-full left-0 w-full mb-2 bg-[#0c1224] border border-slate-900 rounded-2xl shadow-2xl p-2.5 space-y-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <Link
              href="/dashboard/personal/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-900 hover:text-white transition-colors"
            >
              <User className="h-4 w-4 text-indigo-400" />
              {t("nav_account", "A minha conta")}
            </Link>
            
            <button
              onClick={handleChangePassword}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-900 hover:text-white transition-colors text-left cursor-pointer"
            >
              <Key className="h-4 w-4 text-cyan-400" />
              {t("nav_password", "Alterar password")}
            </button>

            <button
              onClick={handleInstallApp}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-900 hover:text-white transition-colors text-left cursor-pointer"
            >
              <Smartphone className="h-4 w-4 text-indigo-400" />
              {t("nav_install_app", "Instalar App")}
            </button>

            <div className="border-t border-slate-900/60 my-1.5" />

            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors text-left cursor-pointer"
            >
              <LogOut className="h-4 w-4 text-rose-500" />
              {t("nav_logout", "Sair")}
            </button>
          </div>
        )}

        {/* Main Profile Trigger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-900 hover:border-slate-800 hover:bg-slate-950/60 transition-all text-left cursor-pointer select-none group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs flex-shrink-0 font-mono">
              {initials}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors truncate" title={displayName}>
                {displayName}
              </span>
              <span className="text-[9px] text-slate-500 truncate" title={displayEmail}>
                {displayEmail}
              </span>
            </div>
          </div>
          <ChevronUp className={`h-4 w-4 text-slate-500 group-hover:text-slate-350 transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`} />
        </button>
      </div>

      {/* ── Modal de Confirmação de Logout ── */}
      {showLogoutModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ animation: "fadeIn 200ms ease-out" }}
        >
          {/* Backdrop escuro */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={cancelSignOut}
          />

          {/* Card do modal */}
          <div
            className="relative w-full max-w-sm rounded-2xl border border-slate-800/80 bg-[#0a0f1e]/95 backdrop-blur-xl shadow-2xl"
            style={{ animation: "scaleIn 250ms cubic-bezier(0.16,1,0.3,1)" }}
          >
            {/* Glow decorativo superior */}
            <div className="absolute -top-px left-1/2 -translate-x-1/2 w-2/3 h-px bg-gradient-to-r from-transparent via-rose-500/60 to-transparent" />

            <div className="p-6 text-center">
              {/* Ícone */}
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <LogOut className="h-7 w-7 text-rose-400" />
              </div>

              {/* Título */}
              <h3 className="text-base font-bold text-white mb-1.5">
                {t("logout_title", "Terminar sessão")}
              </h3>

              {/* Descrição */}
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                {t("logout_message", "Deseja mesmo sair da sua conta? Terá de iniciar sessão novamente para aceder à plataforma.")}
              </p>

              {/* Botões */}
              <div className="flex gap-3">
                <button
                  onClick={cancelSignOut}
                  disabled={isLoggingOut}
                  className="flex-1 rounded-xl border border-slate-700/60 bg-slate-800/50 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-700/50 hover:text-white hover:border-slate-600 cursor-pointer disabled:opacity-50"
                >
                  {t("logout_cancel", "Cancelar")}
                </button>
                <button
                  onClick={confirmSignOut}
                  disabled={isLoggingOut}
                  className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-rose-500 hover:shadow-lg hover:shadow-rose-500/25 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoggingOut ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {t("logout_loading", "A sair...")}
                    </>
                  ) : (
                    t("logout_confirm", "Sim, sair")
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Animações do modal */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </>
  );
}
