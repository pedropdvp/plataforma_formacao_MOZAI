/**
 * Registo central de todos os menus (agrupadores + itens) do sidebar, usado tanto pelo
 * sidebar (para saber que id verificar) como pela página de administração de visibilidade
 * de menus (para saber o que pode ser mostrado/ocultado por empresa).
 *
 * O item "menus" (Configuração > Menus) nunca é ocultável — evita que um Admin se
 * bloqueie a si próprio ao esconder o único sítio onde pode reverter isso.
 */

export interface MenuGroupDef {
  id: string;
  label: string;
}

export interface MenuItemDef {
  id: string;
  groupId: string;
  label: string;
  path: string;
}

export const MENU_GROUPS: MenuGroupDef[] = [
  { id: "aprendizagem", label: "Aprendizagem" },
  { id: "comunicacao", label: "Comunicação" },
  { id: "financeiro", label: "Financeiro" },
  { id: "pessoal", label: "Pessoal" },
  { id: "workspace", label: "Workspace" },
  { id: "suporte", label: "Suporte" },
  { id: "relatorios", label: "Relatórios" },
  { id: "configuracao", label: "Configurações" },
];

export const MENU_ITEMS: MenuItemDef[] = [
  // Aprendizagem
  { id: "catalog", groupId: "aprendizagem", label: "Catálogo", path: "/dashboard/catalog" },
  { id: "marketplace", groupId: "aprendizagem", label: "Marketplace", path: "/dashboard/marketplace" },
  { id: "challenges", groupId: "aprendizagem", label: "Desafios", path: "/dashboard/challenges" },
  { id: "gamification", groupId: "aprendizagem", label: "Gamificação", path: "/dashboard/gamification" },
  { id: "my-courses", groupId: "aprendizagem", label: "Meus Cursos", path: "/dashboard/my-courses" },
  { id: "mozai-academy", groupId: "aprendizagem", label: "MOZAI Academy", path: "/dashboard/mozai-academy" },
  { id: "progress", groupId: "aprendizagem", label: "Progresso", path: "/dashboard/personal/progress" },
  { id: "avatar-training", groupId: "aprendizagem", label: "Treino com Avatares", path: "/dashboard/avatar-training" },

  // Comunicação
  { id: "live-classes", groupId: "comunicacao", label: "Aulas ao Vivo", path: "/dashboard/live-classes" },
  { id: "community", groupId: "comunicacao", label: "Comunidade", path: "/dashboard/community" },
  { id: "forum", groupId: "comunicacao", label: "Fórum", path: "/dashboard/forum" },
  { id: "notifications", groupId: "comunicacao", label: "Notificações", path: "/dashboard/notifications" },
  { id: "training-rooms", groupId: "comunicacao", label: "Salas de Treino", path: "/dashboard/training-rooms" },
  { id: "telegram-ia", groupId: "comunicacao", label: "Telegram IA", path: "/dashboard/personal/telegram-ia" },

  // Financeiro
  { id: "subscriptions", groupId: "financeiro", label: "Mensalidades", path: "/dashboard/financial/subscriptions" },
  { id: "payments", groupId: "financeiro", label: "Pagamentos", path: "/dashboard/financial/payments" },

  // Pessoal
  { id: "account", groupId: "pessoal", label: "A minha Conta", path: "/dashboard/personal/profile" },
  { id: "change-password", groupId: "pessoal", label: "Alterar Password", path: "/dashboard/personal/change-password" },
  { id: "professional-card", groupId: "pessoal", label: "Cartão Profissional", path: "/dashboard/professional-card" },
  { id: "certificates", groupId: "pessoal", label: "Certificados", path: "/dashboard/certificates" },
  { id: "ai-credits", groupId: "pessoal", label: "Créditos IA", path: "/dashboard/personal/ai-credits" },
  { id: "recycling", groupId: "pessoal", label: "Cursos efetuados", path: "/dashboard/recycling" },
  { id: "diplomas", groupId: "pessoal", label: "Diplomas", path: "/dashboard/diplomas" },

  // Workspace
  { id: "marketing-agency", groupId: "workspace", label: "Agência de Marketing", path: "/dashboard/marketing-agency" },
  { id: "auto-update", groupId: "workspace", label: "Auto-Update (Engine)", path: "/dashboard/admin/auto-update" },
  { id: "coding-lab", groupId: "workspace", label: "Coding Lab (Prática)", path: "/dashboard/skills/coding-lab" },
  { id: "config-company", groupId: "workspace", label: "Configurar Empresa", path: "/dashboard/admin" },
  { id: "content-factory", groupId: "workspace", label: "Fábrica de Cursos (IA)", path: "/dashboard/admin/content-factory" },
  { id: "hr-console", groupId: "workspace", label: "Gestão de RH", path: "/dashboard/admin/hr" },
  { id: "career", groupId: "workspace", label: "Carreira & Mentoria", path: "/dashboard/career" },
  { id: "skills-os", groupId: "workspace", label: "Skills OS (Grafo de Competências)", path: "/dashboard/skills" },

  // Suporte
  { id: "user-guide", groupId: "suporte", label: "Guia de Utilização", path: "/dashboard/user-guide" },
  { id: "student-guide", groupId: "suporte", label: "Guia do Formando", path: "/dashboard/personal/student-guide" },
  { id: "support", groupId: "suporte", label: "Suporte", path: "/dashboard/personal/support" },

  // Relatórios
  { id: "rep-students", groupId: "relatorios", label: "Alunos", path: "/dashboard/reports/students" },
  { id: "rep-audit", groupId: "relatorios", label: "Auditoria", path: "/dashboard/reports/audit" },
  { id: "rep-companies", groupId: "relatorios", label: "Empresas", path: "/dashboard/reports/companies" },
  { id: "rep-employees", groupId: "relatorios", label: "Funcionários", path: "/dashboard/reports/employees" },
  { id: "history", groupId: "relatorios", label: "Histórico", path: "/dashboard/personal/history" },
  { id: "rep-teachers", groupId: "relatorios", label: "Professores", path: "/dashboard/reports/teachers" },

  // Configuração
  { id: "backup-restore", groupId: "configuracao", label: "Backup & Restore", path: "/dashboard/admin/backups" },
  { id: "api-keys", groupId: "configuracao", label: "API's", path: "/dashboard/admin/api-keys" },
  { id: "chatbot", groupId: "configuracao", label: "ChatBot", path: "/dashboard/admin/chatbot" },
  { id: "menus", groupId: "configuracao", label: "Menus", path: "/dashboard/admin/menus" },
  { id: "levels", groupId: "configuracao", label: "Níveis", path: "/dashboard/admin/levels" },
  { id: "access-profiles", groupId: "configuracao", label: "Perfis de acesso", path: "/dashboard/admin/roles" },
];

/** Nunca pode ser ocultado — é o único sítio onde a visibilidade dos menus é revertida. */
export const NON_HIDEABLE_MENU_IDS = new Set(["menus"]);
