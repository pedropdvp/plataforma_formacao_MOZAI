"use client";

import React, { useEffect, useState } from "react";
import {
  Store,
  Layers,
  Loader2,
  Download,
  CheckCircle2,
  Users,
  Search,
  Send,
  Sparkles,
  Clock,
  XCircle,
  Mail,
  Building2,
  MapPin,
  Database,
  Upload,
  Trash2,
  FileArchive,
} from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { useAccess } from "@/hooks/use-access";

interface MarketplaceListing {
  _id: string;
  title: string;
  description: string;
  sourceTenantName: string;
  lessonsCount: number;
}

interface Mentor {
  userId: string;
  name: string;
  bio: string;
  expertiseAreas: string[];
  availability: string;
}

interface MentorshipRequest {
  _id: string;
  menteeId: string;
  menteeName: string;
  mentorId: string;
  mentorName: string;
  message: string;
  status: "pending" | "accepted" | "declined";
  requestedAt: string;
  otherPartyEmail: string | null;
}

const STATUS_CONFIG: Record<MentorshipRequest["status"], { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Pendente", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: Clock },
  accepted: { label: "Aceite", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 },
  declined: { label: "Recusado", color: "text-slate-400 bg-slate-500/10 border-slate-500/20", icon: XCircle },
};

export default function MarketplacePage() {
  const { showToast } = useToast();
  const { userId, activeRole } = useAccess();
  const isModerator = activeRole === "ADMIN" || activeRole === "SUPORTE";
  const [tab, setTab] = useState<"courses" | "mentors" | "companies" | "datasets">("courses");

  // --- CURSOS ---
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [acquiringId, setAcquiringId] = useState<string | null>(null);
  const [acquiredIds, setAcquiredIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/marketplace");
        const data = await res.json();
        if (res.ok) setListings(data.listings || []);
      } catch {
        showToast("Erro ao carregar o marketplace.", "error");
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAcquire = async (listing: MarketplaceListing) => {
    setAcquiringId(listing._id);
    try {
      const res = await fetch("/api/marketplace/acquire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceCourseId: listing._id }),
      });
      const data = await res.json();
      if (res.ok) {
        setAcquiredIds((prev) => new Set(prev).add(listing._id));
        showToast(`"${listing.title}" adicionado ao seu catálogo.`, "success");
      } else {
        showToast(data.error || "Erro ao adquirir o curso.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao adquirir o curso.", "error");
    } finally {
      setAcquiringId(null);
    }
  };

  // --- MENTORES ---
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [mentorSearch, setMentorSearch] = useState("");
  const [loadingMentors, setLoadingMentors] = useState(true);
  const [requestingMentorId, setRequestingMentorId] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);

  const [ownBio, setOwnBio] = useState("");
  const [ownExpertise, setOwnExpertise] = useState("");
  const [ownAvailability, setOwnAvailability] = useState("");
  const [ownIsActive, setOwnIsActive] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const [sentRequests, setSentRequests] = useState<MentorshipRequest[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<MentorshipRequest[]>([]);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  const loadMentors = async (query: string) => {
    setLoadingMentors(true);
    try {
      const res = await fetch(`/api/mentors?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setMentors(data.mentors || []);
      }
    } catch {
      // silencioso — pesquisa opcional
    } finally {
      setLoadingMentors(false);
    }
  };

  const loadOwnProfile = async () => {
    try {
      const res = await fetch("/api/mentors/profile");
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setOwnBio(data.profile.bio || "");
          setOwnExpertise((data.profile.expertiseAreas || []).join(", "));
          setOwnAvailability(data.profile.availability || "");
          setOwnIsActive(data.profile.isActive !== false);
        }
      }
    } catch {
      // silencioso
    }
  };

  const loadRequests = async () => {
    try {
      const res = await fetch("/api/mentors/requests");
      if (res.ok) {
        const data = await res.json();
        setSentRequests(data.sent || []);
        setReceivedRequests(data.received || []);
      }
    } catch {
      // silencioso
    }
  };

  // --- EMPRESAS ---
  interface CompanyJob {
    id: string;
    title: string;
    description: string;
    location: string;
    workMode: string;
  }
  interface Company {
    tenantId: string;
    companyName: string;
    logoUrl: string;
    description: string;
    industry: string;
    website: string;
    jobs: CompanyJob[];
  }

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState("");
  const [sendingApplication, setSendingApplication] = useState(false);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());

  const loadCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const res = await fetch("/api/marketplace/companies");
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.companies || []);
      }
    } catch {
      showToast("Erro ao carregar as empresas do marketplace.", "error");
    } finally {
      setLoadingCompanies(false);
    }
  };

  const handleApplyJob = async (job: CompanyJob) => {
    if (!applyMessage.trim()) {
      showToast("Escreva uma breve mensagem de candidatura.", "error");
      return;
    }
    setSendingApplication(true);
    try {
      const res = await fetch(`/api/marketplace/jobs/${job.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: applyMessage.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Candidatura enviada com sucesso!", "success");
        setAppliedJobIds((prev) => new Set(prev).add(job.id));
        setApplyingJobId(null);
        setApplyMessage("");
      } else {
        showToast(data.error || "Erro ao enviar a candidatura.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao enviar a candidatura.", "error");
    } finally {
      setSendingApplication(false);
    }
  };

  // --- DATASETS ---
  interface Dataset {
    _id: string;
    title: string;
    description: string;
    category: string;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    uploaderName: string;
    uploadedBy: string;
    downloadsCount: number;
  }

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [datasetSearch, setDatasetSearch] = useState("");
  const [newDatasetTitle, setNewDatasetTitle] = useState("");
  const [newDatasetDescription, setNewDatasetDescription] = useState("");
  const [newDatasetCategory, setNewDatasetCategory] = useState("");
  const [pendingDatasetFile, setPendingDatasetFile] = useState<File | null>(null);
  const [publishingDataset, setPublishingDataset] = useState(false);
  const [downloadingDatasetId, setDownloadingDatasetId] = useState<string | null>(null);

  const loadDatasets = async (query: string) => {
    setLoadingDatasets(true);
    try {
      const res = await fetch(`/api/datasets?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setDatasets(data.datasets || []);
      }
    } catch {
      showToast("Erro ao carregar os datasets.", "error");
    } finally {
      setLoadingDatasets(false);
    }
  };

  const handlePublishDataset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDatasetTitle.trim() || !pendingDatasetFile) {
      showToast("Indique um título e escolha um ficheiro.", "error");
      return;
    }
    setPublishingDataset(true);
    try {
      const { upload } = await import("@vercel/blob/client");
      const blob = await upload(pendingDatasetFile.name, pendingDatasetFile, {
        access: "public",
        handleUploadUrl: "/api/datasets/upload-token",
      });

      const res = await fetch("/api/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newDatasetTitle.trim(),
          description: newDatasetDescription.trim(),
          category: newDatasetCategory.trim(),
          fileUrl: blob.url,
          fileName: pendingDatasetFile.name,
          fileSize: pendingDatasetFile.size,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Dataset publicado com sucesso!", "success");
        setNewDatasetTitle("");
        setNewDatasetDescription("");
        setNewDatasetCategory("");
        setPendingDatasetFile(null);
        loadDatasets(datasetSearch);
      } else {
        showToast(data.error || "Erro ao publicar o dataset.", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Erro ao carregar o ficheiro.", "error");
    } finally {
      setPublishingDataset(false);
    }
  };

  const handleDownloadDataset = async (dataset: Dataset) => {
    setDownloadingDatasetId(dataset._id);
    try {
      const res = await fetch(`/api/datasets/${dataset._id}/download`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        window.open(data.fileUrl, "_blank");
        setDatasets((prev) => prev.map((d) => (d._id === dataset._id ? { ...d, downloadsCount: data.downloadsCount } : d)));
      } else {
        showToast(data.error || "Erro ao descarregar o dataset.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao descarregar o dataset.", "error");
    } finally {
      setDownloadingDatasetId(null);
    }
  };

  const handleDeleteDataset = async (dataset: Dataset) => {
    try {
      const res = await fetch(`/api/datasets/${dataset._id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Dataset eliminado.", "success");
        setDatasets((prev) => prev.filter((d) => d._id !== dataset._id));
      }
    } catch {
      showToast("Erro ao eliminar o dataset.", "error");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  useEffect(() => {
    if (tab === "mentors") {
      loadMentors("");
      loadOwnProfile();
      loadRequests();
    }
    if (tab === "companies") {
      loadCompanies();
    }
    if (tab === "datasets") {
      loadDatasets("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownBio.trim() || !ownExpertise.trim()) {
      showToast("Preencha a biografia e pelo menos uma área de especialidade.", "error");
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch("/api/mentors/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: ownBio.trim(),
          expertiseAreas: ownExpertise.split(",").map((a) => a.trim()).filter(Boolean),
          availability: ownAvailability.trim(),
          isActive: ownIsActive,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Perfil de mentor guardado.", "success");
        loadMentors(mentorSearch);
      } else {
        showToast(data.error || "Erro ao guardar o perfil.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao guardar o perfil.", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSendRequest = async (mentor: Mentor) => {
    if (!requestMessage.trim()) {
      showToast("Escreva uma mensagem para o mentor.", "error");
      return;
    }
    setSendingRequest(true);
    try {
      const res = await fetch("/api/mentors/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mentorUserId: mentor.userId, message: requestMessage.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Pedido de mentoria enviado!", "success");
        setRequestingMentorId(null);
        setRequestMessage("");
        loadRequests();
      } else {
        showToast(data.error || "Erro ao enviar o pedido.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao enviar o pedido.", "error");
    } finally {
      setSendingRequest(false);
    }
  };

  const handleRespondRequest = async (request: MentorshipRequest, action: "accept" | "decline") => {
    setProcessingRequestId(request._id);
    try {
      const res = await fetch(`/api/mentors/requests/${request._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        loadRequests();
      } else {
        showToast(data.error || "Erro ao responder ao pedido.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao responder ao pedido.", "error");
    } finally {
      setProcessingRequestId(null);
    }
  };

  return (
    <div className="space-y-8 workspace-page-container">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Store className="h-6 w-6 text-indigo-400" />
          AI Marketplace
        </h1>
        <p className="text-sm text-slate-400">
          Cursos publicados por outras organizações e mentores disponíveis para apoiar o seu percurso.
        </p>
      </div>

      <div className="flex gap-2 p-1 rounded-2xl bg-slate-900 border border-slate-800 w-fit">
        <button
          onClick={() => setTab("courses")}
          className={`h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
            tab === "courses" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Store className="h-3.5 w-3.5" /> Cursos
        </button>
        <button
          onClick={() => setTab("mentors")}
          className={`h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
            tab === "mentors" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Users className="h-3.5 w-3.5" /> Mentores
        </button>
        <button
          onClick={() => setTab("companies")}
          className={`h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
            tab === "companies" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Building2 className="h-3.5 w-3.5" /> Empresas
        </button>
        <button
          onClick={() => setTab("datasets")}
          className={`h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
            tab === "datasets" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Database className="h-3.5 w-3.5" /> Datasets
        </button>
      </div>

      {tab === "courses" ? (
        loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
          </div>
        ) : listings.length === 0 ? (
          <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-12 text-center">
            <span className="text-sm text-slate-500 italic">Ainda não há cursos publicados no marketplace.</span>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => {
              const acquired = acquiredIds.has(listing._id);
              return (
                <div key={listing._id} className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-4 flex flex-col">
                  <div className="space-y-2 flex-1">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">{listing.sourceTenantName}</span>
                    <h3 className="text-sm font-bold text-white leading-snug">{listing.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{listing.description}</p>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Layers className="h-3 w-3" /> {listing.lessonsCount} lições
                    </span>
                  </div>
                  <button
                    onClick={() => handleAcquire(listing)}
                    disabled={acquiringId === listing._id || acquired}
                    className={`h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:cursor-default ${
                      acquired
                        ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                        : "bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
                    }`}
                  >
                    {acquiringId === listing._id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : acquired ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    {acquired ? "Adicionado ao Catálogo" : "Adicionar ao Meu Catálogo"}
                  </button>
                </div>
              );
            })}
          </div>
        )
      ) : tab === "mentors" ? (
        <div className="space-y-8">
          {/* Torna-te Mentor */}
          <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-indigo-400" />
              Torna-te Mentor
            </h3>
            <form onSubmit={handleSaveProfile} className="space-y-3">
              <textarea
                value={ownBio}
                onChange={(e) => setOwnBio(e.target.value)}
                placeholder="Fale um pouco sobre si e como pode ajudar outros formandos..."
                className="w-full h-20 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none"
              />
              <input
                value={ownExpertise}
                onChange={(e) => setOwnExpertise(e.target.value)}
                placeholder="Áreas de especialidade, separadas por vírgula (ex: Python, RAG, Carreira)"
                className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
              />
              <input
                value={ownAvailability}
                onChange={(e) => setOwnAvailability(e.target.value)}
                placeholder="Disponibilidade (ex: Terças e quintas à noite)"
                className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
              />
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={ownIsActive} onChange={(e) => setOwnIsActive(e.target.checked)} className="h-4 w-4 accent-indigo-500" />
                <span className="text-xs text-slate-300">Perfil ativo (visível na pesquisa de mentores)</span>
              </label>
              <button
                type="submit"
                disabled={savingProfile}
                className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-55"
              >
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Guardar Perfil de Mentor
              </button>
            </form>
          </div>

          {/* Encontrar um Mentor */}
          <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Search className="h-4.5 w-4.5 text-indigo-400" />
              Encontrar um Mentor
            </h3>
            <input
              value={mentorSearch}
              onChange={(e) => {
                setMentorSearch(e.target.value);
                loadMentors(e.target.value);
              }}
              placeholder="Pesquisar por nome ou especialidade (ex: Python)"
              className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
            />

            {loadingMentors ? (
              <div className="flex items-center justify-center py-8 text-slate-500 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
              </div>
            ) : mentors.length === 0 ? (
              <div className="border border-slate-900 border-dashed rounded-2xl p-8 text-center">
                <span className="text-xs text-slate-500">Nenhum mentor disponível para esta pesquisa.</span>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {mentors.map((mentor) => (
                  <div key={mentor.userId} className="border border-slate-900 bg-slate-950/60 rounded-2xl p-4 space-y-3">
                    <div>
                      <h4 className="font-bold text-xs text-white">{mentor.name}</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-1">{mentor.bio}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {mentor.expertiseAreas.map((area) => (
                        <span key={area} className="text-[9px] font-mono font-bold text-indigo-400 bg-indigo-500/5 border border-indigo-500/10 px-2 py-0.5 rounded-full">
                          {area}
                        </span>
                      ))}
                    </div>
                    {mentor.availability && <span className="text-[10px] text-slate-500 block">Disponibilidade: {mentor.availability}</span>}

                    {requestingMentorId === mentor.userId ? (
                      <div className="space-y-2 pt-2 border-t border-slate-900">
                        <textarea
                          value={requestMessage}
                          onChange={(e) => setRequestMessage(e.target.value)}
                          placeholder="Escreva a sua mensagem para este mentor..."
                          className="w-full h-16 p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-[11px] focus:border-indigo-500 focus:outline-none resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setRequestingMentorId(null)}
                            className="h-8 px-3 rounded-lg border border-slate-800 text-[11px] font-semibold text-slate-400 hover:bg-slate-900 cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleSendRequest(mentor)}
                            disabled={sendingRequest}
                            className="flex-1 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[11px] font-semibold text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-55"
                          >
                            {sendingRequest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            Enviar Pedido
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setRequestingMentorId(mentor.userId);
                          setRequestMessage("");
                        }}
                        className="w-full h-8 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-[11px] font-semibold text-indigo-400 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Pedir Mentoria
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Os Meus Pedidos */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-3">
              <h3 className="font-bold text-sm text-white">Pedidos Enviados</h3>
              {sentRequests.length === 0 ? (
                <span className="text-xs text-slate-500">Ainda não pediu mentoria a ninguém.</span>
              ) : (
                sentRequests.map((r) => {
                  const cfg = STATUS_CONFIG[r.status];
                  const StatusIcon = cfg.icon;
                  return (
                    <div key={r._id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-900 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{r.mentorName}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${cfg.color}`}>
                          <StatusIcon className="h-3 w-3" /> {cfg.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{r.message}</p>
                      {r.status === "accepted" && r.otherPartyEmail && (
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {r.otherPartyEmail}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-3">
              <h3 className="font-bold text-sm text-white">Pedidos Recebidos (como Mentor)</h3>
              {receivedRequests.length === 0 ? (
                <span className="text-xs text-slate-500">Ainda não recebeu pedidos de mentoria.</span>
              ) : (
                receivedRequests.map((r) => {
                  const cfg = STATUS_CONFIG[r.status];
                  const StatusIcon = cfg.icon;
                  return (
                    <div key={r._id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-900 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{r.menteeName}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${cfg.color}`}>
                          <StatusIcon className="h-3 w-3" /> {cfg.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{r.message}</p>
                      {r.status === "accepted" && r.otherPartyEmail && (
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {r.otherPartyEmail}
                        </span>
                      )}
                      {r.status === "pending" && (
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleRespondRequest(r, "decline")}
                            disabled={processingRequestId === r._id}
                            className="h-7 px-3 rounded-lg border border-slate-800 text-[10px] font-semibold text-slate-400 hover:bg-slate-900 cursor-pointer disabled:opacity-55"
                          >
                            Recusar
                          </button>
                          <button
                            onClick={() => handleRespondRequest(r, "accept")}
                            disabled={processingRequestId === r._id}
                            className="h-7 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[10px] font-semibold text-white cursor-pointer disabled:opacity-55"
                          >
                            Aceitar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : tab === "companies" ? (
        loadingCompanies ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
        </div>
      ) : companies.length === 0 ? (
        <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-12 text-center">
          <span className="text-sm text-slate-500 italic">Ainda não há empresas com vagas publicadas no marketplace.</span>
        </div>
      ) : (
        <div className="space-y-6">
          {companies.map((company) => (
            <div key={company.tenantId} className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                {company.logoUrl ? (
                  <img src={company.logoUrl} alt={company.companyName} className="h-10 w-10 rounded-xl border border-slate-800 object-contain bg-white" />
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                    <Building2 className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-sm text-white">{company.companyName}</h3>
                  <span className="text-[10px] text-slate-500">{company.industry}</span>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1">{company.description}</p>
                </div>
              </div>

              {company.jobs.length === 0 ? (
                <span className="text-[11px] text-slate-600 italic">Sem vagas em aberto neste momento.</span>
              ) : (
                <div className="space-y-3 pt-3 border-t border-slate-900">
                  {company.jobs.map((job) => {
                    const applied = appliedJobIds.has(job.id);
                    return (
                      <div key={job.id} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-900 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-xs text-white">{job.title}</h4>
                          <span className="text-[10px] text-slate-500 flex items-center gap-1 shrink-0">
                            <MapPin className="h-3 w-3" /> {job.location} · {job.workMode}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">{job.description}</p>

                        {applied ? (
                          <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Candidatura enviada
                          </span>
                        ) : applyingJobId === job.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={applyMessage}
                              onChange={(e) => setApplyMessage(e.target.value)}
                              placeholder="Escreva uma breve mensagem de candidatura..."
                              className="w-full h-16 p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-[11px] focus:border-indigo-500 focus:outline-none resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => setApplyingJobId(null)}
                                className="h-8 px-3 rounded-lg border border-slate-800 text-[11px] font-semibold text-slate-400 hover:bg-slate-900 cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => handleApplyJob(job)}
                                disabled={sendingApplication}
                                className="flex-1 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[11px] font-semibold text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-55"
                              >
                                {sendingApplication ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                Enviar Candidatura
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setApplyingJobId(job.id);
                              setApplyMessage("");
                            }}
                            className="h-8 px-3.5 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-[11px] font-semibold text-indigo-400 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Send className="h-3.5 w-3.5" />
                            Candidatar-me
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
        )
      ) : (
        <div className="space-y-6">
          {/* Publicar Dataset */}
          <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Upload className="h-4.5 w-4.5 text-indigo-400" />
              Publicar Dataset
            </h3>
            <form onSubmit={handlePublishDataset} className="space-y-3">
              <input
                value={newDatasetTitle}
                onChange={(e) => setNewDatasetTitle(e.target.value)}
                placeholder="Título do dataset (ex: Vendas de Retalho 2024)"
                className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
              />
              <textarea
                value={newDatasetDescription}
                onChange={(e) => setNewDatasetDescription(e.target.value)}
                placeholder="Descreva o conteúdo, colunas e possível utilização deste dataset..."
                className="w-full h-16 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none"
              />
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  value={newDatasetCategory}
                  onChange={(e) => setNewDatasetCategory(e.target.value)}
                  placeholder="Categoria (ex: Finanças, NLP, Vendas)"
                  className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
                <input
                  type="file"
                  accept=".csv,.json,.zip,.xlsx,.parquet"
                  onChange={(e) => setPendingDatasetFile(e.target.files?.[0] || null)}
                  className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-[11px] file:mr-3 file:h-full file:border-0 file:bg-slate-900 file:text-slate-300 file:px-3 file:text-xs file:rounded-l-xl file:cursor-pointer"
                />
              </div>
              <button
                type="submit"
                disabled={publishingDataset}
                className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-55"
              >
                {publishingDataset ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {publishingDataset ? "A publicar..." : "Publicar Dataset"}
              </button>
            </form>
          </div>

          {/* Pesquisa e Lista */}
          <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Database className="h-4.5 w-4.5 text-indigo-400" />
              Datasets Disponíveis
            </h3>
            <input
              value={datasetSearch}
              onChange={(e) => {
                setDatasetSearch(e.target.value);
                loadDatasets(e.target.value);
              }}
              placeholder="Pesquisar por título ou categoria..."
              className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
            />

            {loadingDatasets ? (
              <div className="flex items-center justify-center py-8 text-slate-500 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
              </div>
            ) : datasets.length === 0 ? (
              <div className="border border-slate-900 border-dashed rounded-2xl p-8 text-center">
                <span className="text-xs text-slate-500">Ainda não há datasets publicados para esta pesquisa.</span>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {datasets.map((dataset) => {
                  const canDelete = dataset.uploadedBy === userId || isModerator;
                  return (
                    <div key={dataset._id} className="border border-slate-900 bg-slate-950/60 rounded-2xl p-4 space-y-3 flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">{dataset.category}</span>
                          <h4 className="font-bold text-xs text-white truncate">{dataset.title}</h4>
                        </div>
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteDataset(dataset)}
                            className="h-6 w-6 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 flex items-center justify-center cursor-pointer shrink-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed flex-1">{dataset.description}</p>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1"><FileArchive className="h-3 w-3" /> {formatFileSize(dataset.fileSize)}</span>
                        <span className="flex items-center gap-1"><Download className="h-3 w-3" /> {dataset.downloadsCount}</span>
                      </div>
                      <span className="text-[10px] text-slate-600">Por {dataset.uploaderName}</span>
                      <button
                        onClick={() => handleDownloadDataset(dataset)}
                        disabled={downloadingDatasetId === dataset._id}
                        className="h-8 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-[11px] font-semibold text-indigo-400 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-55"
                      >
                        {downloadingDatasetId === dataset._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        Descarregar
                      </button>
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
