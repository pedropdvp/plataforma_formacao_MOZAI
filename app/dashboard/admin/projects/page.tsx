"use client";

import React, { useState, useEffect } from "react";
import {
  FolderKanban,
  Loader2,
  Link as LinkIcon,
  Paperclip,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Hourglass,
  Clock,
  X,
} from "lucide-react";
import { useAccess } from "@/hooks/use-access";
import { useToast } from "@/components/ui/toast-provider";

interface ProjectSubmission {
  _id: string;
  userId: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  title: string;
  description: string;
  repoUrl: string | null;
  fileUrl: string | null;
  fileName: string | null;
  status: "submitted" | "reviewing" | "approved" | "rejected";
  grade: number | null;
  feedback: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

const STATUS_CONFIG: Record<ProjectSubmission["status"], { label: string; color: string; icon: React.ElementType }> = {
  submitted: { label: "Por Avaliar", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: Hourglass },
  reviewing: { label: "Em Avaliação", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20", icon: Clock },
  approved: { label: "Aprovado", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 },
  rejected: { label: "Rejeitado", color: "text-rose-400 bg-rose-500/10 border-rose-500/20", icon: XCircle },
};

const REVIEWER_ROLES = ["ADMIN", "SUPORTE", "PROFESSOR", "GESTOR_ACADEMICO"];

export default function AdminProjectsPage() {
  const { activeRole, isLoading: loadingRole } = useAccess();
  const { showToast } = useToast();
  const canAccess = !!activeRole && REVIEWER_ROLES.includes(activeRole);

  const [submissions, setSubmissions] = useState<ProjectSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | ProjectSubmission["status"]>("submitted");
  const [reviewTarget, setReviewTarget] = useState<ProjectSubmission | null>(null);
  const [gradeInput, setGradeInput] = useState("");
  const [feedbackInput, setFeedbackInput] = useState("");
  const [isSavingReview, setIsSavingReview] = useState(false);

  const loadSubmissions = async () => {
    try {
      const res = await fetch("/api/admin/projects");
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
      }
    } catch (error) {
      console.error("Erro ao carregar submissões de projetos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canAccess) loadSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  const openReview = (submission: ProjectSubmission) => {
    setReviewTarget(submission);
    setGradeInput(submission.grade !== null ? String(submission.grade) : "");
    setFeedbackInput(submission.feedback || "");
  };

  const handleReview = async (status: "approved" | "rejected") => {
    if (!reviewTarget) return;

    if (status === "approved" && (gradeInput.trim() === "" || Number(gradeInput) < 0 || Number(gradeInput) > 100)) {
      showToast("Indique uma nota entre 0 e 100 para aprovar o projeto.", "error");
      return;
    }

    setIsSavingReview(true);
    try {
      const res = await fetch(`/api/admin/projects/${reviewTarget._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          grade: gradeInput.trim() !== "" ? Number(gradeInput) : null,
          feedback: feedbackInput.trim() || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(status === "approved" ? "Projeto aprovado com sucesso." : "Projeto rejeitado.", "success");
        setReviewTarget(null);
        loadSubmissions();
      } else {
        showToast(data.error || "Erro ao registar avaliação.", "error");
      }
    } catch (error: any) {
      showToast(error?.message || "Erro ao registar avaliação.", "error");
    } finally {
      setIsSavingReview(false);
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
          Só Administradores, Professores ou Gestores Académicos podem avaliar projetos submetidos pelos alunos.
        </p>
      </div>
    );
  }

  const filteredSubmissions = filter === "all" ? submissions : submissions.filter((s) => s.status === filter);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <FolderKanban className="h-7 w-7 text-cyan-400" />
          Avaliação de Projetos
        </h1>
        <p className="text-sm text-slate-400">
          Reveja os projetos práticos submetidos pelos alunos, atribua uma nota e dê feedback.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {(["submitted", "reviewing", "approved", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-8 px-3.5 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
              filter === f
                ? "bg-indigo-600/10 border-indigo-500/30 text-white"
                : "border-slate-900 text-slate-400 hover:border-slate-800"
            }`}
          >
            {f === "all" ? "Todos" : STATUS_CONFIG[f].label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
          <span className="text-xs font-medium">A carregar submissões...</span>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="border border-slate-900 border-dashed rounded-3xl p-10 text-center">
          <span className="text-xs text-slate-500">Nenhuma submissão encontrada para este filtro.</span>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSubmissions.map((s) => {
            const cfg = STATUS_CONFIG[s.status];
            const StatusIcon = cfg.icon;
            return (
              <div key={s._id} className="border border-slate-900 bg-slate-950/40 rounded-2xl p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-white">{s.title}</h4>
                    <span className="text-[11px] text-slate-500">{s.studentName} · {s.courseTitle}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border self-start sm:self-auto flex items-center gap-1.5 ${cfg.color}`}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {cfg.label}
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">{s.description}</p>

                <div className="flex flex-wrap items-center gap-3 text-[11px]">
                  {s.repoUrl && (
                    <a href={s.repoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300">
                      <LinkIcon className="h-3.5 w-3.5" /> Repositório
                    </a>
                  )}
                  {s.fileUrl && (
                    <a href={s.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300">
                      <Paperclip className="h-3.5 w-3.5" /> {s.fileName || "Ficheiro"}
                    </a>
                  )}
                  <span className="text-slate-600">Submetido em {new Date(s.submittedAt).toLocaleDateString("pt-PT")}</span>
                </div>

                <button
                  onClick={() => openReview(s)}
                  className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all cursor-pointer"
                >
                  {s.status === "approved" || s.status === "rejected" ? "Rever Avaliação" : "Avaliar Projeto"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Avaliação */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0b0f19] border border-slate-900 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl p-6 relative space-y-4">
            <button
              onClick={() => setReviewTarget(null)}
              className="absolute right-4 top-4 h-8 w-8 rounded-full border border-slate-900 bg-slate-950/50 flex items-center justify-center text-slate-500 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div>
              <h3 className="font-bold text-white text-base">{reviewTarget.title}</h3>
              <span className="text-[11px] text-slate-500">{reviewTarget.studentName} · {reviewTarget.courseTitle}</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Nota (0-100)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={gradeInput}
                onChange={(e) => setGradeInput(e.target.value)}
                placeholder="Ex: 85"
                className="w-full h-10 rounded-xl bg-slate-950 border border-slate-900 px-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Feedback</label>
              <textarea
                value={feedbackInput}
                onChange={(e) => setFeedbackInput(e.target.value)}
                rows={4}
                placeholder="Comente os pontos fortes e o que pode ser melhorado."
                className="w-full rounded-xl bg-slate-950 border border-slate-900 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleReview("rejected")}
                disabled={isSavingReview}
                className="flex-1 h-10 rounded-xl border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 text-xs font-semibold text-rose-400 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
              >
                {isSavingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Rejeitar
              </button>
              <button
                onClick={() => handleReview("approved")}
                disabled={isSavingReview}
                className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
              >
                {isSavingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Aprovar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
