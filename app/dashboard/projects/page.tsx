"use client";

import React, { useState, useEffect } from "react";
import {
  FolderKanban,
  Loader2,
  Link as LinkIcon,
  Paperclip,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Hourglass,
  AlertTriangle,
  CalendarClock,
} from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";

interface CourseOption {
  id: string;
  title: string;
}

interface ProjectRequirement {
  courseId: string;
  isRequired: boolean;
  dueDate: string | null;
}

interface ProjectSubmission {
  _id: string;
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
  isLate?: boolean;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

// Fallback estático dos cursos-demo, igual ao usado noutras páginas pessoais quando ainda
// não existem cursos reais criados na Fábrica de Cursos (IA).
const DEMO_COURSES: CourseOption[] = [
  { id: "course-1", title: "Engenharia de IA e RAG Avançado" },
  { id: "course-2", title: "Next.js 16 e Arquiteturas Composable SaaS" },
  { id: "course-3", title: "Smart Contracts e Criptografia com Solidity" },
];

const STATUS_CONFIG: Record<ProjectSubmission["status"], { label: string; color: string; icon: React.ElementType }> = {
  submitted: { label: "Submetido — a aguardar avaliação", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: Hourglass },
  reviewing: { label: "Em avaliação", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20", icon: Clock },
  approved: { label: "Aprovado", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 },
  rejected: { label: "Rejeitado — reveja e submeta novamente", color: "text-rose-400 bg-rose-500/10 border-rose-500/20", icon: XCircle },
};

export default function ProjectsPage() {
  const { showToast } = useToast();

  const [courses, setCourses] = useState<CourseOption[]>(DEMO_COURSES);
  const [requirements, setRequirements] = useState<ProjectRequirement[]>([]);
  const [submissions, setSubmissions] = useState<ProjectSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const loadData = async () => {
    try {
      const [catalogRes, submissionsRes, requirementsRes] = await Promise.all([
        fetch("/api/catalog"),
        fetch("/api/projects"),
        fetch("/api/projects/requirements"),
      ]);

      if (catalogRes.ok) {
        const data = await catalogRes.json();
        const real: CourseOption[] = (data.courses || []).map((c: any) => ({ id: c._id, title: c.title }));
        if (real.length > 0) {
          const realIds = new Set(real.map((c) => c.id));
          setCourses([...real, ...DEMO_COURSES.filter((c) => !realIds.has(c.id))]);
          setCourseId((prev) => prev || real[0].id);
        } else {
          setCourseId((prev) => prev || DEMO_COURSES[0].id);
        }
      }

      if (submissionsRes.ok) {
        const data = await submissionsRes.json();
        setSubmissions(data.submissions || []);
      }

      if (requirementsRes.ok) {
        const data = await requirementsRes.json();
        setRequirements(data.requirements || []);
      }
    } catch (error) {
      console.error("Erro ao carregar dados de Projetos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedRequirement = requirements.find((r) => r.courseId === courseId);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setRepoUrl("");
    setPendingFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!courseId || !title.trim() || !description.trim()) {
      showToast("Preencha o curso, o título e a descrição do projeto.", "error");
      return;
    }
    if (!repoUrl.trim() && !pendingFile) {
      showToast("Indique um link de repositório/portefólio ou anexe um ficheiro.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      let fileUrl: string | null = null;
      let fileName: string | null = null;

      if (pendingFile) {
        setIsUploadingFile(true);
        const { upload } = await import("@vercel/blob/client");
        const blob = await upload(pendingFile.name, pendingFile, {
          access: "public",
          handleUploadUrl: "/api/projects/upload-token",
        });
        fileUrl = blob.url;
        fileName = pendingFile.name;
        setIsUploadingFile(false);
      }

      const course = courses.find((c) => c.id === courseId);
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          courseTitle: course?.title || "Curso",
          title: title.trim(),
          description: description.trim(),
          repoUrl: repoUrl.trim() || null,
          fileUrl,
          fileName,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast("Projeto submetido com sucesso!", "success");
        resetForm();
        loadData();
      } else {
        showToast(data.error || "Erro ao submeter o projeto.", "error");
      }
    } catch (error: any) {
      showToast(error?.message || "Erro ao submeter o projeto.", "error");
    } finally {
      setIsUploadingFile(false);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <FolderKanban className="h-7 w-7 text-cyan-400" />
          Projetos
        </h1>
        <p className="text-sm text-slate-400">
          Submeta trabalhos práticos para avaliação e acompanhe o feedback de cada projeto.
        </p>
      </div>

      {/* Formulário de Nova Submissão */}
      <form
        onSubmit={handleSubmit}
        className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4 shadow-xl"
      >
        <h3 className="font-bold text-sm text-white flex items-center gap-2">
          <Send className="h-4 w-4 text-cyan-400" />
          Submeter Novo Projeto
        </h3>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Curso</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full h-10 rounded-xl bg-slate-950 border border-slate-900 px-3 text-xs text-white focus:outline-none focus:border-indigo-500/50"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Título do Projeto</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: API de gestão de tarefas com autenticação"
              className="w-full h-10 rounded-xl bg-slate-950 border border-slate-900 px-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
        </div>

        {selectedRequirement && (selectedRequirement.isRequired || selectedRequirement.dueDate) && (
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
            {selectedRequirement.isRequired && (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Obrigatório para o certificado deste curso
              </span>
            )}
            {selectedRequirement.dueDate && (
              <span className="text-[10px] font-bold text-slate-300 bg-slate-900/60 border border-slate-800 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" />
                Prazo: {new Date(selectedRequirement.dueDate).toLocaleDateString("pt-PT")}
              </span>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Descrição</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Descreva o que implementou, as tecnologias usadas e como testar."
            className="w-full rounded-xl bg-slate-950 border border-slate-900 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <LinkIcon className="h-3.5 w-3.5" /> Link do Repositório/Portefólio
            </label>
            <input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/..."
              className="w-full h-10 rounded-xl bg-slate-950 border border-slate-900 px-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5" /> Ou Anexar Ficheiro
            </label>
            <input
              type="file"
              onChange={(e) => setPendingFile(e.target.files?.[0] || null)}
              className="w-full h-10 rounded-xl bg-slate-950 border border-slate-900 px-3 text-xs text-slate-400 file:mr-3 file:h-full file:border-0 file:bg-slate-900 file:text-slate-300 file:px-3 file:text-xs file:rounded-l-xl file:cursor-pointer"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="h-10 px-5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-600/10 disabled:opacity-55"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {isUploadingFile ? "A carregar ficheiro..." : "A submeter..."}
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Submeter Projeto
            </>
          )}
        </button>
      </form>

      {/* Lista de Submissões */}
      <div className="space-y-4">
        <h3 className="font-bold text-sm text-white">As Minhas Submissões</h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
            <span className="text-xs font-medium">A carregar submissões...</span>
          </div>
        ) : submissions.length === 0 ? (
          <div className="border border-slate-900 border-dashed rounded-3xl p-10 text-center">
            <span className="text-xs text-slate-500">Ainda não submeteu nenhum projeto. Use o formulário acima para começar.</span>
          </div>
        ) : (
          submissions.map((s) => {
            const cfg = STATUS_CONFIG[s.status];
            const StatusIcon = cfg.icon;
            return (
              <div key={s._id} className="border border-slate-900 bg-slate-950/40 rounded-2xl p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-white">{s.title}</h4>
                    <span className="text-[11px] text-slate-500">{s.courseTitle}</span>
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
                  {s.isLate && (
                    <span className="text-rose-400 bg-rose-500/5 border border-rose-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
                      <AlertTriangle className="h-3 w-3" /> Fora do prazo
                    </span>
                  )}
                </div>

                {(s.status === "approved" || s.status === "rejected") && (s.feedback || s.grade !== null) && (
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-900/60 space-y-1.5">
                    {s.grade !== null && (
                      <span className="text-[11px] font-bold text-white block">Nota: {s.grade}/100</span>
                    )}
                    {s.feedback && (
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        <span className="font-semibold text-slate-300">Feedback: </span>
                        {s.feedback}
                      </p>
                    )}
                    {s.reviewedBy && (
                      <span className="text-[10px] text-slate-600 block">Avaliado por {s.reviewedBy}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
