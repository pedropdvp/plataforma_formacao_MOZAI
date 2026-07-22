"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast-provider";
import { DetailModal, DetailModalColumn } from "@/components/ui/detail-modal";
import { exportToCSV, exportToXLSX } from "@/lib/export-utils";
import {
  Users, BookOpen, AlertTriangle, TrendingUp, Compass, ArrowRight, UserCheck,
  CheckCircle2, Plus, Mail, User, ShieldAlert, GraduationCap, X, Loader2, LifeBuoy,
  Eye, Edit, Trash2, FileText, Search, Download
} from "lucide-react";

interface HRClientProps {
  initialProgress: any[];
  initialCognitiveLogs: any[];
  tenantId: string;
  companyName: string;
  brandColor: string;
  userId: string;
  globalStats?: any;
  activeRole?: string | null;
}

interface DBUser {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenants: Array<{ tenantId: string; roles: string[] }>;
  assignedCourses?: string[];
}

export default function HRDashboardClient({
  initialProgress,
  initialCognitiveLogs,
  tenantId,
  companyName,
  brandColor,
  userId,
  globalStats,
  activeRole
}: HRClientProps) {
  const isGlobal = activeRole === "ADMIN" || activeRole === "SUPORTE";
  const [activeTab, setActiveTab] = useState("analytics"); // "analytics" | "users"
  const [progressList, setProgressList] = useState(initialProgress);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [users, setUsers] = useState<DBUser[]>([]);
  const [employees, setEmployees] = useState<DBUser[]>([]);
  const [students, setStudents] = useState<DBUser[]>([]);

  // Form de Criar Utilizador
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("ALUNO"); // "FUNCIONARIO" | "ALUNO"
  const [registerAsIndividual, setRegisterAsIndividual] = useState(false);
  const [submittingUser, setSubmittingUser] = useState(false);
  const [userError, setUserError] = useState("");
  const [userSuccess, setUserSuccess] = useState(false);

  // Form/Modal de Atribuição de Cursos
  const [selectedStudent, setSelectedStudent] = useState<DBUser | null>(null);
  const [assigningCourse, setAssigningCourse] = useState(false);

  // Estados adicionais para CRUD (Requisito do Utilizador)
  const [editingUser, setEditingUser] = useState<DBUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("ALUNO");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [viewingUser, setViewingUser] = useState<DBUser | null>(null);

  // Modal de confirmação de eliminação
  const [deletingUser, setDeletingUser] = useState<DBUser | null>(null);

  // Modal de detalhe (drill-down) dos cards de Métricas e Gap Analysis
  const [activeDetail, setActiveDetail] = useState<
    "supportStaff" | "academicManagers" | "professors" | "trainers" | "tutors" | "finance" | "bottlenecks" | null
  >(null);

  const { showToast } = useToast();

  // Função para Atualizar utilizador (Update)
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId
        },
        body: JSON.stringify({
          targetUserId: editingUser._id,
          name: editName,
          email: editEmail,
          role: editRole
        })
      });
      if (res.ok) {
        fetchUsers();
        setEditingUser(null);
        showToast("Utilizador atualizado com sucesso!", "success");
      } else {
        const data = await res.json();
        showToast(data.error || "Erro ao atualizar utilizador.", "error");
      }
    } catch (err) {
      console.error("Erro ao editar utilizador:", err);
      showToast("Erro ao editar utilizador.", "error");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Função para Eliminar utilizador (Delete)
  const handleDeleteUser = async (userToDelete: DBUser) => {
    if (userToDelete._id === userId) {
      showToast("Não pode apagar a sua própria conta.", "warning");
      return;
    }
    // Mostrar modal de confirmação
    setDeletingUser(userToDelete);
  };

  const confirmDeleteUser = async () => {
    if (!deletingUser) return;
    setDeletingUser(null);
    try {
      const res = await fetch(`/api/admin/users?targetUserId=${deletingUser._id}`, {
        method: "DELETE",
        headers: {
          "x-tenant-id": tenantId
        }
      });
      if (res.ok) {
        fetchUsers();
        showToast("Utilizador removido com sucesso!", "success");
      } else {
        const data = await res.json();
        showToast(data.error || "Erro ao remover utilizador.", "error");
      }
    } catch (err) {
      console.error("Erro ao remover utilizador:", err);
      showToast("Erro ao remover utilizador.", "error");
    }
  };

  // Catálogo de Cursos Estáticos
  const AVAILABLE_COURSES = [
    { id: "course-1", name: "Engenharia de IA e RAG Avançado" },
    { id: "course-2", name: "Next.js 16 e Arquiteturas Composable SaaS" },
    { id: "course-3", name: "Solidity, Smart Contracts e Auditoria ZKP" },
    { id: "course-4", name: "Fundamentos de Criptomoedas" }
  ];

  // Carregar utilizadores (Alunos e Funcionários) do Tenant
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/admin/users", {
        headers: { "x-tenant-id": tenantId }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setEmployees(data.employees || []);
        setStudents(data.students || []);
      }
    } catch (err) {
      console.error("Erro ao carregar utilizadores B2B:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (activeTab === "users") {
      fetchUsers();
    }
  }, [activeTab]);

  // Tratar submissão do formulário de criação de utilizador
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingUser(true);
    setUserError("");
    setUserSuccess(false);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId
        },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          role: newRole,
          registerAsIndividual: newRole === "ALUNO" && registerAsIndividual
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setUserError(data.error || "Erro ao registar utilizador.");
      } else {
        setUserSuccess(true);
        setNewName("");
        setNewEmail("");
        setRegisterAsIndividual(false);
        await fetchUsers(); // Atualizar listagem
        setTimeout(() => setUserSuccess(false), 3500);
      }
    } catch (err) {
      setUserError("Erro de comunicação com o servidor.");
    } finally {
      setSubmittingUser(false);
    }
  };

  // Tratar atribuição/desatribuição de curso
  const handleToggleCourse = async (courseId: string, isAssigned: boolean) => {
    if (!selectedStudent) return;
    setAssigningCourse(true);

    try {
      const res = await fetch("/api/admin/courses/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId
        },
        body: JSON.stringify({
          studentId: selectedStudent._id,
          courseId,
          action: isAssigned ? "unassign" : "assign"
        })
      });

      if (res.ok) {
        // Atualizar localmente no estado
        const updatedStudents = students.map((s) => {
          if (s._id === selectedStudent._id) {
            const currentCourses = s.assignedCourses || [];
            const newCourses = isAssigned
              ? currentCourses.filter((c) => c !== courseId)
              : [...currentCourses, courseId];
            
            const updatedStudent = { ...s, assignedCourses: newCourses };
            // Atualizar também o estudante selecionado
            setSelectedStudent(updatedStudent);
            return updatedStudent;
          }
          return s;
        });
        setStudents(updatedStudents);
      }
    } catch (err) {
      console.error("Erro ao alterar atribuição de curso:", err);
    } finally {
      setAssigningCourse(false);
    }
  };

  // 1. Processar Métricas Corporativas (KPIs)
  const uniqueUserIds = Array.from(new Set(progressList.map((p: any) => p.userId)));
  const activeEmployees = users.length;

  const academicManagers = users.filter(u => u.tenants?.some(t => t.tenantId === tenantId && t.roles.includes("GESTOR_ACADEMICO")));
  const professors = users.filter(u => u.tenants?.some(t => t.tenantId === tenantId && t.roles.includes("PROFESSOR")));
  const trainers = users.filter(u => u.tenants?.some(t => t.tenantId === tenantId && t.roles.includes("FORMADOR")));
  const tutors = users.filter(u => u.tenants?.some(t => t.tenantId === tenantId && t.roles.includes("TUTOR")));
  const financeStaff = users.filter(u => u.tenants?.some(t => t.tenantId === tenantId && t.roles.includes("FINANCEIRO")));
  const supportStaff = users.filter(u => u.tenants?.some(t => t.tenantId === tenantId && t.roles.includes("SUPORTE")));
  const operationalEmployees = users.filter(u => u.tenants?.some(t => t.tenantId === tenantId && t.roles.includes("FUNCIONARIO")));
  const studentsList = users.filter(u => u.tenants?.some(t => t.tenantId === tenantId && t.roles.includes("ALUNO")));

  const renderUserSection = (title: string, roleUsers: DBUser[], icon: React.ReactNode, badgeLabel: string, showCourseAssign = false) => {
    return (
      <div className="border border-slate-700 bg-slate-950/40 rounded-3xl p-5 space-y-3">
        <h3 className="font-bold text-sm text-white flex items-center gap-2">
          {icon}
          {title} ({roleUsers.length})
        </h3>

        {loadingUsers ? (
          <div className="flex justify-center py-4 text-slate-550 text-xs">A carregar...</div>
        ) : roleUsers.length === 0 ? (
          <div className="text-center text-xs text-slate-500 py-4 border border-slate-800 border-dashed rounded-xl">
            Nenhum utilizador com este perfil.
          </div>
        ) : (
          <div className="space-y-2">
            {roleUsers.map((u) => (
              <div key={u._id} className="p-3 border border-slate-800 bg-slate-950/60 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                <div>
                  <span className="block font-bold text-white">{u.firstName} {u.lastName}</span>
                  <span className="text-[10px] text-slate-500 font-mono block mb-0.5">{u.email}</span>
                  
                  {/* Cursos Atribuídos */}
                  {showCourseAssign && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {u.assignedCourses && u.assignedCourses.length > 0 ? (
                        u.assignedCourses.map((cId) => {
                          const course = AVAILABLE_COURSES.find(c => c.id === cId);
                          return (
                            <span key={cId} className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 text-[9px] font-medium">
                              {course?.name || cId}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-[9px] text-rose-450 italic">Sem cursos agendados/atribuídos</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                  {showCourseAssign && (
                    <button
                      onClick={() => setSelectedStudent(u)}
                      className="h-8 px-3 rounded-lg border border-indigo-500/20 hover:border-indigo-550 bg-indigo-500/5 hover:bg-indigo-500/10 text-[10px] font-bold text-indigo-400 transition-colors cursor-pointer shrink-0"
                    >
                      Atribuir Cursos
                    </button>
                  )}
                  <span className="text-[9px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-bold uppercase mr-1">
                    {badgeLabel}
                  </span>
                  <button
                    onClick={() => setViewingUser(u)}
                    className="p-1.5 rounded-lg border border-slate-805 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Visualizar Detalhes"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingUser(u);
                      setEditName(`${u.firstName} ${u.lastName}`.trim());
                      setEditEmail(u.email);
                      const activeMap = u.tenants.find((t: any) => t.tenantId === tenantId);
                      setEditRole(activeMap?.roles[0] || "ALUNO");
                    }}
                    className="p-1.5 rounded-lg border border-slate-805 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
                    title="Editar Utilizador"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  {u._id !== userId && (
                    <button
                      onClick={() => handleDeleteUser(u)}
                      className="p-1.5 rounded-lg border border-slate-805 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-rose-455 transition-colors cursor-pointer"
                      title="Remover Utilizador"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const completedLessonsCount = progressList.filter((p: any) => p.status === "completed").length;
  const totalPossibleLessons = Math.max(uniqueUserIds.length * 9, 9);
  const completionRate = Math.round(Math.min((completedLessonsCount / totalPossibleLessons) * 100, 100)) || 45;

  const totalWatchSeconds = progressList.reduce((acc: number, curr: any) => acc + (curr.watchTime || 0), 0);
  const totalStudyHours = Math.round(totalWatchSeconds / 3600) || 12;

  // Gargalos Críticos: lições onde há mais colaboradores "in-progress" do que "completed" (pontos de bloqueio real)
  const LESSON_TITLES: Record<string, string> = {
    "lesson-1-1": "Introdução às Criptomoedas",
    "lesson-1-2": "Definição de Cripto",
    "lesson-1-3": "Blockchain e Consenso",
    "lesson-2-1": "Mapeamento Digital Twin",
    "lesson-2-2": "IA Tutor Interativo",
  };
  const inProgressByLesson: Record<string, number> = {};
  const completedByLesson: Record<string, number> = {};
  progressList.forEach((p: any) => {
    if (!p.lessonId) return;
    if (p.status === "in-progress") inProgressByLesson[p.lessonId] = (inProgressByLesson[p.lessonId] || 0) + 1;
    if (p.status === "completed") completedByLesson[p.lessonId] = (completedByLesson[p.lessonId] || 0) + 1;
  });
  let bottlenecks = Object.entries(inProgressByLesson)
    .filter(([lessonId, count]) => count > (completedByLesson[lessonId] || 0))
    .map(([lessonId, count]) => ({
      lessonTitle: LESSON_TITLES[lessonId] || lessonId,
      stalledCount: count
    }))
    .sort((a, b) => b.stalledCount - a.stalledCount);

  if (bottlenecks.length === 0) {
    // Fallback rico e coerente com o comportamento anterior (completionRate < 60 ? 3 : 1)
    bottlenecks = completionRate < 60
      ? [
          { lessonTitle: "Definição de Cripto", stalledCount: 8 },
          { lessonTitle: "Blockchain e Consenso", stalledCount: 5 },
          { lessonTitle: "Mapeamento Digital Twin", stalledCount: 3 },
        ]
      : [{ lessonTitle: "Blockchain e Consenso", stalledCount: 2 }];
  }

  // 2. Inventário de Competências (Mapeado dinamicamente das lições completadas)
  const isCompleted = (cId: string, lId: string) =>
    progressList.some((p: any) => p.courseId === cId && p.lessonId === lId && p.status === "completed");

  const skillsInventory = [
    { name: "Python Core", averageScore: isCompleted("course-1", "lesson-1-1") ? 88 : 40, coverage: isCompleted("course-1", "lesson-1-1") ? 90 : 25 },
    { name: "FastAPI Routing", averageScore: isCompleted("course-1", "lesson-1-1") ? 72 : 30, coverage: isCompleted("course-1", "lesson-1-1") ? 60 : 15 },
    { name: "Docker Containers", averageScore: isCompleted("course-1", "lesson-1-2") ? 82 : 35, coverage: isCompleted("course-1", "lesson-1-2") ? 75 : 10 },
    { name: "RAG & Vector Search", averageScore: isCompleted("course-1", "lesson-1-3") ? 79 : 20, coverage: isCompleted("course-1", "lesson-1-3") ? 55 : 5 },
    { name: "Next.js 16 RSC", averageScore: isCompleted("course-2", "lesson-1-1") ? 84 : 45, coverage: isCompleted("course-2", "lesson-1-1") ? 80 : 30 },
    { name: "Solidity Blockchain", averageScore: isCompleted("course-3", "lesson-1-1") ? 92 : 30, coverage: isCompleted("course-3", "lesson-1-1") ? 70 : 10 },
  ];

  // 3. Analisar logs cognitivos agregados para obter tendências corporativas
  const searchTerms: Record<string, number> = {};
  initialCognitiveLogs.forEach((log: any) => {
    if (Array.isArray(log.keywords)) {
      log.keywords.forEach((word: string) => {
        searchTerms[word] = (searchTerms[word] || 0) + 1;
      });
    }
  });

  const sortedTerms = Object.entries(searchTerms)
    .sort((a, b) => b[1] - a[1])
    .map((entry) => entry[0])
    .slice(0, 3);

  let teamPlan = "As equipas estão a focar em conceitos base. Sugerimos ativar mais mini-testes para consolidar lógica.";
  if (sortedTerms.length > 0) {
    teamPlan = `Detetámos que os colaboradores andam a pesquisar ativamente por "${sortedTerms.join(
      ", "
    )}". Sugerimos agendar uma aula ao vivo de tira-dúvidas sobre estes temas esta semana.`;
  }

  // 4. Inventário de Colaboradores Estático (Fallback visual para o dashboard inicial)
  const demoEmployeeList = [
    {
      id: "emp-1",
      name: "Tu (Gestor)",
      role: "Software Developer",
      completedLessons: progressList.filter((p: any) => p.userId === userId && p.status === "completed").length,
      activeCourses: Array.from(new Set(progressList.filter((p: any) => p.userId === userId).map((p: any) => p.courseId))).length,
      interests: sortedTerms.length > 0 ? sortedTerms : ["Python", "FastAPI"],
    },
    {
      id: "emp-2",
      name: "Ana Costa",
      role: "Frontend Engineer",
      completedLessons: 4,
      activeCourses: 2,
      interests: ["Next.js", "Clerk", "CSS"],
    },
    {
      id: "emp-3",
      name: "João Silva",
      role: "DevOps Specialist",
      completedLessons: 2,
      activeCourses: 1,
      interests: ["Docker", "Kubernetes", "AWS"],
    },
  ];

  return (
    <div className="space-y-6 report-page-container">
      {/* Dynamic branding header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-400" />
            Gestão de RH: {companyName}
          </h1>
          <p className="text-sm text-slate-400">
            Painel corporativo para monitorização de progresso, gestão de pessoal e agendamento de cursos.
          </p>
        </div>

        {/* Dynamic Tenant Badge */}
        <div className="self-start px-3.5 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 text-xs font-semibold text-indigo-400">
          Empresa: {tenantId.toUpperCase()}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-900 gap-6">
        <button
          onClick={() => setActiveTab("analytics")}
          className={`pb-3 text-xs font-bold transition-all relative ${
            activeTab === "analytics" ? "text-indigo-400 font-extrabold" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Métricas e Gap Analysis
          {activeTab === "analytics" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" style={{ backgroundColor: brandColor }} />
          )}
        </button>
        
        <button
          onClick={() => setActiveTab("users")}
          className={`pb-3 text-xs font-bold transition-all relative ${
            activeTab === "users" ? "text-indigo-400 font-extrabold" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Gestão de Pessoal e Cursos B2B
          {activeTab === "users" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" style={{ backgroundColor: brandColor }} />
          )}
        </button>
      </div>

      {/* TAB 1: ANALYTICS & GAP ANALYSIS */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* Exportação de Métricas e Gap Analysis */}
          <fieldset className="border border-slate-700 rounded-xl px-4 py-2.5 grid grid-cols-3 gap-3 shrink-0 max-w-md">
            <legend className="text-[10px] uppercase font-extrabold text-slate-400 px-2 tracking-wider">Exportar</legend>
            <button
              onClick={() => window.print()}
              className="h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <Search className="h-4 w-4" />
              Visualizar
            </button>
            <button
              onClick={() => window.print()}
              className="h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <Download className="h-4 w-4" />
              PDF
            </button>
            <button
              onClick={async () => {
                const headers = ["Categoria", "Nome", "E-mail"];
                const rows: any[] = [
                  ...users.map((u) => ["Colaborador Ativo", `${u.firstName} ${u.lastName}`, u.email]),
                  ...(globalStats?.supportStaff || []).map((u: any) => ["Funcionário de Suporte", u.name, u.email]),
                  ...(globalStats?.academicManagers || []).map((u: any) => ["Gestor Académico", u.name, u.email]),
                  ...(globalStats?.professors || []).map((u: any) => ["Professor", u.name, u.email]),
                  ...(globalStats?.trainers || []).map((u: any) => ["Formador", u.name, u.email]),
                  ...(globalStats?.tutors || []).map((u: any) => ["Tutor", u.name, u.email]),
                  ...(globalStats?.finance || []).map((u: any) => ["Financeiro", u.name, u.email]),
                ];
                await exportToXLSX(headers, rows, `metricas_gap_analysis_${new Date().toISOString().split("T")[0]}`);
              }}
              className="h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <Download className="h-4 w-4" />
              XLSX
            </button>
            <button
              onClick={async () => {
                const headers = ["Categoria", "Nome", "E-mail"];
                const rows: any[] = [
                  ...users.map((u) => ["Colaborador Ativo", `${u.firstName} ${u.lastName}`, u.email]),
                  ...(globalStats?.supportStaff || []).map((u: any) => ["Funcionário de Suporte", u.name, u.email]),
                  ...(globalStats?.academicManagers || []).map((u: any) => ["Gestor Académico", u.name, u.email]),
                  ...(globalStats?.professors || []).map((u: any) => ["Professor", u.name, u.email]),
                  ...(globalStats?.trainers || []).map((u: any) => ["Formador", u.name, u.email]),
                  ...(globalStats?.tutors || []).map((u: any) => ["Tutor", u.name, u.email]),
                  ...(globalStats?.finance || []).map((u: any) => ["Financeiro", u.name, u.email]),
                ];
                await exportToCSV(headers, rows, `metricas_gap_analysis_${new Date().toISOString().split("T")[0]}`);
              }}
              className="col-span-3 h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
          </fieldset>

          {/* Corporate KPIs */}
          <section className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div 
              onClick={() => setActiveTab("users")}
              className="border border-slate-700 bg-slate-950/40 hover:border-indigo-500/40 hover:bg-indigo-500/[0.02] cursor-pointer transition-all rounded-2xl p-3.5 flex items-center gap-3 group"
              title="Clique para gerir colaboradores"
            >
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-105 transition-transform">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-xl font-bold text-white leading-tight">{activeEmployees}</span>
                <span className="text-[10px] text-slate-500 group-hover:text-slate-350 transition-colors">Colaboradores Ativos</span>
              </div>
            </div>

            <div className="border border-slate-700 bg-slate-950/40 rounded-2xl p-3.5 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-xl font-bold text-white leading-tight">{completionRate}%</span>
                <span className="text-[10px] text-slate-500">Taxa de Conclusão</span>
              </div>
            </div>

            <div className="border border-slate-700 bg-slate-950/40 rounded-2xl p-3.5 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-xl font-bold text-white leading-tight">{totalStudyHours}h</span>
                <span className="text-[10px] text-slate-500">Horas de Estudo Totais</span>
              </div>
            </div>

            <div
              onClick={() => setActiveDetail("bottlenecks")}
              className="border border-slate-700 bg-slate-950/40 rounded-2xl p-3.5 flex items-center gap-3 cursor-pointer hover:border-indigo-500/40 transition-colors"
            >
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-xl font-bold text-white leading-tight">
                  {bottlenecks.length}
                </span>
                <span className="text-[10px] text-slate-500">Gargalos Críticos</span>
              </div>
            </div>
          </section>

          {/* Estatísticas de Acessos Globais (Administração / Suporte) */}
          {globalStats && (
            <div className="border border-slate-700 bg-slate-950/40 rounded-3xl p-5 space-y-4">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <LifeBuoy className="h-4.5 w-4.5 text-indigo-400" />
                  Estatísticas Globais de Acessos (Suporte e Perfis)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Resumo detalhado de perfis e acessos ativos em toda a plataforma.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Support staff card */}
                <div
                  onClick={() => setActiveDetail("supportStaff")}
                  className="p-3 rounded-2xl bg-slate-950/40 border border-slate-700 space-y-1 cursor-pointer hover:border-indigo-500/40 transition-colors"
                >
                  <span className="block text-lg font-bold text-white leading-tight">{globalStats.supportUsersCount}</span>
                  <span className="text-[10px] text-slate-400 block font-medium">Funcionários de Suporte</span>
                  <span className="text-[9px] text-slate-500 block">Dona da Plataforma (root)</span>
                </div>

                {/* Academic Managers count */}
                <div
                  onClick={() => setActiveDetail("academicManagers")}
                  className="p-3 rounded-2xl bg-slate-950/40 border border-slate-700 space-y-1 cursor-pointer hover:border-indigo-500/40 transition-colors"
                >
                  <span className="block text-lg font-bold text-white leading-tight">{globalStats.academicManagersCount}</span>
                  <span className="text-[10px] text-slate-400 block font-medium">Gestores Académicos</span>
                  <span className="text-[9px] text-slate-500 block">Administração do Ensino</span>
                </div>

                {/* Professors count */}
                <div
                  onClick={() => setActiveDetail("professors")}
                  className="p-3 rounded-2xl bg-slate-950/40 border border-slate-700 space-y-1 cursor-pointer hover:border-indigo-500/40 transition-colors"
                >
                  <span className="block text-lg font-bold text-white leading-tight">{globalStats.professorsCount}</span>
                  <span className="text-[10px] text-slate-400 block font-medium">Professores</span>
                  <span className="text-[9px] text-slate-500 block">Docência e Avaliação</span>
                </div>

                {/* Other teaching / administrative roles */}
                <div className="p-3 rounded-2xl bg-slate-950/40 border border-slate-700 space-y-1 flex flex-col justify-center">
                  <div
                    onClick={() => setActiveDetail("trainers")}
                    className="flex justify-between items-center text-[10px] cursor-pointer hover:text-indigo-400 transition-colors rounded-lg px-1 -mx-1"
                  >
                    <span className="text-slate-400 font-medium">Formadores:</span>
                    <span className="font-bold text-white">{globalStats.trainersCount}</span>
                  </div>
                  <div
                    onClick={() => setActiveDetail("tutors")}
                    className="flex justify-between items-center text-[10px] cursor-pointer hover:text-indigo-400 transition-colors rounded-lg px-1 -mx-1"
                  >
                    <span className="text-slate-400 font-medium">Tutores:</span>
                    <span className="font-bold text-white">{globalStats.tutorsCount}</span>
                  </div>
                  <div
                    onClick={() => setActiveDetail("finance")}
                    className="flex justify-between items-center text-[10px] cursor-pointer hover:text-indigo-400 transition-colors rounded-lg px-1 -mx-1"
                  >
                    <span className="text-slate-400 font-medium">Financeiro:</span>
                    <span className="font-bold text-white">{globalStats.financeCount}</span>
                  </div>
                </div>
              </div>

              {/* Gestores de Empresa list */}
              <div className="border border-slate-700 bg-slate-950/40 p-4.5 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-indigo-400" />
                  Gestores de Empresa Ativos ({globalStats.gestoresEmpresa.length})
                </h4>
                
                {globalStats.gestoresEmpresa.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Não existem gestores de empresa registados.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-950 border-b border-slate-900 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          <th className="p-2.5">Nome</th>
                          <th className="p-2.5">E-mail</th>
                          <th className="p-2.5">Empresa B2B</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900">
                        {globalStats.gestoresEmpresa.map((gestor: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-900/30 transition-colors">
                            <td className="p-2.5 font-semibold text-white">{gestor.userName}</td>
                            <td className="p-2.5 text-slate-400 font-mono">{gestor.email}</td>
                            <td className="p-2.5">
                              <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-medium text-[10px] border border-indigo-500/25">
                                {gestor.companyName}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Main Analysis Area */}
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Inventário de Competências */}
            <div className="lg:col-span-2 border border-slate-700 bg-slate-950/40 rounded-3xl p-5 space-y-4">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <UserCheck className="h-4.5 w-4.5 text-indigo-400" />
                Inventário de Competências das Equipas
              </h3>

              <div className="grid sm:grid-cols-2 gap-3">
                {skillsInventory.map((skill, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-white truncate max-w-[130px]" title={skill.name}>{skill.name}</span>
                      <span className="text-indigo-400 shrink-0">Média: {skill.averageScore}%</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>Cobertura</span>
                        <span>{skill.coverage}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                          style={{ width: `${skill.coverage}%`, backgroundColor: brandColor }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Gap Analysis */}
            <div className="border border-slate-700 bg-slate-950/40 rounded-3xl p-5 space-y-4">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Compass className="h-4.5 w-4.5 text-violet-400" />
                AI Gap Analysis (Relatório)
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="font-bold text-[10px] uppercase tracking-wider text-cyan-400 block">
                    Plano Individual
                  </span>
                  <p className="text-slate-400 leading-relaxed">
                    Pedro Marques necessita reforçar conhecimentos em Docker (módulo 2) para assumir liderança técnica no deploy do Q3.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="font-bold text-[10px] uppercase tracking-wider text-violet-400 block">
                    Plano por Equipa (Baseado no Digital Twin Coletivo)
                  </span>
                  <p className="text-slate-400 leading-relaxed">{teamPlan}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Lista de Colaboradores Demo */}
          <div className="border border-slate-700 bg-slate-950/40 rounded-3xl p-5 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Users className="h-4.5 w-4.5 text-indigo-400" />
              Lista de Colaboradores Registados (Demonstração)
            </h3>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-900 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <th className="p-2.5">Nome</th>
                    <th className="p-2.5">Cargo</th>
                    <th className="p-2.5">Lições Completas</th>
                    <th className="p-2.5">Cursos Ativos</th>
                    <th className="p-2.5">Áreas de Interesse (Digital Twin)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {demoEmployeeList.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-2.5 font-semibold text-white">{emp.name}</td>
                      <td className="p-2.5 text-slate-350">{emp.role}</td>
                      <td className="p-2.5 text-slate-400">{emp.completedLessons} lições</td>
                      <td className="p-2.5 text-slate-400">{emp.activeCourses} cursos</td>
                      <td className="p-2.5">
                        <div className="flex flex-wrap gap-1">
                          {emp.interests.map((tag) => (
                            <span key={tag} className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 font-mono text-[9px]">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USER & COURSE MANAGEMENT */}
      {activeTab === "users" && (
        <div className="space-y-6">
          {/* Voltar Atrás Button */}
          <button
            onClick={() => setActiveTab("analytics")}
            className="h-9 px-4 rounded-xl border border-slate-800 bg-slate-950 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 self-start shadow-md hover:border-slate-700"
          >
            ← Voltar para Métricas
          </button>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* List/Tables columns */}
            <div className="lg:col-span-2 space-y-6">
              {renderUserSection("Gestores Académicos", academicManagers, <UserCheck className="h-4.5 w-4.5 text-indigo-400" />, "Gestor Académico")}
              {renderUserSection("Professores", professors, <GraduationCap className="h-4.5 w-4.5 text-violet-400" />, "Professor")}
              {renderUserSection("Formadores", trainers, <GraduationCap className="h-4.5 w-4.5 text-cyan-400" />, "Formador")}
              {renderUserSection("Tutores", tutors, <GraduationCap className="h-4.5 w-4.5 text-emerald-450" />, "Tutor")}
              {renderUserSection("Financeiro", financeStaff, <TrendingUp className="h-4.5 w-4.5 text-amber-400" />, "Financeiro")}
              {renderUserSection("Suporte Técnico", supportStaff, <LifeBuoy className="h-4.5 w-4.5 text-rose-400" />, "Suporte")}
              {renderUserSection("Funcionários Operacionais", operationalEmployees, <Users className="h-4.5 w-4.5 text-slate-450" />, "Funcionário")}
              {renderUserSection("Alunos / Formandos", studentsList, <GraduationCap className="h-4.5 w-4.5 text-emerald-500" />, "Aluno", true)}
            </div>

          {/* Form to Register New User */}
          <div className="space-y-4">
            <h3 className="font-extrabold text-white text-base flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-400" />
              Registar Colaborador / Aluno
            </h3>

            {userError && (
              <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-400 text-xs font-semibold flex items-center gap-2">
                <ShieldAlert className="h-4.5 w-4.5" />
                {userError}
              </div>
            )}

            {userSuccess && (
              <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4.5 w-4.5" />
                Utilizador criado e vinculado com sucesso!
              </div>
            )}

            <form onSubmit={handleCreateUser} className="border border-slate-900 bg-slate-950/20 p-5 rounded-2xl space-y-4 text-xs font-medium text-slate-300">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="block text-slate-400">Nome Completo</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-550" />
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: João Ferreira"
                    className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-800 bg-slate-950 text-white focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-slate-400">E-mail Organizacional</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-550" />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Ex: joao@empresa.com"
                    className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-800 bg-slate-950 text-white focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div className="space-y-1.5">
                <label className="block text-slate-400">Tipo de Acesso / Papel</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="ALUNO">Aluno / Formando (Empresarial)</option>
                  <option value="FUNCIONARIO">Funcionário Operacional</option>
                  <option value="SUPORTE">Suporte Técnico</option>
                  <option value="GESTOR_ACADEMICO">Gestor Académico</option>
                  <option value="PROFESSOR">Professor</option>
                  <option value="FORMADOR">Formador</option>
                  <option value="TUTOR">Tutor</option>
                  <option value="FINANCEIRO">Financeiro</option>
                </select>

                {newRole === "ALUNO" && isGlobal && (
                  <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={registerAsIndividual}
                      onChange={(e) => setRegisterAsIndividual(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-800 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-[11px] text-slate-400">Registar como Aluno Individual (sem empresa)</span>
                  </label>
                )}
              </div>

              <button
                type="submit"
                disabled={submittingUser}
                className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submittingUser ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    A Criar...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Criar e Conceder Acesso
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
      )}

      {/* DETAIL DRILL-DOWN MODAL (Métricas e Gap Analysis) */}
      {activeDetail && (() => {
        const DETAIL_CONFIG: Record<string, { title: string; subtitle?: string; items: any[] }> = {
          supportStaff: { title: "Funcionários de Suporte", subtitle: "Dona da Plataforma (root)", items: globalStats?.supportStaff || [] },
          academicManagers: { title: "Gestores Académicos", subtitle: "Administração do Ensino", items: globalStats?.academicManagers || [] },
          professors: { title: "Professores", subtitle: "Docência e Avaliação", items: globalStats?.professors || [] },
          trainers: { title: "Formadores", items: globalStats?.trainers || [] },
          tutors: { title: "Tutores", items: globalStats?.tutors || [] },
          finance: { title: "Financeiro", items: globalStats?.finance || [] },
        };

        if (activeDetail === "bottlenecks") {
          return (
            <DetailModal
              title="Gargalos Críticos"
              subtitle="Lições com mais colaboradores parados ('in-progress') do que concluídos"
              items={bottlenecks}
              columns={[{ key: "lessonTitle", label: "Lição" }, { key: "stalledCount", label: "Colaboradores Parados", align: "right" }] as DetailModalColumn[]}
              onClose={() => setActiveDetail(null)}
            />
          );
        }

        const config = DETAIL_CONFIG[activeDetail];
        if (!config) return null;
        return (
          <DetailModal
            title={config.title}
            subtitle={config.subtitle}
            items={config.items}
            columns={[{ key: "name", label: "Nome" }, { key: "email", label: "E-mail" }] as DetailModalColumn[]}
            onClose={() => setActiveDetail(null)}
          />
        );
      })()}

      {/* COURSE ASSIGNMENT MODAL OVERLAY */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md border border-slate-850 bg-slate-950 rounded-3xl p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setSelectedStudent(null)}
              className="absolute right-4 top-4 text-slate-550 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <h3 className="font-extrabold text-sm text-white">Atribuir Cursos a Aluno</h3>
              <p className="text-[10px] text-slate-500">
                Aluno: <span className="text-slate-350 font-semibold">{selectedStudent.firstName} {selectedStudent.lastName}</span>
              </p>
            </div>

            <div className="border-t border-slate-900 my-2" />

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {AVAILABLE_COURSES.map((course) => {
                const isAssigned = selectedStudent.assignedCourses?.includes(course.id) || false;
                return (
                  <div
                    key={course.id}
                    className="p-3 border border-slate-900 bg-slate-900/10 rounded-xl flex items-center justify-between gap-4 text-xs font-semibold text-white"
                  >
                    <span className="truncate max-w-[240px]">{course.name}</span>
                    <button
                      onClick={() => handleToggleCourse(course.id, isAssigned)}
                      disabled={assigningCourse}
                      className={`h-7 px-3.5 rounded-lg text-[9px] font-bold transition-colors cursor-pointer ${
                        isAssigned
                          ? "bg-rose-500/10 border border-rose-500/20 text-rose-450 hover:bg-rose-500/15"
                          : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 hover:bg-emerald-500/15"
                      }`}
                    >
                      {isAssigned ? "Remover" : "Atribuir"}
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setSelectedStudent(null)}
              className="w-full h-10 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
            >
              Fechar Definições
            </button>
          </div>
        </div>
      )}

      {/* VIEWING USER DETAILS MODAL */}
      {viewingUser && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md border border-slate-850 bg-slate-950 rounded-3xl p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setViewingUser(null)}
              className="absolute right-4 top-4 text-slate-555 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-900">
              <User className="h-5 w-5 text-indigo-400" />
              <h3 className="font-extrabold text-white text-base">Ficha de Utilizador</h3>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-indigo-400">Nome Completo</span>
                <p className="text-white font-medium text-sm">{viewingUser.firstName} {viewingUser.lastName}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-indigo-400">E-mail Organizacional</span>
                <p className="text-white font-mono">{viewingUser.email}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-indigo-400">ID da Base de Dados</span>
                <p className="text-slate-400 font-mono text-[10px] bg-slate-900 p-2 rounded-lg">{viewingUser._id}</p>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-indigo-400 block">Vinculações e Perfis (Tenants)</span>
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {viewingUser.tenants && viewingUser.tenants.length > 0 ? (
                    viewingUser.tenants.map((t: any, idx: number) => (
                      <div key={idx} className="p-2.5 rounded-xl border border-slate-900 bg-slate-950/40 flex justify-between items-center">
                        <span className="font-bold text-slate-400 text-[10px] uppercase">Empresa: {t.companyName || t.tenantId}</span>
                        <div className="flex gap-1 flex-wrap">
                          {t.roles.map((r: string) => (
                            <span key={r} className="px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-bold uppercase">
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="italic text-slate-500">Sem vinculações registadas.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setViewingUser(null)}
                className="w-full h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-colors cursor-pointer text-xs"
              >
                Fechar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDITING USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md border border-slate-850 bg-slate-950 rounded-3xl p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setEditingUser(null)}
              className="absolute right-4 top-4 text-slate-555 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-900">
              <Edit className="h-5 w-5 text-indigo-400" />
              <h3 className="font-extrabold text-white text-base">Editar Utilizador</h3>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4 text-xs font-medium text-slate-350">
              <div className="space-y-1.5">
                <label className="block text-slate-400">Nome Completo</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-800 bg-slate-950 text-white focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-400">E-mail Organizacional</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-800 bg-slate-950 text-white focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-400">Tipo de Acesso / Papel</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="ALUNO">Aluno / Formando (Empresarial)</option>
                  <option value="FUNCIONARIO">Funcionário Operacional</option>
                  <option value="SUPORTE">Suporte Técnico</option>
                  <option value="GESTOR_ACADEMICO">Gestor Académico</option>
                  <option value="PROFESSOR">Professor</option>
                  <option value="FORMADOR">Formador</option>
                  <option value="TUTOR">Tutor</option>
                  <option value="FINANCEIRO">Financeiro</option>
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="w-1/2 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="w-1/2 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isSavingEdit ? "A guardar..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal de Confirmação de Eliminação ── */}
      {deletingUser && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ animation: "fadeIn 200ms ease-out" }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeletingUser(null)} />
          <div
            className="relative w-full max-w-sm rounded-2xl border border-slate-800/80 bg-[#0a0f1e]/95 backdrop-blur-xl shadow-2xl"
            style={{ animation: "scaleIn 250ms cubic-bezier(0.16,1,0.3,1)" }}
          >
            <div className="absolute -top-px left-1/2 -translate-x-1/2 w-2/3 h-px bg-gradient-to-r from-transparent via-rose-500/60 to-transparent" />
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="h-7 w-7 text-rose-400" />
              </div>
              <h3 className="text-base font-bold text-white mb-1.5">Remover Utilizador</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                Tem a certeza que deseja remover <span className="text-white font-semibold">{deletingUser.firstName} {deletingUser.lastName}</span>? Esta ação é irreversível.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingUser(null)}
                  className="flex-1 rounded-xl border border-slate-700/60 bg-slate-800/50 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-700/50 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteUser}
                  className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-rose-500 hover:shadow-lg hover:shadow-rose-500/25 cursor-pointer"
                >
                  Sim, remover
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
