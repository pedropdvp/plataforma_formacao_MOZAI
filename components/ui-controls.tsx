"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sun, Moon, Globe, ChevronDown, LogOut } from "lucide-react";
import { useClerk } from "@clerk/nextjs";
import { useTheme } from "@/components/theme-provider";
import { useLanguage } from "@/hooks/use-language";

export default function UIControls() {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { signOut } = useClerk();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Bloquear scroll do body quando o modal de logout está aberto
  useEffect(() => {
    if (showLogoutModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [showLogoutModal]);

  const handleSignOut = () => setShowLogoutModal(true);
  const cancelSignOut = () => setShowLogoutModal(false);
  const confirmSignOut = async () => {
    setIsLoggingOut(true);
    await signOut();
  };

  return (
    <div className="flex items-center gap-3">
      {/* Botão Tema */}
      <button
        onClick={toggleTheme}
        className="h-9 w-9 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
        title={theme === "dark" ? "Alternar para Modo Claro" : "Alternar para Modo Escuro"}
      >
        {theme === "dark" ? <Sun className="h-4.5 w-4.5 text-amber-400" /> : <Moon className="h-4.5 w-4.5 text-indigo-600" />}
      </button>

      {/* Dropdown Idioma */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="h-9 px-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer min-w-[76px] justify-between"
        >
          <div className="flex items-center gap-1.5">
            <Globe className="h-4 w-4 text-indigo-400" />
            <span>{language}</span>
          </div>
          <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-28 rounded-xl border border-slate-800 bg-slate-950 p-1.5 shadow-2xl z-50 animate-in fade-in slide-in-from-top-1 duration-150">
            {(["PT", "EN", "FR"] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => {
                  setLanguage(lang);
                  setDropdownOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-between ${
                  language === lang
                    ? "bg-indigo-600/10 text-indigo-400 font-bold"
                    : "text-slate-400 hover:bg-slate-900 hover:text-white"
                }`}
              >
                <span>{lang === "PT" ? "Português" : lang === "EN" ? "English" : "Français"}</span>
                <span className="text-[10px] text-slate-500">{lang}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Botão Sair — mesma funcionalidade exata do botão "Sair" no menu do utilizador (canto inferior esquerdo) */}
      <button
        onClick={handleSignOut}
        className="h-9 px-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-rose-500/10 hover:border-rose-500/30 flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
        title={t("nav_logout", "Sair")}
      >
        <LogOut className="h-4 w-4" />
        {t("nav_logout", "Sair")}
      </button>

      {/* ── Modal de Confirmação de Logout ── */}
      {showLogoutModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ animation: "fadeIn 200ms ease-out" }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={cancelSignOut} />

          <div
            className="relative w-full max-w-sm rounded-2xl border border-slate-800/80 bg-[#0a0f1e]/95 backdrop-blur-xl shadow-2xl"
            style={{ animation: "scaleIn 250ms cubic-bezier(0.16,1,0.3,1)" }}
          >
            <div className="absolute -top-px left-1/2 -translate-x-1/2 w-2/3 h-px bg-gradient-to-r from-transparent via-rose-500/60 to-transparent" />

            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <LogOut className="h-7 w-7 text-rose-400" />
              </div>

              <h3 className="text-base font-bold text-white mb-1.5">
                {t("logout_title", "Terminar sessão")}
              </h3>

              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                {t("logout_message", "Deseja mesmo sair da sua conta? Terá de iniciar sessão novamente para aceder à plataforma.")}
              </p>

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
    </div>
  );
}
