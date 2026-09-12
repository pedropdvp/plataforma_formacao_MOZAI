"use client";

import React, { useState, useEffect } from "react";
import { Users2, Loader2, ShieldAlert, Plus, Trash2, BookOpen, UserCheck, GraduationCap } from "lucide-react";
import { useAccess } from "@/hooks/use-access";
import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ASSIGNER_ROLES, TEACHING_ROLE_LABELS as ROLE_LABELS } from "@/lib/academic-roles";

interface CourseOption {
  id: string;
  title: string;
}

interface Person {
  id: string;
  name: string;
  email: string;
  roles?: string[];
}

interface Assignment {
  _id: string;
  staffId: string;
  staffRole: string;
  scope: "course" | "student";
  courseId?: string;
  studentId?: string;
}

export default function AcademicsPage() {
  const { activeRole, isLoading: loadingRole } = useAccess();
  const { showToast } = useToast();
  const confirmDialog = useConfirm();
  const canAccess = !!activeRole && ASSIGNER_ROLES.includes(activeRole);

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [staff, setStaff] = useState<Person[]>([]);
  const [students, setStudents] = useState<Person[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [courseToAdd, setCourseToAdd] = useState("");
  const [studentToAdd, setStudentToAdd] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      const [catalogRes, assignmentsRes] = await Promise.all([
        fetch("/api/catalog"),
        fetch("/api/admin/academics/assignments"),
      ]);

      if (catalogRes.ok) {
        const data = await catalogRes.json();
        setCourses((data.courses || []).map((c: any) => ({ id: c._id, title: c.title })));
      }
      if (assignmentsRes.ok) {
        const data = await assignmentsRes.json();
        setAssignments(data.assignments || []);
        setStaff(data.staff || []);
        setStudents(data.students || []);
      }
    } catch (error) {
      console.error("Erro ao carregar o corpo docente:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canAccess) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  const selectedStaff = staff.find((s) => s.id === selectedStaffId) || null;
  const assignmentsOf = (staffId: string) => assignments.filter((a) => a.staffId === staffId);
  const courseTitle = (courseId?: string) =>
    courses.find((c) => c.id === courseId)?.title || courseId || "Curso removido do catálogo";
  const studentName = (studentId?: string) =>
    students.find((s) => s.id === studentId)?.name || studentId || "Aluno removido";

  const criar = async (payload: Record<string, unknown>, sucesso: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/academics/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.alreadyExists ? "Esta atribuição já existia." : sucesso, "success");
        setCourseToAdd("");
        setStudentToAdd("");
        loadData();
      } else {
        showToast(data.error || "Não foi possível guardar a atribuição.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao guardar a atribuição.", "error");
    } finally {
      setSaving(false);
    }
  };

  const remover = async (assignment: Assignment) => {
    const alvo =
      assignment.scope === "course"
        ? `o curso "${courseTitle(assignment.courseId)}"`
        : `a tutela de ${studentName(assignment.studentId)}`;
    const confirmed = await confirmDialog({
      title: "Remover atribuição",
      message: `Isto retira ${alvo} deste docente. Os alunos mantêm os cursos e o progresso — só deixa de os ter à sua responsabilidade. Continuar?`,
      confirmLabel: "Remover",
      destructive: true,
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/academics/assignments?id=${assignment._id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Atribuição removida.", "success");
        loadData();
      } else {
        showToast("Não foi possível remover a atribuição.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao remover a atribuição.", "error");
    }
  };

  if (loadingRole) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        <span className="text-sm font-semibold">A verificar permissões...</span>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center text-center space-y-4 px-6">
        <div className="p-4 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-white">Acesso Restrito</h1>
        <p className="text-sm text-slate-400 max-w-[420px]">
          Só Administradores, Suporte, Gestores de Empresa ou Gestores Académicos podem gerir o corpo docente.
        </p>
      </div>
    );
  }

  const cursosAtribuidos = selectedStaff ? assignmentsOf(selectedStaff.id).filter((a) => a.scope === "course") : [];
  const tutelas = selectedStaff ? assignmentsOf(selectedStaff.id).filter((a) => a.scope === "student") : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <Users2 className="h-7 w-7 text-indigo-400" />
          Corpo Docente
        </h1>
        <p className="text-sm text-slate-400 max-w-[70ch]">
          Defina por que cursos cada docente é responsável. Os alunos desses cursos passam a constar da
          lista do docente automaticamente — não é preciso ligá-los um a um. A tutela direta existe para
          acompanhar um aluno que não esteja num curso do docente.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          <span className="text-xs font-medium">A carregar...</span>
        </div>
      ) : staff.length === 0 ? (
        <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-8 text-center space-y-2">
          <GraduationCap className="h-8 w-8 text-slate-700 mx-auto" />
          <p className="text-sm text-slate-400">Esta empresa ainda não tem nenhum docente.</p>
          <p className="text-xs text-slate-600">
            Atribua o perfil de Professor, Formador, Tutor ou Gestor Académico a um utilizador para o ver aqui.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-5">
          {/* Docentes */}
          <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-4 space-y-2 h-fit">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 px-1">
              Docentes ({staff.length})
            </span>
            {staff.map((pessoa) => {
              const total = assignmentsOf(pessoa.id).length;
              const ativo = pessoa.id === selectedStaffId;
              return (
                <button
                  key={pessoa.id}
                  onClick={() => setSelectedStaffId(pessoa.id)}
                  className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer ${
                    ativo
                      ? "border-indigo-500/40 bg-indigo-600/10"
                      : "border-slate-900 bg-slate-950 hover:border-slate-800"
                  }`}
                >
                  <span className="text-xs font-bold text-white block truncate">{pessoa.name}</span>
                  <span className="text-[10px] text-slate-500 block truncate">{pessoa.email}</span>
                  <span className="text-[10px] text-indigo-300/80 block mt-1">
                    {(pessoa.roles || []).map((r) => ROLE_LABELS[r] || r).join(" · ")}
                    {total > 0 && <span className="text-slate-500"> — {total} atribuição(ões)</span>}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Atribuições do docente selecionado */}
          {!selectedStaff ? (
            <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-10 flex items-center justify-center">
              <span className="text-xs text-slate-500">Escolha um docente para ver e editar as suas responsabilidades.</span>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Cursos */}
              <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-indigo-400" />
                  Cursos à responsabilidade ({cursosAtribuidos.length})
                </h3>

                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={courseToAdd}
                    onChange={(e) => setCourseToAdd(e.target.value)}
                    className="flex-1 h-10 px-3 rounded-xl bg-slate-950 border border-slate-900 text-xs text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                  >
                    <option value="">Escolher curso do catálogo…</option>
                    {courses
                      .filter((c) => !cursosAtribuidos.some((a) => a.courseId === c.id))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() =>
                      criar(
                        { staffId: selectedStaff.id, scope: "course", courseId: courseToAdd },
                        "Curso atribuído ao docente."
                      )
                    }
                    disabled={!courseToAdd || saving}
                    className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-55 shrink-0"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Atribuir curso
                  </button>
                </div>

                {cursosAtribuidos.length === 0 ? (
                  <p className="text-xs text-slate-600">
                    Sem cursos atribuídos — este docente ainda não tem alunos por esta via.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {cursosAtribuidos.map((a) => (
                      <div
                        key={a._id}
                        className="flex items-center justify-between gap-3 p-3 bg-slate-950 border border-slate-900 rounded-xl"
                      >
                        <span className="text-xs text-slate-300 truncate">{courseTitle(a.courseId)}</span>
                        <button
                          onClick={() => remover(a)}
                          title="Remover atribuição"
                          className="text-slate-600 hover:text-rose-400 transition-colors cursor-pointer shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tutela direta */}
              <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-emerald-400" />
                  Alunos em tutela direta ({tutelas.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Use isto para acompanhar um aluno que não esteja num curso deste docente. Para os alunos
                  de um curso, basta atribuir o curso acima.
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={studentToAdd}
                    onChange={(e) => setStudentToAdd(e.target.value)}
                    className="flex-1 h-10 px-3 rounded-xl bg-slate-950 border border-slate-900 text-xs text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                  >
                    <option value="">Escolher aluno…</option>
                    {students
                      .filter((s) => !tutelas.some((a) => a.studentId === s.id))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} — {s.email}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() =>
                      criar(
                        { staffId: selectedStaff.id, scope: "student", studentId: studentToAdd },
                        "Aluno atribuído em tutela."
                      )
                    }
                    disabled={!studentToAdd || saving}
                    className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-55 shrink-0"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Atribuir aluno
                  </button>
                </div>

                {tutelas.length === 0 ? (
                  <p className="text-xs text-slate-600">Sem alunos em tutela direta.</p>
                ) : (
                  <div className="space-y-2">
                    {tutelas.map((a) => (
                      <div
                        key={a._id}
                        className="flex items-center justify-between gap-3 p-3 bg-slate-950 border border-slate-900 rounded-xl"
                      >
                        <span className="text-xs text-slate-300 truncate">{studentName(a.studentId)}</span>
                        <button
                          onClick={() => remover(a)}
                          title="Remover tutela"
                          className="text-slate-600 hover:text-rose-400 transition-colors cursor-pointer shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
