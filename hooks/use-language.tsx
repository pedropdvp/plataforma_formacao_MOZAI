"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "PT" | "EN" | "FR";

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, defaultText: string) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

const DICTIONARY: Record<Language, Record<string, string>> = {
  PT: {}, // Padrão
  EN: {
    // Cabeçalho / Geral
    "workspace_title": "Workspace",
    "profile_label": "Profile",
    "change_profile": "Change Profile",
    "alpha_version": "Alpha Version V1.0",
    "theme_light": "Light Mode",
    "theme_dark": "Dark Mode",

    // Rótulos do Menu Lateral
    "nav_dashboard": "Home / Dashboard",
    "nav_learning_group": "Learning",
    "nav_progress": "My Progress",
    "nav_history": "My History",
    "nav_courses": "My Courses",
    "nav_catalog": "Catalog",
    "nav_certificates": "Certificates",
    "nav_diplomas": "My Diplomas",
    "nav_comm_group": "Communication",
    "nav_rooms": "Training Rooms",
    "nav_telegram": "Telegram AI",
    "nav_forum": "Discussion Forum",
    "nav_community": "Community",
    "nav_notifications": "Notifications",
    "nav_financial_group": "Financial",
    "nav_subscription": "Subscription",
    "nav_payments": "Payment History",
    "nav_personal_group": "Personal",
    "nav_credits": "AI Credits",
    "nav_account": "My Account",
    "nav_password": "Change Password",
    "nav_workspace_group": "Workspace",
    "nav_config_company": "Configure Company",
    "nav_hr_console": "HR Console B2B",
    "nav_content_factory": "Create AI Content",
    "nav_coding_lab": "Coding Challenges",
    "nav_gamification": "Gamification",
    "nav_live_classes": "Live Classes",
    "nav_marketing": "Marketing Agency",
    "nav_academy": "Mozai Academy",
    "nav_avatar": "Avatar Training",
    "nav_career": "Career & Mentoring",
    "nav_support": "Technical Support",
    "nav_guides_group": "Manuals & Guides",
    "nav_student_guide": "Student Guide",
    "nav_user_guide": "User Manual",
    "nav_logout": "Sign Out",
  },
  FR: {
    // Cabeçalho / Geral
    "workspace_title": "Espace de Travail",
    "profile_label": "Profil",
    "change_profile": "Changer de Profil",
    "alpha_version": "Version Alpha V1.0",
    "theme_light": "Mode Clair",
    "theme_dark": "Mode Sombre",

    // Rótulos do Menu Lateral
    "nav_dashboard": "Accueil / Tableau de bord",
    "nav_learning_group": "Apprentissage",
    "nav_progress": "Mon Progrès",
    "nav_history": "Mon Historique",
    "nav_courses": "Mes Cours",
    "nav_catalog": "Catalogue",
    "nav_certificates": "Certificats",
    "nav_diplomas": "Mes Diplômes",
    "nav_comm_group": "Communication",
    "nav_rooms": "Salles d'Entraînement",
    "nav_telegram": "Telegram IA",
    "nav_forum": "Forum de Discussion",
    "nav_community": "Communauté",
    "nav_notifications": "Notifications",
    "nav_financial_group": "Financier",
    "nav_subscription": "Abonnement",
    "nav_payments": "Historique des Paiements",
    "nav_personal_group": "Personnel",
    "nav_credits": "Crédits IA",
    "nav_account": "Mon Compte",
    "nav_password": "Changer le Mot de Passe",
    "nav_workspace_group": "Espace de Travail",
    "nav_config_company": "Configurer l'Entreprise",
    "nav_hr_console": "Console RH B2B",
    "nav_content_factory": "Créer du Contenu IA",
    "nav_coding_lab": "Défis de Code",
    "nav_gamification": "Gamification",
    "nav_live_classes": "Cours en Direct",
    "nav_marketing": "Agence Marketing",
    "nav_academy": "Académie Mozai",
    "nav_avatar": "Entraînement d'Avatar",
    "nav_career": "Carrière & Mentorat",
    "nav_support": "Support Technique",
    "nav_guides_group": "Manuels & Guides",
    "nav_student_guide": "Guide de l'Étudiant",
    "nav_user_guide": "Manuel de l'Utilisateur",
    "nav_logout": "Se Déconnecter",
  }
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("PT");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("language") as Language;
    if (saved && (saved === "PT" || saved === "EN" || saved === "FR")) {
      setLanguageState(saved);
    }
    setIsMounted(true);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("language", lang);
    document.cookie = `language=${lang}; path=/; max-age=31536000`;
  };

  const t = (key: string, defaultText: string): string => {
    if (!isMounted) return defaultText;
    const translation = DICTIONARY[language]?.[key];
    return translation !== undefined ? translation : defaultText;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage tem de ser utilizado dentro de um LanguageProvider");
  }
  return context;
}
