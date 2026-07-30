"use client";

import React, { useState, useEffect } from "react";
import { GraduationCap, Loader2, ShieldAlert, Save, Rocket, CheckCircle2, Plus, Trash2, X, Briefcase, Users, Building2, Layers } from "lucide-react";
import { useAccess } from "@/hooks/use-access";
import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";

const REVIEWER_ROLES = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA"];
const TRACK_AREAS = ["Técnica", "Comercial", "RH", "Liderança", "Personalizada"] as const;

const AREA_ICONS: Record<string, React.ElementType> = {
  "Técnica": Layers,
  "Comercial": Briefcase,
  "RH": Users,
  "Liderança": Building2,
  "Personalizada": GraduationCap,
};

interface CourseOption {
  id: string;
  title: string;
  category: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
}

interface Track {
  _id: string;
  name: string;
  area: string;
  courseIds: string[];
}

export default function AcademyPage() {
  const { activeRole, isLoading: loadingRole } = useAccess();
  const { showToast } = useToast();
  const confirmDialog = useConfirm();
  const canAccess = !!activeRole && REVIEWER_ROLES.includes(activeRole);

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTrackName, setNewTrackName] = useState("");
  const [newTrackArea, setNewTrackArea] = useState<string>(TRACK_AREAS[0]);

  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const loadData = async () => {
    try {
      const [catalogRes, tracksRes] = await Promise.all([fetch("/api/catalog"), fetch("/api/admin/academy/tracks")]);

      if (catalogRes.ok) {
        const data = await catalogRes.json();
        setCourses((data.courses || []).map((c: any) => ({ id: c._id, title: c.title, category: c.category || "Formação" })));
      }
      if (tracksRes.ok) {
        const data = await tracksRes.json();
        setTracks(data.tracks || []);
        setEmployees(data.employees || []);
      }
    } catch (error) {
      console.error("Erro ao carregar a Academia Corporativa:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canAccess) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  const editingTrack = tracks.find((t) => t._id === editingTrackId) || null;

  const openEditor = (track: Track) => {
    setEditingTrackId(track._id);
    setSelectedCourseIds(new Set(track.courseIds));
    setSelectedEmployeeIds(new Set());
  };

  const handleCreateTrack = async () => {
    if (!newTrackName.trim()) {
      showToast("Indique um nome para a nova trilha.", "error");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/academy/tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTrackName.trim(), area: newTrackArea, courseIds: [] }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Trilha "${newTrackName.trim()}" criada.`, "success");
        setNewTrackName("");
        loadData();
      } else {
        showToast(data.error || "Erro ao criar a trilha.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao criar a trilha.", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTrack = async (track: Track) => {
    const confirmed = await confirmDialog({
      title: `Eliminar Trilha "${track.name}"`,
      message: "Isto elimina a trilha, mas não remove os cursos já atribuídos aos colaboradores. Continuar?",
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/admin/academy/tracks/${track._id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Trilha eliminada.", "success");
        if (editingTrackId === track._id) setEditingTrackId(null);
        loadData();
      }
    } catch {
      showToast("Erro ao eliminar a trilha.", "error");
    }
  };

  const toggleCourse = (id: string) => {
    setSelectedCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleEmployee = (id: string) => {
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSaveCourses = async () => {
    if (!editingTrackId) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/academy/tracks/${editingTrackId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseIds: Array.from(selectedCourseIds) }),
      });
      if (res.ok) {
        showToast("Cursos da trilha guardados.", "success");
        loadData();
      }
    } catch {
      showToast("Erro ao guardar os cursos.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleApply = async () => {
    if (!editingTrackId) return;
    if (selectedCourseIds.size === 0) {
      showToast("Adicione pelo menos um curso à trilha antes de aplicar.", "error");
      return;
    }
    const targetLabel = selectedEmployeeIds.size > 0 ? `${selectedEmployeeIds.size} colaborador(es) selecionado(s)` : "TODOS os colaboradores da empresa";
    const confirmed = await confirmDialog({
      title: "Aplicar Trilha",
      message: `Isto atribui os cursos desta trilha a ${targetLabel} que ainda não os tenham. Não remove nenhuma atribuição existente. Continuar?`,
      confirmLabel: "Aplicar",
    });
    if (!confirmed) return;

    setIsApplying(true);
    try {
      const res = await fetch(`/api/admin/academy/tracks/${editingTrackId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeIds: Array.from(selectedEmployeeIds) }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success", 6000);
      } else {
        showToast(data.error || "Erro ao aplicar a trilha.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao aplicar a trilha.", "error");
    } finally {
      setIsApplying(false);
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
          Só Administradores, Suporte ou o Gestor de Empresa podem gerir a Academia Corporativa.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <GraduationCap className="h-7 w-7 text-indigo-400" />
          Academia Corporativa
        </h1>
        <p className="text-sm text-slate-400">
          Crie trilhas distintas por área (Técnica, Comercial, RH, Liderança) — cada uma com o seu próprio percurso de cursos e colaboradores atribuídos.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          <span className="text-xs font-medium">A carregar...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Criar nova trilha */}
          <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 flex flex-col sm:flex-row gap-3">
            <input
              value={newTrackName}
              onChange={(e) => setNewTrackName(e.target.value)}
              placeholder="Nome da trilha (ex: Trilha de Vendas Consultivas)"
              className="flex-1 h-10 px-3 rounded-xl bg-slate-950 border border-slate-900 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
            />
            <select
              value={newTrackArea}
              onChange={(e) => setNewTrackArea(e.target.value)}
              className="h-10 px-3 rounded-xl bg-slate-950 border border-slate-900 text-xs text-white focus:outline-none focus:border-indigo-500/50"
            >
              {TRACK_AREAS.map((area) => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
            <button
              onClick={handleCreateTrack}
              disabled={creating}
              className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all flex items-center gap-2 cursor-pointer disabled:opacity-55 shrink-0"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Nova Trilha
            </button>
          </div>

          {/* Lista de trilhas */}
          {tracks.length === 0 ? (
            <div className="border border-slate-900 border-dashed rounded-3xl p-10 text-center">
              <span className="text-xs text-slate-500">Ainda não criou nenhuma trilha. Comece por criar uma acima.</span>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {tracks.map((track) => {
                const AreaIcon = AREA_ICONS[track.area] || GraduationCap;
                return (
                  <div key={track._id} className="border border-slate-900 bg-slate-900/10 rounded-2xl p-4 flex items-center justify-between gap-3">
                    <button onClick={() => openEditor(track)} className="flex items-center gap-3 min-w-0 text-left cursor-pointer">
                      <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                        <AreaIcon className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-white truncate">{track.name}</h4>
                        <span className="text-[10px] text-slate-500">{track.area} · {track.courseIds.length} curso(s)</span>
                      </div>
                    </button>
                    <button
                      onClick={() => handleDeleteTrack(track)}
                      className="h-7 w-7 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 flex items-center justify-center cursor-pointer shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Editor de trilha selecionada */}
          {editingTrack && (
            <div className="border border-indigo-500/20 bg-slate-900/10 rounded-3xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-white">Editar: {editingTrack.name}</h3>
                <button onClick={() => setEditingTrackId(null)} className="text-slate-500 hover:text-white cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* Cursos */}
                <div className="space-y-3">
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Cursos da Trilha ({selectedCourseIds.size})</h4>
                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {courses.map((course) => {
                      const isSelected = selectedCourseIds.has(course.id);
                      return (
                        <div
                          key={course.id}
                          onClick={() => toggleCourse(course.id)}
                          className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                            isSelected ? "border-indigo-500/40 bg-indigo-500/5" : "border-slate-900 bg-slate-950/40 hover:border-slate-800"
                          }`}
                        >
                          <div className="min-w-0">
                            <h5 className="font-bold text-[11px] text-white truncate">{course.title}</h5>
                            <span className="text-[9px] text-slate-500">{course.category}</span>
                          </div>
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-indigo-400 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={handleSaveCourses}
                    disabled={isSaving}
                    className="w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Guardar Cursos
                  </button>
                </div>

                {/* Colaboradores */}
                <div className="space-y-3">
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Aplicar a ({selectedEmployeeIds.size > 0 ? `${selectedEmployeeIds.size} selecionado(s)` : "todos os colaboradores"})
                  </h4>
                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {employees.length === 0 ? (
                      <p className="text-xs text-slate-500">Sem colaboradores registados nesta empresa.</p>
                    ) : (
                      employees.map((employee) => {
                        const isSelected = selectedEmployeeIds.has(employee.id);
                        return (
                          <div
                            key={employee.id}
                            onClick={() => toggleEmployee(employee.id)}
                            className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                              isSelected ? "border-emerald-500/40 bg-emerald-500/5" : "border-slate-900 bg-slate-950/40 hover:border-slate-800"
                            }`}
                          >
                            <div className="min-w-0">
                              <h5 className="font-bold text-[11px] text-white truncate">{employee.name}</h5>
                              <span className="text-[9px] text-slate-500 truncate block">{employee.email}</span>
                            </div>
                            {isSelected && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                  <p className="text-[9px] text-slate-600">
                    Não selecione ninguém para aplicar a trilha a todos os colaboradores atuais da empresa.
                  </p>
                  <button
                    onClick={handleApply}
                    disabled={isApplying}
                    className="w-full h-9 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-xs font-semibold text-emerald-400 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
                  >
                    {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                    Aplicar Trilha
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
