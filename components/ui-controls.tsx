"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sun, Moon, Globe, ChevronDown } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useLanguage } from "@/hooks/use-language";

export default function UIControls() {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const [dropdownOpen, setDropdownOpen] = useState(false);
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
    </div>
  );
}
