"use client";

import React, { useState, useEffect } from "react";
import { GraduationCap, Loader2, ShieldAlert, Save, Rocket, CheckCircle2 } from "lucide-react";
import { useAccess } from "@/hooks/use-access";
import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";

const REVIEWER_ROLES = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA"];

interface CourseOption {
  id: string;
  title: string;
  category: string;
}

export default function AcademyPage() {
  const { activeRole, isLoading: loadingRole } = useAccess();
  const { showToast } = useToast();
  const confirmDialog = useConfirm();
  const canAccess = !!activeRole && REVIEWER_ROLES.includes(activeRole);

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [academyName, setAcademyName] = useState("");
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const loadData = async () => {
    try {
      const [catalogRes, academyRes] = await Promise.all([
        fetch("/api/catalog"),
        fetch("/api/admin/academy"),
      ]);

      if (catalogRes.ok) {
        const data = await catalogRes.json();
        setCourses((data.courses || []).map((c: any) => ({ id: c._id, title: c.title, category: c.category || "Formação" })));
      }

      if (academyRes.ok) {
        const data = await academyRes.json();
        setAcademyName(data.academyName || "");
        setSelectedCourseIds(new Set(data.courseIds || []));
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

  const toggleCourse = (id: string) => {
    setSelectedCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/academy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academyName, courseIds: Array.from(selectedCourseIds) }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Currículo da Academia Corporativa guardado.", "success");
      } else {
        showToast(data.error || "Erro ao guardar.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao guardar.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyAll = async () => {
    if (selectedCourseIds.size === 0) {
      showToast("Escolha pelo menos um curso para o currículo antes de aplicar.", "error");
      return;
    }
    const confirmed = await confirmDialog({
      title: "Aplicar Currículo a Todos os Colaboradores",
      message: "Isto atribui todos os cursos do currículo atual a todos os colaboradores da empresa que ainda não os tenham. Não remove nenhuma atribuição existente. Continuar?",
      confirmLabel: "Aplicar a Todos",
    });
    if (!confirmed) return;

    setIsApplying(true);
    try {
      const res = await fetch("/api/admin/academy/apply-all", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success", 6000);
      } else {
        showToast(data.error || "Erro ao aplicar o currículo.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao aplicar o currículo.", "error");
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
          Defina o currículo próprio da sua empresa — um subconjunto curado do catálogo, com identidade própria, distinto do catálogo geral da MOZAI.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          <span className="text-xs font-medium">A carregar...</span>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-1 space-y-6">
            <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Nome da Academia
              </label>
              <input
                value={academyName}
                onChange={(e) => setAcademyName(e.target.value)}
                placeholder="Ex: Academia ACME"
                className="w-full h-10 rounded-xl bg-slate-950 border border-slate-900 px-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
              />
              <p className="text-[10px] text-slate-600 leading-relaxed">
                {selectedCourseIds.size} curso(s) selecionado(s) para o currículo.
              </p>

              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar Currículo
              </button>

              <button
                onClick={handleApplyAll}
                disabled={isApplying}
                className="w-full h-10 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-xs font-semibold text-emerald-400 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
              >
                {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                Aplicar a Todos os Colaboradores
              </button>
              <p className="text-[9px] text-slate-600 leading-relaxed">
                Atribui os cursos do currículo a todos os colaboradores atuais que ainda não os tenham. Nunca remove atribuições existentes.
              </p>
            </div>
          </div>

          <div className="lg:col-span-2 border border-slate-900 bg-slate-900/10 rounded-3xl p-6 space-y-3">
            <h3 className="font-bold text-sm text-white">Escolha os Cursos do Currículo</h3>
            {courses.length === 0 ? (
              <p className="text-xs text-slate-500">Sem cursos disponíveis no catálogo neste momento.</p>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {courses.map((course) => {
                  const isSelected = selectedCourseIds.has(course.id);
                  return (
                    <div
                      key={course.id}
                      onClick={() => toggleCourse(course.id)}
                      className={`p-3.5 rounded-2xl border cursor-pointer flex items-center justify-between transition-colors ${
                        isSelected ? "border-indigo-500/40 bg-indigo-500/5" : "border-slate-900 bg-slate-950/40 hover:border-slate-800"
                      }`}
                    >
                      <div>
                        <h4 className="font-bold text-xs text-white">{course.title}</h4>
                        <span className="text-[10px] text-slate-500">{course.category}</span>
                      </div>
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-indigo-400 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
