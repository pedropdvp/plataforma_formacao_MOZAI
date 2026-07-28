"use client";

import React, { useState, useEffect, useLayoutEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SecureRender from "@/components/secure-render";
import { useLanguage } from "@/hooks/use-language";
import { useAccess } from "@/hooks/use-access";
import { MENU_ITEMS } from "@/lib/menu-registry";
import {
  Home,
  Library,
  RefreshCw,
  Award,
  CreditCard,
  Megaphone,
  Bot,
  MessageSquare,
  Video,
  Bell,
  Users,
  Receipt,
  Clock,
  LifeBuoy,
  BookOpen,
  Terminal,
  Brain,
  Settings,
  ChevronDown,
  ChevronRight,
  Compass,
  Trophy,
  User,
  GraduationCap,
  Key,
  FileText,
  Building,
  Activity,
  Briefcase,
  ShieldCheck,
  Database,
  Store,
  SlidersHorizontal,
  UserCog,
  Layers
} from "lucide-react";

// Estado dos agrupadores da sidebar (aberto/fechado) persistido no browser, para que uma
// recarga da página (reload do Next.js em dev, refresh manual, etc.) não force os menus
// recolhidos pelo utilizador a reabrirem sozinhos.
const SIDEBAR_GROUPS_STORAGE_KEY = "mozai-sidebar-groups";

function loadStoredGroupState(): Record<string, boolean> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SIDEBAR_GROUPS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function SidebarNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { activeRole, hasPermission } = useAccess();

  // Estados dos agrupadores — iniciam SEMPRE expandidos (igual ao servidor) para evitar
  // erros de hidratação; o valor guardado em localStorage só é aplicado depois da
  // montagem no cliente (ver useLayoutEffect abaixo), nunca durante o render inicial.
  const [aprendizagemOpen, setAprendizagemOpen] = useState(true);
  const [comunicacaoOpen, setComunicacaoOpen] = useState(true);
  const [financeiroOpen, setFinanceiroOpen] = useState(true);
  const [pessoalOpen, setPessoalOpen] = useState(true);
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const [guiasOpen, setGuiasOpen] = useState(true);
  const [relatoriosOpen, setRelatoriosOpen] = useState(true);
  const [administracaoOpen, setAdministracaoOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // Aplica o estado guardado assim que o componente monta no cliente (antes do
  // browser pintar), para minimizar o "flash" de grupos que estavam recolhidos.
  useLayoutEffect(() => {
    const stored = loadStoredGroupState();
    if (stored) {
      if (typeof stored.aprendizagem === "boolean") setAprendizagemOpen(stored.aprendizagem);
      if (typeof stored.comunicacao === "boolean") setComunicacaoOpen(stored.comunicacao);
      if (typeof stored.financeiro === "boolean") setFinanceiroOpen(stored.financeiro);
      if (typeof stored.pessoal === "boolean") setPessoalOpen(stored.pessoal);
      if (typeof stored.workspace === "boolean") setWorkspaceOpen(stored.workspace);
      if (typeof stored.guias === "boolean") setGuiasOpen(stored.guias);
      if (typeof stored.relatorios === "boolean") setRelatoriosOpen(stored.relatorios);
      if (typeof stored.administracao === "boolean") setAdministracaoOpen(stored.administracao);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guarda o estado sempre que um agrupador é aberto/fechado (nunca no primeiro
  // render, para não reescrever o valor guardado com os defaults antes de o ler)
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        SIDEBAR_GROUPS_STORAGE_KEY,
        JSON.stringify({
          aprendizagem: aprendizagemOpen,
          comunicacao: comunicacaoOpen,
          financeiro: financeiroOpen,
          pessoal: pessoalOpen,
          workspace: workspaceOpen,
          guias: guiasOpen,
          relatorios: relatoriosOpen,
          administracao: administracaoOpen,
        })
      );
    } catch {
      // localStorage indisponível (modo privado, quota excedida, etc.) — ignora silenciosamente
    }
  }, [
    aprendizagemOpen,
    comunicacaoOpen,
    financeiroOpen,
    pessoalOpen,
    workspaceOpen,
    guiasOpen,
    relatoriosOpen,
    administracaoOpen,
    hydrated,
  ]);

  // Ids de menus ocultos para o tenant ativo (definidos pelo Admin em Configurações > Menus)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/menu-visibility")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.hiddenIds) setHiddenIds(new Set<string>(data.hiddenIds));
      })
      .catch(() => {});
  }, []);

  const isItemVisible = (id: string) => !hiddenIds.has(id);
  const isGroupVisible = (groupId: string) =>
    MENU_ITEMS.filter((item) => item.groupId === groupId).some((item) => !hiddenIds.has(item.id));

  // Helper para verificar se a rota está ativa
  const isActive = (path: string) => pathname === path;

  // Active status of each group
  const isAprendizagemActive = [
    "/dashboard/catalog",
    "/dashboard/marketplace",
    "/dashboard/challenges",
    "/dashboard/gamification",
    "/dashboard/mozai-academy",
    "/dashboard/personal/progress",
    "/dashboard/avatar-training",
    "/dashboard/my-courses"
  ].some(path => pathname === path || pathname.startsWith(path + "/")) || pathname === "/dashboard";

  const isComunicacaoActive = [
    "/dashboard/live-classes",
    "/dashboard/community",
    "/dashboard/forum",
    "/dashboard/notifications",
    "/dashboard/training-rooms",
    "/dashboard/personal/telegram-ia"
  ].some(path => pathname === path || pathname.startsWith(path + "/"));

  const isFinanceiroActive = [
    "/dashboard/financial/subscriptions",
    "/dashboard/financial/payments"
  ].some(path => pathname === path || pathname.startsWith(path + "/"));

  const isPessoalActive = [
    "/dashboard/personal/profile",
    "/dashboard/personal/change-password",
    "/dashboard/professional-card",
    "/dashboard/certificates",
    "/dashboard/personal/ai-credits",
    "/dashboard/recycling",
    "/dashboard/diplomas"
  ].some(path => pathname === path || pathname.startsWith(path + "/"));

  const isWorkspaceActive = [
    "/dashboard/marketing-agency",
    "/dashboard/admin/auto-update",
    "/dashboard/skills/coding-lab",
    "/dashboard/admin",
    "/dashboard/admin/content-factory",
    "/dashboard/admin/hr",
    "/dashboard/career",
    "/dashboard/skills"
  ].some(path => pathname === path || pathname.startsWith(path + "/"));

  const isSuporteActive = [
    "/dashboard/user-guide",
    "/dashboard/personal/student-guide",
    "/dashboard/personal/support"
  ].some(path => pathname === path || pathname.startsWith(path + "/"));

  const isRelatoriosActive = [
    "/dashboard/reports/students",
    "/dashboard/reports/audit",
    "/dashboard/reports/companies",
    "/dashboard/reports/employees",
    "/dashboard/reports/teachers",
    "/dashboard/personal/history"
  ].some(path => pathname === path || pathname.startsWith(path + "/"));

  const isAdministracaoActive = [
    "/dashboard/admin/backups",
    "/dashboard/admin/api-keys",
    "/dashboard/admin/chatbot",
    "/dashboard/admin/menus",
    "/dashboard/admin/levels",
    "/dashboard/admin/roles"
  ].some(path => pathname === path || pathname.startsWith(path + "/"));

  const linkClass = (path: string) =>
    `flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
      isActive(path)
        ? "bg-indigo-600/10 border border-indigo-500/20 text-white font-bold"
        : "border border-transparent text-slate-400 hover:bg-slate-900 hover:text-white"
    }`;

  return (
    <nav className="flex-1 overflow-y-auto space-y-5 pr-1 custom-scrollbar min-h-0 select-none">
      {/* Início / Dashboard (Não colapsável no topo) */}
      <div className="space-y-1">
        <Link href="/dashboard" className={linkClass("/dashboard")}>
          <Home className="h-4 w-4 text-indigo-400" />
          {t("nav_dashboard", "Início / Dashboard")}
        </Link>
      </div>

      {/* Agrupador: APRENDIZAGEM */}
      {isGroupVisible("aprendizagem") && (
      <div className={`menu-group-container group-aprendizagem space-y-1.5 rounded-2xl border border-transparent transition-all ${isAprendizagemActive ? "active" : ""}`}>
        <button
          onClick={() => setAprendizagemOpen(!aprendizagemOpen)}
          className="group-header-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-transparent hover:bg-slate-900 transition-all text-left text-[10px] font-bold uppercase tracking-widest cursor-pointer select-none group"
        >
          <div className="flex items-center gap-2.5">
            <GraduationCap className="h-4 w-4 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
            <span>{t("nav_learning_group", "Aprendizagem")}</span>
          </div>
          {aprendizagemOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-350" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-350" />
          )}
        </button>

        {sidebarSection(
          aprendizagemOpen,
          <>
            {isItemVisible("catalog") && (
            <Link href="/dashboard/catalog" className={linkClass("/dashboard/catalog")}>
              <Library className="h-4 w-4 text-violet-400" />
              {t("nav_catalog", "Catálogo")}
            </Link>
            )}
            {isItemVisible("marketplace") && (
            <Link href="/dashboard/marketplace" className={linkClass("/dashboard/marketplace")}>
              <Store className="h-4 w-4 text-violet-400" />
              {t("nav_marketplace", "Marketplace")}
            </Link>
            )}
            {isItemVisible("challenges") && (
            <Link href="/dashboard/challenges" className={linkClass("/dashboard/challenges")}>
              <Terminal className="h-4 w-4 text-cyan-400" />
              {t("nav_coding_lab", "Desafios")}
            </Link>
            )}
            {isItemVisible("gamification") && (
            <Link href="/dashboard/gamification" className={linkClass("/dashboard/gamification")}>
              <Trophy className="h-4 w-4 text-amber-500" />
              {t("nav_gamification", "Gamificação")}
            </Link>
            )}
            {isItemVisible("my-courses") && (
            <Link href="/dashboard/my-courses" className={linkClass("/dashboard/my-courses")}>
              <BookOpen className="h-4 w-4 text-indigo-400" />
              {t("nav_my_courses", "Meus Cursos")}
            </Link>
            )}
            {isItemVisible("mozai-academy") && (
            <Link href="/dashboard/mozai-academy" className={linkClass("/dashboard/mozai-academy")}>
              <Compass className="h-4 w-4 text-indigo-400" />
              {t("nav_academy", "MOZAI Academy")}
            </Link>
            )}
            {isItemVisible("progress") && (
            <Link href="/dashboard/personal/progress" className={linkClass("/dashboard/personal/progress")}>
              <GraduationCap className="h-4 w-4 text-emerald-400" />
              {t("nav_progress", "Progresso")}
            </Link>
            )}
            {isItemVisible("avatar-training") && (
            <Link href="/dashboard/avatar-training" className={linkClass("/dashboard/avatar-training")}>
              <Bot className="h-4 w-4 text-indigo-400" />
              {t("nav_avatar", "Treino com Avatares")}
            </Link>
            )}
          </>
        )}
      </div>
      )}

      {/* Agrupador: COMUNICAÇÃO */}
      {isGroupVisible("comunicacao") && (
      <div className={`menu-group-container group-comunicacao space-y-1.5 rounded-2xl border border-transparent transition-all ${isComunicacaoActive ? "active" : ""}`}>
        <button
          onClick={() => setComunicacaoOpen(!comunicacaoOpen)}
          className="group-header-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-transparent hover:bg-slate-900 transition-all text-left text-[10px] font-bold uppercase tracking-widest cursor-pointer select-none group"
        >
          <div className="flex items-center gap-2.5">
            <MessageSquare className="h-4 w-4 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
            <span>{t("nav_comm_group", "Comunicação")}</span>
          </div>
          {comunicacaoOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-350" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-350" />
          )}
        </button>

        {sidebarSection(
          comunicacaoOpen,
          <>
            {isItemVisible("live-classes") && (
            <Link href="/dashboard/live-classes" className={linkClass("/dashboard/live-classes")}>
              <Video className="h-4 w-4 text-cyan-400" />
              {t("nav_live_classes", "Aulas ao Vivo")}
            </Link>
            )}
            {isItemVisible("community") && (
            <Link href="/dashboard/community" className={linkClass("/dashboard/community")}>
              <Users className="h-4 w-4 text-emerald-400" />
              {t("nav_community", "Comunidade")}
            </Link>
            )}
            {isItemVisible("forum") && (
            <Link href="/dashboard/forum" className={linkClass("/dashboard/forum")}>
              <MessageSquare className="h-4 w-4 text-indigo-400" />
              {t("nav_forum", "Fórum")}
            </Link>
            )}
            {isItemVisible("notifications") && (
            <Link href="/dashboard/notifications" className={linkClass("/dashboard/notifications")}>
              <Bell className="h-4 w-4 text-amber-400" />
              {t("nav_notifications", "Notificações")}
            </Link>
            )}
            {isItemVisible("training-rooms") && (
            <Link href="/dashboard/training-rooms" className={linkClass("/dashboard/training-rooms")}>
              <Users className="h-4 w-4 text-indigo-400" />
              {t("nav_rooms", "Salas de Treino")}
            </Link>
            )}
            {isItemVisible("telegram-ia") && (
            <Link href="/dashboard/personal/telegram-ia" className={linkClass("/dashboard/personal/telegram-ia")}>
              <MessageSquare className="h-4 w-4 text-sky-400" />
              {t("nav_telegram", "Telegram IA")}
            </Link>
            )}
          </>
        )}
      </div>
      )}

      {/* Agrupador: FINANCEIRO */}
      {isGroupVisible("financeiro") && (
      <div className={`menu-group-container group-financeiro space-y-1.5 rounded-2xl border border-transparent transition-all ${isFinanceiroActive ? "active" : ""}`}>
        <button
          onClick={() => setFinanceiroOpen(!financeiroOpen)}
          className="group-header-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-transparent hover:bg-slate-900 transition-all text-left text-[10px] font-bold uppercase tracking-widest cursor-pointer select-none group"
        >
          <div className="flex items-center gap-2.5">
            <CreditCard className="h-4 w-4 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
            <span>{t("nav_financial_group", "Financeiro")}</span>
          </div>
          {financeiroOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-350" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-350" />
          )}
        </button>

        {sidebarSection(
          financeiroOpen,
          <>
            {isItemVisible("subscriptions") && (
            <Link href="/dashboard/financial/subscriptions" className={linkClass("/dashboard/financial/subscriptions")}>
              <CreditCard className="h-4 w-4 text-cyan-400" />
              {t("nav_subscription", "Mensalidades")}
            </Link>
            )}
            {isItemVisible("payments") && (
            <Link href="/dashboard/financial/payments" className={linkClass("/dashboard/financial/payments")}>
              <Receipt className="h-4 w-4 text-indigo-400" />
              {t("nav_payments", "Pagamentos")}
            </Link>
            )}
          </>
        )}
      </div>
      )}

      {/* Agrupador: PESSOAL */}
      {isGroupVisible("pessoal") && (
      <div className={`menu-group-container group-pessoal space-y-1.5 rounded-2xl border border-transparent transition-all ${isPessoalActive ? "active" : ""}`}>
        <button
          onClick={() => setPessoalOpen(!pessoalOpen)}
          className="group-header-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-transparent hover:bg-slate-900 transition-all text-left text-[10px] font-bold uppercase tracking-widest cursor-pointer select-none group"
        >
          <div className="flex items-center gap-2.5">
            <User className="h-4 w-4 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
            <span>{t("nav_personal_group", "Pessoal")}</span>
          </div>
          {pessoalOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-350" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-350" />
          )}
        </button>

        {sidebarSection(
          pessoalOpen,
          <>
            {isItemVisible("account") && (
            <Link href="/dashboard/personal/profile" className={linkClass("/dashboard/personal/profile")}>
              <User className="h-4 w-4 text-indigo-400" />
              {t("nav_account", "A minha Conta")}
            </Link>
            )}
            {isItemVisible("change-password") && (
            <Link href="/dashboard/personal/change-password" className={linkClass("/dashboard/personal/change-password")}>
              <Key className="h-4 w-4 text-cyan-400" />
              {t("nav_password", "Alterar Password")}
            </Link>
            )}
            {isItemVisible("professional-card") && (
            <Link href="/dashboard/professional-card" className={linkClass("/dashboard/professional-card")}>
              <CreditCard className="h-4 w-4 text-indigo-400" />
              {t("nav_prof_card", "Cartão Profissional")}
            </Link>
            )}
            {isItemVisible("certificates") && (
            <SecureRender requiredPermission="CERTIFICATES_VIEW">
              <Link href="/dashboard/certificates" className={linkClass("/dashboard/certificates")}>
                <Award className="h-4 w-4 text-amber-400" />
                {t("nav_certificates", "Certificados")}
              </Link>
            </SecureRender>
            )}
            {isItemVisible("ai-credits") && (
            <Link href="/dashboard/personal/ai-credits" className={linkClass("/dashboard/personal/ai-credits")}>
              <CpuIcon className="h-4 w-4 text-amber-400" />
              {t("nav_credits", "Créditos IA")}
            </Link>
            )}
            {isItemVisible("recycling") && (
            <Link href="/dashboard/recycling" className={linkClass("/dashboard/recycling")}>
              <RefreshCw className="h-4 w-4 text-emerald-400" />
              {t("nav_completed_courses", "Cursos efetuados")}
            </Link>
            )}
            {isItemVisible("diplomas") && (
            <SecureRender requiredPermission="CERTIFICATES_VIEW">
              <Link href="/dashboard/diplomas" className={linkClass("/dashboard/diplomas")}>
                <Award className="h-4 w-4 text-indigo-400" />
                {t("nav_diplomas", "Diplomas")}
              </Link>
            </SecureRender>
            )}
          </>
        )}
      </div>
      )}

      {/* Agrupador: WORKSPACE */}
      {isGroupVisible("workspace") && (
      <div className={`menu-group-container group-workspace space-y-1.5 rounded-2xl border border-transparent transition-all ${isWorkspaceActive ? "active" : ""}`}>
        <button
          onClick={() => setWorkspaceOpen(!workspaceOpen)}
          className="group-header-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-transparent hover:bg-slate-900 transition-all text-left text-[10px] font-bold uppercase tracking-widest cursor-pointer select-none group"
        >
          <div className="flex items-center gap-2.5">
            <Terminal className="h-4 w-4 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
            <span>{t("nav_workspace_group", "Workspace")}</span>
          </div>
          {workspaceOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-350" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-350" />
          )}
        </button>

        {sidebarSection(
          workspaceOpen,
          <>
            {isItemVisible("marketing-agency") && (
            <Link href="/dashboard/marketing-agency" className={linkClass("/dashboard/marketing-agency")}>
              <Megaphone className="h-4 w-4 text-indigo-400" />
              {t("nav_marketing", "Agência de Marketing")}
            </Link>
            )}
            {isItemVisible("auto-update") && (
            <SecureRender requiredPermission="SYSTEM_AUDIT_VIEW">
              <Link href="/dashboard/admin/auto-update" className={linkClass("/dashboard/admin/auto-update")}>
                <Settings className="h-4 w-4 text-rose-400" />
                {t("nav_auto_update", "Atualização Automática (Daily Engine)")}
              </Link>
            </SecureRender>
            )}
            {isItemVisible("coding-lab") && (
            <Link href="/dashboard/skills/coding-lab" className={linkClass("/dashboard/skills/coding-lab")}>
              <Terminal className="h-4 w-4 text-emerald-400" />
              {t("nav_coding_lab", "Coding Lab (Prática)")}
            </Link>
            )}
            {isItemVisible("config-company") && (
            <SecureRender requiredPermission="TENANTS_MANAGE">
              <Link href="/dashboard/admin" className={linkClass("/dashboard/admin")}>
                <Settings className="h-4 w-4 text-slate-400" />
                {t("nav_config_company", "Configurar Empresa")}
              </Link>
            </SecureRender>
            )}
            {isItemVisible("content-factory") && (
            <SecureRender requiredPermission="COURSES_CREATE">
              <Link href="/dashboard/admin/content-factory" className={linkClass("/dashboard/admin/content-factory")}>
                <Settings className="h-4 w-4 text-violet-400" />
                {t("nav_content_factory", "Fábrica de Cursos (IA)")}
              </Link>
            </SecureRender>
            )}
            {isItemVisible("hr-console") && (
            <SecureRender requiredPermission="PAYMENTS_MANAGE">
              <Link href="/dashboard/admin/hr" className={linkClass("/dashboard/admin/hr")}>
                <Settings className="h-4 w-4 text-indigo-400" />
                {t("nav_hr_console", "Gestão de RH")}
              </Link>
            </SecureRender>
            )}
            {isItemVisible("career") && (
            <Link href="/dashboard/career" className={linkClass("/dashboard/career")}>
              <Brain className="h-4 w-4 text-violet-400" />
              {t("nav_career", "Carreira & Mentoria")}
            </Link>
            )}
            {isItemVisible("skills-os") && (
            <Link href="/dashboard/skills" className={linkClass("/dashboard/skills")}>
              <Terminal className="h-4 w-4 text-cyan-400" />
              {t("nav_skills_os", "Skills OS (Grafo de Competências)")}
            </Link>
            )}
          </>
        )}
      </div>
      )}

      {/* Agrupador: SUPORTE */}
      {isGroupVisible("suporte") && (
      <div className={`menu-group-container group-suporte space-y-1.5 rounded-2xl border border-transparent transition-all ${isSuporteActive ? "active" : ""}`}>
        <button
          onClick={() => setGuiasOpen(!guiasOpen)}
          className="group-header-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-transparent hover:bg-slate-900 transition-all text-left text-[10px] font-bold uppercase tracking-widest cursor-pointer select-none group"
        >
          <div className="flex items-center gap-2.5">
            <Compass className="h-4 w-4 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
            <span>{t("nav_guides_group", "Suporte")}</span>
          </div>
          {guiasOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-350" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-350" />
          )}
        </button>

        {sidebarSection(
          guiasOpen,
          <>
            {isItemVisible("user-guide") && (
            <Link href="/dashboard/user-guide" className={linkClass("/dashboard/user-guide")}>
              <Compass className="h-4 w-4 text-slate-400 animate-spin-slow" />
              {t("nav_user_guide", "Guia de Utilização")}
            </Link>
            )}
            {isItemVisible("student-guide") && (
            <Link href="/dashboard/personal/student-guide" className={linkClass("/dashboard/personal/student-guide")}>
              <BookOpen className="h-4 w-4 text-indigo-400" />
              {t("nav_student_guide", "Guia do Formando")}
            </Link>
            )}
            {isItemVisible("support") && (
            <Link href="/dashboard/personal/support" className={linkClass("/dashboard/personal/support")}>
              <LifeBuoy className="h-4 w-4 text-rose-400" />
              {t("nav_support", "Suporte")}
            </Link>
            )}
          </>
        )}
      </div>
      )}

      {/* Agrupador: RELATÓRIOS */}
      {(activeRole === "ADMIN" || activeRole === "SUPORTE" || activeRole === "GESTOR_EMPRESA") && isGroupVisible("relatorios") && (
        <div className={`menu-group-container group-relatorios space-y-1.5 rounded-2xl border border-transparent transition-all ${isRelatoriosActive ? "active" : ""}`}>
          <button
            onClick={() => setRelatoriosOpen(!relatoriosOpen)}
            className="group-header-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-transparent hover:bg-slate-900 transition-all text-left text-[10px] font-bold uppercase tracking-widest cursor-pointer select-none group"
          >
            <div className="flex items-center gap-2.5">
              <FileText className="h-4 w-4 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
              <span>{t("nav_reports_group", "Relatórios")}</span>
            </div>
            {relatoriosOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-350" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-350" />
            )}
          </button>

          {sidebarSection(
            relatoriosOpen,
            <>
              {isItemVisible("rep-students") && (
              <Link href="/dashboard/reports/students" className={linkClass("/dashboard/reports/students")}>
                <GraduationCap className="h-4 w-4 text-violet-400" />
                {t("nav_rep_students", "Alunos")}
              </Link>
              )}
              {isItemVisible("rep-audit") && (activeRole === "ADMIN" || activeRole === "SUPORTE") && (
                <Link href="/dashboard/reports/audit" className={linkClass("/dashboard/reports/audit")}>
                  <Activity className="h-4 w-4 text-rose-400" />
                  {t("nav_rep_audit", "Auditoria")}
                </Link>
              )}
              {isItemVisible("rep-companies") && (
              <Link href="/dashboard/reports/companies" className={linkClass("/dashboard/reports/companies")}>
                <Building className="h-4 w-4 text-indigo-400" />
                {t("nav_rep_companies", "Empresas")}
              </Link>
              )}
              {isItemVisible("rep-employees") && (
              <Link href="/dashboard/reports/employees" className={linkClass("/dashboard/reports/employees")}>
                <Briefcase className="h-4 w-4 text-emerald-400" />
                {t("nav_rep_employees", "Funcionários")}
              </Link>
              )}
              {isItemVisible("history") && (
              <Link href="/dashboard/personal/history" className={linkClass("/dashboard/personal/history")}>
                <Clock className="h-4 w-4 text-cyan-400" />
                {t("nav_history", "Histórico")}
              </Link>
              )}
              {isItemVisible("rep-teachers") && (
              <Link href="/dashboard/reports/teachers" className={linkClass("/dashboard/reports/teachers")}>
                <GraduationCap className="h-4 w-4 text-cyan-400" />
                {t("nav_rep_teachers", "Professores")}
              </Link>
              )}
            </>
          )}
        </div>
      )}

      {/* Agrupador: CONFIGURAÇÃO — Backup & Restore, API's e Menus (submenus ordenados
          alfabeticamente), visível para ADMIN (âmbito toda a plataforma) ou GESTOR_EMPRESA
          (âmbito só a sua empresa, exceto Menus — gestão de visibilidade é exclusiva do Admin);
          cada link tem ainda o seu próprio SecureRender para o caso de os níveis divergirem. */}
      {(hasPermission("BACKUP_MANAGE") || hasPermission("API_KEYS_MANAGE") || hasPermission("CHATBOT_MANAGE") || hasPermission("MENUS_MANAGE") || hasPermission("LEVELS_MANAGE") || hasPermission("ROLES_MANAGE")) && isGroupVisible("configuracao") && (
        <div className={`menu-group-container group-administracao space-y-1.5 rounded-2xl border border-transparent transition-all ${isAdministracaoActive ? "active" : ""}`}>
          <button
            onClick={() => setAdministracaoOpen(!administracaoOpen)}
            className="group-header-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-transparent hover:bg-slate-900 transition-all text-left text-[10px] font-bold uppercase tracking-widest cursor-pointer select-none group"
          >
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-orange-400 group-hover:text-orange-300 transition-colors" />
              <span>{t("nav_administracao_group", "Configurações")}</span>
            </div>
            {administracaoOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-350" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-350" />
            )}
          </button>

          {sidebarSection(
            administracaoOpen,
            <>
              {isItemVisible("api-keys") && (
              <SecureRender requiredPermission="API_KEYS_MANAGE">
                <Link href="/dashboard/admin/api-keys" className={linkClass("/dashboard/admin/api-keys")}>
                  <Key className="h-4 w-4 text-orange-400" />
                  {t("nav_api_keys", "API's")}
                </Link>
              </SecureRender>
              )}
              {isItemVisible("backup-restore") && (
              <SecureRender requiredPermission="BACKUP_MANAGE">
                <Link href="/dashboard/admin/backups" className={linkClass("/dashboard/admin/backups")}>
                  <Database className="h-4 w-4 text-orange-400" />
                  {t("nav_backup_restore", "Backup & Restore")}
                </Link>
              </SecureRender>
              )}
              {isItemVisible("chatbot") && (
              <SecureRender requiredPermission="CHATBOT_MANAGE">
                <Link href="/dashboard/admin/chatbot" className={linkClass("/dashboard/admin/chatbot")}>
                  <Bot className="h-4 w-4 text-orange-400" />
                  {t("nav_chatbot", "ChatBot")}
                </Link>
              </SecureRender>
              )}
              <SecureRender requiredPermission="MENUS_MANAGE">
                <Link href="/dashboard/admin/menus" className={linkClass("/dashboard/admin/menus")}>
                  <SlidersHorizontal className="h-4 w-4 text-orange-400" />
                  {t("nav_menus", "Menus")}
                </Link>
              </SecureRender>
              {isItemVisible("levels") && (
              <SecureRender requiredPermission="LEVELS_MANAGE">
                <Link href="/dashboard/admin/levels" className={linkClass("/dashboard/admin/levels")}>
                  <Layers className="h-4 w-4 text-orange-400" />
                  {t("nav_levels", "Níveis")}
                </Link>
              </SecureRender>
              )}
              {isItemVisible("access-profiles") && (
              <SecureRender requiredPermission="ROLES_MANAGE">
                <Link href="/dashboard/admin/roles" className={linkClass("/dashboard/admin/roles")}>
                  <UserCog className="h-4 w-4 text-orange-400" />
                  {t("nav_access_profiles", "Perfis de acesso")}
                </Link>
              </SecureRender>
              )}
            </>
          )}
        </div>
      )}
    </nav>
  );
}

// Wrapper auxiliar para animação e estruturação de cada secção lateral
function sidebarSection(isOpen: boolean, content: React.ReactNode) {
  if (!isOpen) return null;
  return (
    <div className="space-y-1 pl-1 animate-in fade-in slide-in-from-top-1 duration-150">
      {content}
    </div>
  );
}

// Ícone de CPU customizado
function CpuIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="16" height="16" x="4" y="4" rx="2" />
      <rect width="6" height="6" x="9" y="9" rx="1" />
      <path d="M9 1v3" />
      <path d="M15 1v3" />
      <path d="M9 20v3" />
      <path d="M15 20v3" />
      <path d="M20 9h3" />
      <path d="M20 15h3" />
      <path d="M1 9h3" />
      <path d="M1 15h3" />
    </svg>
  );
}
