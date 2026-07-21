"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SecureRender from "@/components/secure-render";
import { useLanguage } from "@/hooks/use-language";
import { useAccess } from "@/hooks/use-access";
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
  Briefcase
} from "lucide-react";

export default function SidebarNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { activeRole } = useAccess();

  // Estados dos agrupadores (iniciam expandidos true por padrão)
  const [aprendizagemOpen, setAprendizagemOpen] = useState(true);
  const [comunicacaoOpen, setComunicacaoOpen] = useState(true);
  const [financeiroOpen, setFinanceiroOpen] = useState(true);
  const [pessoalOpen, setPessoalOpen] = useState(true);
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const [guiasOpen, setGuiasOpen] = useState(true);
  const [relatoriosOpen, setRelatoriosOpen] = useState(true);

  // Helper para verificar se a rota está ativa
  const isActive = (path: string) => pathname === path;

  // Active status of each group
  const isAprendizagemActive = [
    "/dashboard/catalog",
    "/dashboard/challenges",
    "/dashboard/gamification",
    "/dashboard/mozai-academy",
    "/dashboard/personal/progress",
    "/dashboard/avatar-training"
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
      <div className={`menu-group-container group-aprendizagem space-y-1.5 ${isAprendizagemActive ? "active" : ""}`}>
        <button
          onClick={() => setAprendizagemOpen(!aprendizagemOpen)}
          className="group-header-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-900/10 transition-all text-left text-[10px] font-bold uppercase tracking-widest cursor-pointer select-none group"
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
            <Link href="/dashboard/catalog" className={linkClass("/dashboard/catalog")}>
              <Library className="h-4 w-4 text-violet-400" />
              {t("nav_catalog", "Catálogo")}
            </Link>
            <Link href="/dashboard/challenges" className={linkClass("/dashboard/challenges")}>
              <Terminal className="h-4 w-4 text-cyan-400" />
              {t("nav_coding_lab", "Desafios")}
            </Link>
            <Link href="/dashboard/gamification" className={linkClass("/dashboard/gamification")}>
              <Trophy className="h-4 w-4 text-amber-500" />
              {t("nav_gamification", "Gamificação")}
            </Link>
            <Link href="/dashboard" className={linkClass("/dashboard")}>
              <BookOpen className="h-4 w-4 text-indigo-400" />
              {t("nav_my_courses", "Meus Cursos")}
            </Link>
            <Link href="/dashboard/mozai-academy" className={linkClass("/dashboard/mozai-academy")}>
              <Compass className="h-4 w-4 text-indigo-400" />
              {t("nav_academy", "MOZAI Academy")}
            </Link>
            <Link href="/dashboard/personal/progress" className={linkClass("/dashboard/personal/progress")}>
              <GraduationCap className="h-4 w-4 text-emerald-400" />
              {t("nav_progress", "Progresso")}
            </Link>
            <Link href="/dashboard/avatar-training" className={linkClass("/dashboard/avatar-training")}>
              <Bot className="h-4 w-4 text-indigo-400" />
              {t("nav_avatar", "Treino com Avatares")}
            </Link>
          </>
        )}
      </div>

      {/* Agrupador: COMUNICAÇÃO */}
      <div className={`menu-group-container group-comunicacao space-y-1.5 ${isComunicacaoActive ? "active" : ""}`}>
        <button
          onClick={() => setComunicacaoOpen(!comunicacaoOpen)}
          className="group-header-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-900/10 transition-all text-left text-[10px] font-bold uppercase tracking-widest cursor-pointer select-none group"
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
            <Link href="/dashboard/live-classes" className={linkClass("/dashboard/live-classes")}>
              <Video className="h-4 w-4 text-cyan-400" />
              {t("nav_live_classes", "Aulas ao Vivo")}
            </Link>
            <Link href="/dashboard/community" className={linkClass("/dashboard/community")}>
              <Users className="h-4 w-4 text-emerald-400" />
              {t("nav_community", "Comunidade")}
            </Link>
            <Link href="/dashboard/forum" className={linkClass("/dashboard/forum")}>
              <MessageSquare className="h-4 w-4 text-indigo-400" />
              {t("nav_forum", "Fórum")}
            </Link>
            <Link href="/dashboard/notifications" className={linkClass("/dashboard/notifications")}>
              <Bell className="h-4 w-4 text-amber-400" />
              {t("nav_notifications", "Notificações")}
            </Link>
            <Link href="/dashboard/training-rooms" className={linkClass("/dashboard/training-rooms")}>
              <Users className="h-4 w-4 text-indigo-400" />
              {t("nav_rooms", "Salas de Treino")}
            </Link>
            <Link href="/dashboard/personal/telegram-ia" className={linkClass("/dashboard/personal/telegram-ia")}>
              <MessageSquare className="h-4 w-4 text-sky-400" />
              {t("nav_telegram", "Telegram IA")}
            </Link>
          </>
        )}
      </div>

      {/* Agrupador: FINANCEIRO */}
      <div className={`menu-group-container group-financeiro space-y-1.5 ${isFinanceiroActive ? "active" : ""}`}>
        <button
          onClick={() => setFinanceiroOpen(!financeiroOpen)}
          className="group-header-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-900/10 transition-all text-left text-[10px] font-bold uppercase tracking-widest cursor-pointer select-none group"
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
            <Link href="/dashboard/financial/subscriptions" className={linkClass("/dashboard/financial/subscriptions")}>
              <CreditCard className="h-4 w-4 text-cyan-400" />
              {t("nav_subscription", "Mensalidades")}
            </Link>
            <Link href="/dashboard/financial/payments" className={linkClass("/dashboard/financial/payments")}>
              <Receipt className="h-4 w-4 text-indigo-400" />
              {t("nav_payments", "Pagamentos")}
            </Link>
          </>
        )}
      </div>

      {/* Agrupador: PESSOAL */}
      <div className={`menu-group-container group-pessoal space-y-1.5 ${isPessoalActive ? "active" : ""}`}>
        <button
          onClick={() => setPessoalOpen(!pessoalOpen)}
          className="group-header-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-900/10 transition-all text-left text-[10px] font-bold uppercase tracking-widest cursor-pointer select-none group"
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
            <Link href="/dashboard/personal/profile" className={linkClass("/dashboard/personal/profile")}>
              <User className="h-4 w-4 text-indigo-400" />
              {t("nav_account", "A minha Conta")}
            </Link>
            <Link href="/dashboard/personal/change-password" className={linkClass("/dashboard/personal/change-password")}>
              <Key className="h-4 w-4 text-cyan-400" />
              {t("nav_password", "Alterar Password")}
            </Link>
            <Link href="/dashboard/professional-card" className={linkClass("/dashboard/professional-card")}>
              <CreditCard className="h-4 w-4 text-indigo-400" />
              {t("nav_prof_card", "Cartão Profissional")}
            </Link>
            <SecureRender requiredPermission="CERTIFICATES_VIEW">
              <Link href="/dashboard/certificates" className={linkClass("/dashboard/certificates")}>
                <Award className="h-4 w-4 text-amber-400" />
                {t("nav_certificates", "Certificados")}
              </Link>
            </SecureRender>
            <Link href="/dashboard/personal/ai-credits" className={linkClass("/dashboard/personal/ai-credits")}>
              <CpuIcon className="h-4 w-4 text-amber-400" />
              {t("nav_credits", "Créditos IA")}
            </Link>
            <Link href="/dashboard/recycling" className={linkClass("/dashboard/recycling")}>
              <RefreshCw className="h-4 w-4 text-emerald-400" />
              {t("nav_completed_courses", "Cursos efetuados")}
            </Link>
            <SecureRender requiredPermission="CERTIFICATES_VIEW">
              <Link href="/dashboard/diplomas" className={linkClass("/dashboard/diplomas")}>
                <Award className="h-4 w-4 text-indigo-400" />
                {t("nav_diplomas", "Diplomas")}
              </Link>
            </SecureRender>
          </>
        )}
      </div>

      {/* Agrupador: WORKSPACE */}
      <div className={`menu-group-container group-workspace space-y-1.5 ${isWorkspaceActive ? "active" : ""}`}>
        <button
          onClick={() => setWorkspaceOpen(!workspaceOpen)}
          className="group-header-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-900/10 transition-all text-left text-[10px] font-bold uppercase tracking-widest cursor-pointer select-none group"
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
            <Link href="/dashboard/marketing-agency" className={linkClass("/dashboard/marketing-agency")}>
              <Megaphone className="h-4 w-4 text-indigo-400" />
              {t("nav_marketing", "Agência de Marketing")}
            </Link>
            <SecureRender requiredPermission="SYSTEM_AUDIT_VIEW">
              <Link href="/dashboard/admin/auto-update" className={linkClass("/dashboard/admin/auto-update")}>
                <Settings className="h-4 w-4 text-rose-400" />
                {t("nav_auto_update", "Auto-Update (Engine)")}
              </Link>
            </SecureRender>
            <Link href="/dashboard/skills/coding-lab" className={linkClass("/dashboard/skills/coding-lab")}>
              <Terminal className="h-4 w-4 text-emerald-400" />
              {t("nav_coding_lab", "Coding Lab (Prática)")}
            </Link>
            <SecureRender requiredPermission="TENANTS_MANAGE">
              <Link href="/dashboard/admin" className={linkClass("/dashboard/admin")}>
                <Settings className="h-4 w-4 text-slate-400" />
                {t("nav_config_company", "Configurar Empresa")}
              </Link>
            </SecureRender>
            <SecureRender requiredPermission="COURSES_CREATE">
              <Link href="/dashboard/admin/content-factory" className={linkClass("/dashboard/admin/content-factory")}>
                <Settings className="h-4 w-4 text-violet-400" />
                {t("nav_content_factory", "Content Factory (IA)")}
              </Link>
            </SecureRender>
            <SecureRender requiredPermission="PAYMENTS_MANAGE">
              <Link href="/dashboard/admin/hr" className={linkClass("/dashboard/admin/hr")}>
                <Settings className="h-4 w-4 text-indigo-400" />
                {t("nav_hr_console", "Gestão de RH")}
              </Link>
            </SecureRender>
            <Link href="/dashboard/career" className={linkClass("/dashboard/career")}>
              <Brain className="h-4 w-4 text-violet-400" />
              {t("nav_career", "Carreira & Mentoria")}
            </Link>
            <Link href="/dashboard/skills" className={linkClass("/dashboard/skills")}>
              <Terminal className="h-4 w-4 text-cyan-400" />
              {t("nav_skills_os", "Skills OS (Grafo de Competências)")}
            </Link>
          </>
        )}
      </div>

      {/* Agrupador: SUPORTE */}
      <div className={`menu-group-container group-suporte space-y-1.5 ${isSuporteActive ? "active" : ""}`}>
        <button
          onClick={() => setGuiasOpen(!guiasOpen)}
          className="group-header-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-900/10 transition-all text-left text-[10px] font-bold uppercase tracking-widest cursor-pointer select-none group"
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
            <Link href="/dashboard/user-guide" className={linkClass("/dashboard/user-guide")}>
              <Compass className="h-4 w-4 text-slate-400 animate-spin-slow" />
              {t("nav_user_guide", "Guia de Utilização")}
            </Link>
            <Link href="/dashboard/personal/student-guide" className={linkClass("/dashboard/personal/student-guide")}>
              <BookOpen className="h-4 w-4 text-indigo-400" />
              {t("nav_student_guide", "Guia do Formando")}
            </Link>
            <Link href="/dashboard/personal/support" className={linkClass("/dashboard/personal/support")}>
              <LifeBuoy className="h-4 w-4 text-rose-400" />
              {t("nav_support", "Suporte")}
            </Link>
          </>
        )}
      </div>

      {/* Agrupador: RELATÓRIOS */}
      {(activeRole === "ADMIN" || activeRole === "SUPORTE" || activeRole === "GESTOR_EMPRESA") && (
        <div className={`menu-group-container group-relatorios space-y-1.5 ${isRelatoriosActive ? "active" : ""}`}>
          <button
            onClick={() => setRelatoriosOpen(!relatoriosOpen)}
            className="group-header-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-900/10 transition-all text-left text-[10px] font-bold uppercase tracking-widest cursor-pointer select-none group"
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
              <Link href="/dashboard/reports/students" className={linkClass("/dashboard/reports/students")}>
                <GraduationCap className="h-4 w-4 text-violet-400" />
                {t("nav_rep_students", "Alunos")}
              </Link>
              {(activeRole === "ADMIN" || activeRole === "SUPORTE") && (
                <Link href="/dashboard/reports/audit" className={linkClass("/dashboard/reports/audit")}>
                  <Activity className="h-4 w-4 text-rose-400" />
                  {t("nav_rep_audit", "Auditoria")}
                </Link>
              )}
              <Link href="/dashboard/reports/companies" className={linkClass("/dashboard/reports/companies")}>
                <Building className="h-4 w-4 text-indigo-400" />
                {t("nav_rep_companies", "Empresas")}
              </Link>
              <Link href="/dashboard/reports/employees" className={linkClass("/dashboard/reports/employees")}>
                <Briefcase className="h-4 w-4 text-emerald-400" />
                {t("nav_rep_employees", "Funcionários")}
              </Link>
              <Link href="/dashboard/personal/history" className={linkClass("/dashboard/personal/history")}>
                <Clock className="h-4 w-4 text-cyan-400" />
                {t("nav_history", "Histórico")}
              </Link>
              <Link href="/dashboard/reports/teachers" className={linkClass("/dashboard/reports/teachers")}>
                <GraduationCap className="h-4 w-4 text-cyan-400" />
                {t("nav_rep_teachers", "Professores")}
              </Link>
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
