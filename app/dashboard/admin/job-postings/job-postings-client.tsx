"use client";

import React, { useState, useEffect } from "react";
import { Briefcase, Loader2, ShieldAlert, Plus, ChevronDown, ChevronUp, Mail } from "lucide-react";
import { useAccess } from "@/hooks/use-access";
import { useToast } from "@/components/ui/toast-provider";

const REVIEWER_ROLES = ["ADMIN", "SUPORTE", "GESTOR_EMPRESA"];

interface JobPosting {
  _id: string;
  title: string;
  description: string;
  location: string;
  workMode: string;
  isActive: boolean;
  applicationsCount: number;
}

interface Application {
  _id: string;
  applicantName: string;
  applicantEmail: string | null;
  message: string;
  appliedAt: string;
}

export default function JobPostingsPage() {
  const { activeRole, isLoading: loadingRole } = useAccess();
  const { showToast } = useToast();
  const canAccess = !!activeRole && REVIEWER_ROLES.includes(activeRole);

  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newWorkMode, setNewWorkMode] = useState("Presencial");
  const [creatingJob, setCreatingJob] = useState(false);

  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [applications, setApplications] = useState<Record<string, Application[]>>({});

  const loadData = async () => {
    try {
      const res = await fetch("/api/admin/job-postings");
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error("Erro ao carregar vagas:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canAccess) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) {
      showToast("Preencha o título e a descrição da vaga.", "error");
      return;
    }
    setCreatingJob(true);
    try {
      const res = await fetch("/api/admin/job-postings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), description: newDescription.trim(), location: newLocation.trim(), workMode: newWorkMode }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Vaga publicada com sucesso.", "success");
        setNewTitle("");
        setNewDescription("");
        setNewLocation("");
        loadData();
      } else {
        showToast(data.error || "Erro ao publicar a vaga.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao publicar a vaga.", "error");
    } finally {
      setCreatingJob(false);
    }
  };

  const handleToggleJob = async (job: JobPosting) => {
    try {
      const res = await fetch(`/api/admin/job-postings/${job._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !job.isActive }),
      });
      if (res.ok) {
        showToast(job.isActive ? "Vaga fechada." : "Vaga reaberta.", "success");
        loadData();
      }
    } catch {
      showToast("Erro ao atualizar a vaga.", "error");
    }
  };

  const toggleExpandJob = async (jobId: string) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
      return;
    }
    setExpandedJobId(jobId);
    if (!applications[jobId]) {
      try {
        const res = await fetch(`/api/admin/job-postings/${jobId}`);
        if (res.ok) {
          const data = await res.json();
          setApplications((prev) => ({ ...prev, [jobId]: data.applications || [] }));
        }
      } catch {
        // silencioso
      }
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
          Só Administradores, Suporte ou o Gestor de Empresa podem gerir as vagas de emprego da empresa.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <Briefcase className="h-7 w-7 text-indigo-400" />
          Vagas de Emprego
        </h1>
        <p className="text-sm text-slate-400">
          Publique vagas reais no Marketplace da MOZAI — visíveis a todos os alunos da plataforma.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          <span className="text-xs font-medium">A carregar...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Nova vaga */}
          <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Briefcase className="h-4.5 w-4.5 text-indigo-400" />
              Publicar Nova Vaga
            </h3>
            <form onSubmit={handleCreateJob} className="space-y-3">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Título da vaga (ex: Engenheiro de Software Júnior)"
                className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
              />
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Descrição da vaga, requisitos e responsabilidades..."
                className="w-full h-20 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none"
              />
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="Localização (ex: Lisboa)"
                  className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
                <select
                  value={newWorkMode}
                  onChange={(e) => setNewWorkMode(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="Presencial">Presencial</option>
                  <option value="Híbrido">Híbrido</option>
                  <option value="Remoto">Remoto</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={creatingJob}
                className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-55"
              >
                {creatingJob ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Publicar Vaga
              </button>
            </form>
          </div>

          {/* Lista de vagas + candidaturas */}
          <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-3">
            <h3 className="font-bold text-sm text-white">As Minhas Vagas</h3>
            {jobs.length === 0 ? (
              <span className="text-xs text-slate-500">Ainda não publicou nenhuma vaga.</span>
            ) : (
              jobs.map((job) => (
                <div key={job._id} className="border border-slate-900 bg-slate-950/60 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-xs text-white">{job.title}</h4>
                      <span className="text-[10px] text-slate-500">{job.location} · {job.workMode}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${job.isActive ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-slate-500 bg-slate-900 border-slate-800"}`}>
                        {job.isActive ? "Ativa" : "Fechada"}
                      </span>
                      <button
                        onClick={() => handleToggleJob(job)}
                        className="h-7 px-2.5 rounded-lg border border-slate-800 text-[10px] font-semibold text-slate-400 hover:bg-slate-900 cursor-pointer"
                      >
                        {job.isActive ? "Fechar" : "Reabrir"}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleExpandJob(job._id)}
                    className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                  >
                    {job.applicationsCount} candidatura(s)
                    {expandedJobId === job._id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  {expandedJobId === job._id && (
                    <div className="space-y-2 pt-2 border-t border-slate-900">
                      {(applications[job._id] || []).length === 0 ? (
                        <span className="text-[11px] text-slate-500">Ainda sem candidaturas.</span>
                      ) : (
                        applications[job._id].map((app) => (
                          <div key={app._id} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-900 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-white">{app.applicantName}</span>
                              {app.applicantEmail && (
                                <span className="text-[10px] text-indigo-400 flex items-center gap-1">
                                  <Mail className="h-3 w-3" /> {app.applicantEmail}
                                </span>
                              )}
                            </div>
                            {app.message && <p className="text-[10px] text-slate-400">{app.message}</p>}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
