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
  { id: "academy", groupId: "aprendizagem", label: "Academia Corporativa", path: "/dashboard/admin/academy" },
  { id: "live-classes", groupId: "aprendizagem", label: "Aulas ao Vivo", path: "/dashboard/live-classes" },
  { id: "project-review", groupId: "aprendizagem", label: "Avaliação de Projetos", path: "/dashboard/admin/projects" },
  { id: "blockchain-lab", groupId: "aprendizagem", label: "Blockchain Lab", path: "/dashboard/blockchain-lab" },
  { id: "career", groupId: "aprendizagem", label: "Carreira & Mentoria", path: "/dashboard/career" },
  // Aprendizagem
  { id: "catalog", groupId: "aprendizagem", label: "Catálogo", path: "/dashboard/catalog" },
  { id: "cloud-lab", groupId: "aprendizagem", label: "Cloud Lab", path: "/dashboard/cloud-lab" },
  { id: "coding-lab", groupId: "aprendizagem", label: "Coding Lab (Prática)", path: "/dashboard/skills/coding-lab" },
  { id: "academics", groupId: "aprendizagem", label: "Corpo Docente", path: "/dashboard/admin/academics" },
  { id: "cyber-lab", groupId: "aprendizagem", label: "Cyber Lab", path: "/dashboard/cyber-lab" },
  { id: "challenges", groupId: "aprendizagem", label: "Desafios", path: "/dashboard/challenges" },
  { id: "digital-twin", groupId: "aprendizagem", label: "Digital Twin", path: "/dashboard/digital-twin" },
  { id: "content-factory", groupId: "aprendizagem", label: "Fábrica de Cursos (IA)", path: "/dashboard/admin/content-factory" },
  { id: "gamification", groupId: "aprendizagem", label: "Gamificação", path: "/dashboard/gamification" },
  { id: "content-factory-tools", groupId: "aprendizagem", label: "Gerador de Conteúdo", path: "/dashboard/admin/content-factory-tools" },
  { id: "knowledge-graph", groupId: "aprendizagem", label: "Knowledge Graph", path: "/dashboard/knowledge-graph" },
  { id: "marketplace", groupId: "aprendizagem", label: "Marketplace", path: "/dashboard/marketplace" },
  { id: "community-mentorships", groupId: "aprendizagem", label: "Mentorias", path: "/dashboard/marketplace?tab=mentors" },
  { id: "progress", groupId: "aprendizagem", label: "Meu Progresso & DigitalTwin", path: "/dashboard/personal/progress" },
  { id: "my-courses", groupId: "aprendizagem", label: "Meus Cursos", path: "/dashboard/my-courses" },
  { id: "mozai-academy", groupId: "aprendizagem", label: "MOZAI Academy", path: "/dashboard/mozai-academy" },
  { id: "notifications", groupId: "aprendizagem", label: "Notificações", path: "/dashboard/notifications" },
  { id: "my-students", groupId: "aprendizagem", label: "Os Meus Alunos", path: "/dashboard/reports/my-students" },
  { id: "projects", groupId: "aprendizagem", label: "Projetos", path: "/dashboard/projects" },
  { id: "project-showcase", groupId: "aprendizagem", label: "Projetos (Showcase)", path: "/dashboard/project-showcase" },
  { id: "training-rooms", groupId: "aprendizagem", label: "Salas de Treino", path: "/dashboard/training-rooms" },
  { id: "skills-os", groupId: "aprendizagem", label: "Skills OS (Grafo de Competências)", path: "/dashboard/skills" },
  { id: "avatar-training", groupId: "aprendizagem", label: "Treino com Avatares", path: "/dashboard/avatar-training" },

  // Comunicação
  { id: "auto-update", groupId: "comunicacao", label: "Atualização Automática (Daily Engine)", path: "/dashboard/admin/auto-update" },
  // Comunicação
  { id: "community", groupId: "comunicacao", label: "Comunidade", path: "/dashboard/community" },
  { id: "discord", groupId: "comunicacao", label: "Discord", path: "/dashboard/admin/discord" },
  { id: "teams", groupId: "comunicacao", label: "Equipas", path: "/dashboard/teams" },
  { id: "events", groupId: "comunicacao", label: "Eventos", path: "/dashboard/events" },
  { id: "groups", groupId: "comunicacao", label: "Grupos", path: "/dashboard/groups" },
  { id: "hackathons", groupId: "comunicacao", label: "Hackathons", path: "/dashboard/hackathons" },
  { id: "meetups", groupId: "comunicacao", label: "Meetups", path: "/dashboard/meetups" },
  { id: "networking", groupId: "comunicacao", label: "Networking", path: "/dashboard/networking" },
  { id: "telegram-ia", groupId: "comunicacao", label: "Telegram IA", path: "/dashboard/personal/telegram-ia" },

  // Financeiro
  // Financeiro
  { id: "subscriptions", groupId: "financeiro", label: "Mensalidades", path: "/dashboard/financial/subscriptions" },
  { id: "payments", groupId: "financeiro", label: "Pagamentos", path: "/dashboard/financial/payments" },

  // Pessoal
  { id: "account", groupId: "pessoal", label: "A minha Conta", path: "/dashboard/personal/profile" },
  // Pessoal
  { id: "change-password", groupId: "pessoal", label: "Alterar Password", path: "/dashboard/personal/change-password" },
  { id: "professional-card", groupId: "pessoal", label: "Cartão Profissional", path: "/dashboard/professional-card" },
  { id: "certificates", groupId: "pessoal", label: "Certificados", path: "/dashboard/certificates" },
  { id: "ai-credits", groupId: "pessoal", label: "Créditos IA", path: "/dashboard/personal/ai-credits" },
  { id: "recycling", groupId: "pessoal", label: "Cursos efetuados", path: "/dashboard/recycling" },
  { id: "diplomas", groupId: "pessoal", label: "Diplomas", path: "/dashboard/diplomas" },
  // Mesmo destino que o "Histórico" do grupo Relatórios, de propósito: lá é a leitura de
  // gestão, aqui é o atalho de quem quer ver o seu próprio percurso. Ids distintos porque o
  // id identifica o item na gestão de visibilidade de menus — e por vir antes na lista, é
  // este que dita o grupo aberto ao abrir a página, que para a maioria dos perfis é Pessoal.
  { id: "personal-history", groupId: "pessoal", label: "O Meu Histórico", path: "/dashboard/personal/history" },
  { id: "privacy", groupId: "pessoal", label: "Privacidade & Dados", path: "/dashboard/personal/privacy" },

  // Workspace
  // Workspace
  { id: "marketing-agency", groupId: "workspace", label: "Agência de Marketing", path: "/dashboard/marketing-agency" },
  { id: "ai-agents-catalog", groupId: "workspace", label: "AI Agents (Personas Especializadas)", path: "/dashboard/ai-agents" },
  { id: "ai-lab", groupId: "workspace", label: "AI Lab (Multi-Modelo)", path: "/dashboard/ai-lab" },
  { id: "config-company", groupId: "workspace", label: "Configurar Empresa", path: "/dashboard/admin" },
  { id: "hr-console", groupId: "workspace", label: "Gestão de RH", path: "/dashboard/admin/hr" },
  { id: "job-postings", groupId: "workspace", label: "Vagas de Emprego", path: "/dashboard/admin/job-postings" },

  // Suporte
  // Suporte
  { id: "user-guide", groupId: "suporte", label: "Guia de Utilização", path: "/dashboard/user-guide" },
  { id: "student-guide", groupId: "suporte", label: "Guia do Formando", path: "/dashboard/personal/student-guide" },
  { id: "support", groupId: "suporte", label: "Suporte", path: "/dashboard/personal/support" },

  // Relatórios
  // Relatórios
  { id: "rep-students", groupId: "relatorios", label: "Alunos", path: "/dashboard/reports/students" },
  { id: "rep-audit", groupId: "relatorios", label: "Auditoria", path: "/dashboard/reports/audit" },
  { id: "rep-companies", groupId: "relatorios", label: "Empresas", path: "/dashboard/reports/companies" },
  { id: "rep-employees", groupId: "relatorios", label: "Funcionários", path: "/dashboard/reports/employees" },
  { id: "history", groupId: "relatorios", label: "Histórico", path: "/dashboard/personal/history" },
  { id: "rep-teachers", groupId: "relatorios", label: "Professores", path: "/dashboard/reports/teachers" },

  // Configuração
  // Configuração
  { id: "api-keys", groupId: "configuracao", label: "API's", path: "/dashboard/admin/api-keys" },
  { id: "backup-restore", groupId: "configuracao", label: "Backup & Restore", path: "/dashboard/admin/backups" },
  { id: "chatbot", groupId: "configuracao", label: "ChatBot", path: "/dashboard/admin/chatbot" },
  { id: "compliance", groupId: "configuracao", label: "Compliance (RGPD)", path: "/dashboard/admin/compliance" },
  { id: "mcps", groupId: "configuracao", label: "MCPs", path: "/dashboard/admin/mcps" },
  { id: "menus", groupId: "configuracao", label: "Menus", path: "/dashboard/admin/menus" },
  { id: "levels", groupId: "configuracao", label: "Níveis", path: "/dashboard/admin/levels" },
  { id: "access-profiles", groupId: "configuracao", label: "Perfis de acesso", path: "/dashboard/admin/roles" },
  { id: "plugins", groupId: "configuracao", label: "Plugins", path: "/dashboard/admin/plugins" },
  { id: "env-check", groupId: "configuracao", label: "Variáveis de Ambiente", path: "/dashboard/admin/env-check" },
];

/** Nunca pode ser ocultado — é o único sítio onde a visibilidade dos menus é revertida. */
export const NON_HIDEABLE_MENU_IDS = new Set(["menus"]);
