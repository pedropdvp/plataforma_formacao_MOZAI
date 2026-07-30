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
  Bot,
  MessageSquare,
  Lock,
  Globe,
  ScrollText,
  Copy,
  Wand2,
  LayoutTemplate,
  Briefcase,
  Calendar,
  Coins,
  ThumbsUp,
  ThumbsDown,
  FlaskConical,
  Play,
  Terminal,
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
  const [tab, setTab] = useState<
    "courses" | "mentors" | "companies" | "datasets" | "models" | "prompts" | "templates" | "projects" | "labs"
  >("courses");

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

  // --- MODELOS IA ---
  interface AiModel {
    id: string;
    name: string;
    description: string;
    category: string;
    hasKnowledge: boolean;
    isPublic: boolean;
    usesCount: number;
    ownerName: string;
    isMine: boolean;
  }

  const [aiModels, setAiModels] = useState<AiModel[]>([]);
  const [loadingAiModels, setLoadingAiModels] = useState(true);
  const [aiModelSearch, setAiModelSearch] = useState("");
  const [newModelName, setNewModelName] = useState("");
  const [newModelDescription, setNewModelDescription] = useState("");
  const [newModelCategory, setNewModelCategory] = useState("");
  const [newModelSystemPrompt, setNewModelSystemPrompt] = useState("");
  const [newModelKnowledge, setNewModelKnowledge] = useState("");
  const [newModelIsPublic, setNewModelIsPublic] = useState(true);
  const [publishingModel, setPublishingModel] = useState(false);

  const [testingModel, setTestingModel] = useState<AiModel | null>(null);
  const [testMessages, setTestMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [testInput, setTestInput] = useState("");
  const [testLoading, setTestLoading] = useState(false);

  const loadAiModels = async (query: string) => {
    setLoadingAiModels(true);
    try {
      const res = await fetch(`/api/ai-models?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setAiModels(data.models || []);
      }
    } catch {
      showToast("Erro ao carregar os Modelos IA.", "error");
    } finally {
      setLoadingAiModels(false);
    }
  };

  const handlePublishModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelName.trim() || !newModelDescription.trim() || !newModelSystemPrompt.trim()) {
      showToast("Preencha o nome, a descrição e as instruções do assistente.", "error");
      return;
    }
    setPublishingModel(true);
    try {
      const res = await fetch("/api/ai-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newModelName.trim(),
          description: newModelDescription.trim(),
          category: newModelCategory.trim(),
          systemPrompt: newModelSystemPrompt.trim(),
          knowledgeText: newModelKnowledge.trim(),
          isPublic: newModelIsPublic,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Modelo IA publicado com sucesso!", "success");
        setNewModelName("");
        setNewModelDescription("");
        setNewModelCategory("");
        setNewModelSystemPrompt("");
        setNewModelKnowledge("");
        loadAiModels(aiModelSearch);
      } else {
        showToast(data.error || "Erro ao publicar o Modelo IA.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao publicar o Modelo IA.", "error");
    } finally {
      setPublishingModel(false);
    }
  };

  const handleToggleModelVisibility = async (model: AiModel) => {
    try {
      const res = await fetch(`/api/ai-models/${model.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !model.isPublic }),
      });
      if (res.ok) {
        setAiModels((prev) => prev.map((m) => (m.id === model.id ? { ...m, isPublic: !m.isPublic } : m)));
      }
    } catch {
      showToast("Erro ao atualizar a visibilidade do Modelo IA.", "error");
    }
  };

  const handleDeleteModel = async (model: AiModel) => {
    try {
      const res = await fetch(`/api/ai-models/${model.id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Modelo IA eliminado.", "success");
        setAiModels((prev) => prev.filter((m) => m.id !== model.id));
      }
    } catch {
      showToast("Erro ao eliminar o Modelo IA.", "error");
    }
  };

  const openTestModel = (model: AiModel) => {
    setTestingModel(model);
    setTestMessages([]);
    setTestInput("");
  };

  const handleSendTestMessage = async () => {
    if (!testInput.trim() || !testingModel) return;
    const userMessage = { role: "user" as const, content: testInput.trim() };
    const nextMessages = [...testMessages, userMessage];
    setTestMessages(nextMessages);
    setTestInput("");
    setTestLoading(true);
    try {
      const res = await fetch(`/api/ai-models/${testingModel.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Erro ao conversar com este Modelo IA.", "error");
        setTestLoading(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      setTestMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setTestMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: assistantText };
          return copy;
        });
      }
    } catch {
      showToast("Erro de comunicação com este Modelo IA.", "error");
    } finally {
      setTestLoading(false);
    }
  };

  // --- PROMPTS ---
  interface AiPrompt {
    id: string;
    title: string;
    description: string;
    category: string;
    template: string;
    variables: string[];
    isPublic: boolean;
    usesCount: number;
    ownerName: string;
    isMine: boolean;
  }

  const [prompts, setPrompts] = useState<AiPrompt[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(true);
  const [promptSearch, setPromptSearch] = useState("");
  const [newPromptTitle, setNewPromptTitle] = useState("");
  const [newPromptDescription, setNewPromptDescription] = useState("");
  const [newPromptCategory, setNewPromptCategory] = useState("");
  const [newPromptTemplate, setNewPromptTemplate] = useState("");
  const [newPromptIsPublic, setNewPromptIsPublic] = useState(true);
  const [publishingPrompt, setPublishingPrompt] = useState(false);

  const [runningPrompt, setRunningPrompt] = useState<AiPrompt | null>(null);
  const [runVariables, setRunVariables] = useState<Record<string, string>>({});
  const [runResult, setRunResult] = useState<string | null>(null);
  const [runLoading, setRunLoading] = useState(false);

  const loadPrompts = async (query: string) => {
    setLoadingPrompts(true);
    try {
      const res = await fetch(`/api/prompts?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setPrompts(data.prompts || []);
      }
    } catch {
      showToast("Erro ao carregar os Prompts.", "error");
    } finally {
      setLoadingPrompts(false);
    }
  };

  const handlePublishPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromptTitle.trim() || !newPromptTemplate.trim()) {
      showToast("Preencha o título e o template do prompt.", "error");
      return;
    }
    setPublishingPrompt(true);
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newPromptTitle.trim(),
          description: newPromptDescription.trim(),
          category: newPromptCategory.trim(),
          template: newPromptTemplate.trim(),
          isPublic: newPromptIsPublic,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Prompt publicado com sucesso!", "success");
        setNewPromptTitle("");
        setNewPromptDescription("");
        setNewPromptCategory("");
        setNewPromptTemplate("");
        loadPrompts(promptSearch);
      } else {
        showToast(data.error || "Erro ao publicar o Prompt.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao publicar o Prompt.", "error");
    } finally {
      setPublishingPrompt(false);
    }
  };

  const handleTogglePromptVisibility = async (prompt: AiPrompt) => {
    try {
      const res = await fetch(`/api/prompts/${prompt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !prompt.isPublic }),
      });
      if (res.ok) {
        setPrompts((prev) => prev.map((p) => (p.id === prompt.id ? { ...p, isPublic: !p.isPublic } : p)));
      }
    } catch {
      showToast("Erro ao atualizar a visibilidade do Prompt.", "error");
    }
  };

  const handleDeletePrompt = async (prompt: AiPrompt) => {
    try {
      const res = await fetch(`/api/prompts/${prompt.id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Prompt eliminado.", "success");
        setPrompts((prev) => prev.filter((p) => p.id !== prompt.id));
      }
    } catch {
      showToast("Erro ao eliminar o Prompt.", "error");
    }
  };

  const handleCopyPrompt = async (prompt: AiPrompt) => {
    try {
      await navigator.clipboard.writeText(prompt.template);
      showToast("Template copiado para a área de transferência.", "success");
    } catch {
      showToast("Não foi possível copiar o template.", "error");
    }
  };

  const openRunPrompt = (prompt: AiPrompt) => {
    setRunningPrompt(prompt);
    const initial: Record<string, string> = {};
    prompt.variables.forEach((v) => (initial[v] = ""));
    setRunVariables(initial);
    setRunResult(null);
  };

  const handleRunPrompt = async () => {
    if (!runningPrompt) return;
    setRunLoading(true);
    setRunResult(null);
    try {
      const res = await fetch(`/api/prompts/${runningPrompt.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variables: runVariables }),
      });
      const data = await res.json();
      if (res.ok) {
        setRunResult(data.result);
      } else {
        showToast(data.error || "Erro ao executar o Prompt.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao executar o Prompt.", "error");
    } finally {
      setRunLoading(false);
    }
  };

  // --- TEMPLATES ---
  interface ContentTemplate {
    id: string;
    title: string;
    description: string;
    category: string;
    content: string;
    isPublic: boolean;
    usesCount: number;
    ownerName: string;
    isMine: boolean;
  }

  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templateSearch, setTemplateSearch] = useState("");
  const [newTemplateTitle, setNewTemplateTitle] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] = useState("");
  const [newTemplateContent, setNewTemplateContent] = useState("");
  const [newTemplateIsPublic, setNewTemplateIsPublic] = useState(true);
  const [publishingTemplate, setPublishingTemplate] = useState(false);
  const [previewingTemplate, setPreviewingTemplate] = useState<ContentTemplate | null>(null);

  const loadTemplates = async (query: string) => {
    setLoadingTemplates(true);
    try {
      const res = await fetch(`/api/templates?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch {
      showToast("Erro ao carregar os Templates.", "error");
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handlePublishTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateTitle.trim() || !newTemplateContent.trim()) {
      showToast("Preencha o título e o conteúdo do template.", "error");
      return;
    }
    setPublishingTemplate(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTemplateTitle.trim(),
          description: newTemplateDescription.trim(),
          category: newTemplateCategory.trim(),
          content: newTemplateContent.trim(),
          isPublic: newTemplateIsPublic,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Template publicado com sucesso!", "success");
        setNewTemplateTitle("");
        setNewTemplateDescription("");
        setNewTemplateCategory("");
        setNewTemplateContent("");
        loadTemplates(templateSearch);
      } else {
        showToast(data.error || "Erro ao publicar o Template.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao publicar o Template.", "error");
    } finally {
      setPublishingTemplate(false);
    }
  };

  const handleToggleTemplateVisibility = async (template: ContentTemplate) => {
    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !template.isPublic }),
      });
      if (res.ok) {
        setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, isPublic: !t.isPublic } : t)));
      }
    } catch {
      showToast("Erro ao atualizar a visibilidade do Template.", "error");
    }
  };

  const handleDeleteTemplate = async (template: ContentTemplate) => {
    try {
      const res = await fetch(`/api/templates/${template.id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Template eliminado.", "success");
        setTemplates((prev) => prev.filter((t) => t.id !== template.id));
      }
    } catch {
      showToast("Erro ao eliminar o Template.", "error");
    }
  };

  const registerTemplateUse = async (template: ContentTemplate): Promise<string | null> => {
    try {
      const res = await fetch(`/api/templates/${template.id}/use`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, usesCount: t.usesCount + 1 } : t)));
        return data.content as string;
      }
      showToast(data.error || "Erro ao usar o Template.", "error");
      return null;
    } catch {
      showToast("Erro de comunicação ao usar o Template.", "error");
      return null;
    }
  };

  const handleCopyTemplate = async (template: ContentTemplate) => {
    const content = await registerTemplateUse(template);
    if (content === null) return;
    try {
      await navigator.clipboard.writeText(content);
      showToast("Template copiado para a área de transferência.", "success");
    } catch {
      showToast("Não foi possível copiar o template.", "error");
    }
  };

  const handleDownloadTemplate = async (template: ContentTemplate) => {
    const content = await registerTemplateUse(template);
    if (content === null) return;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.title.replace(/[^\w\-]+/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- PROJETOS (BOLSA DE FREELANCE) ---
  interface MarketplaceProject {
    id: string;
    title: string;
    description: string;
    skills: string[];
    budget: string;
    budgetType: "fixo" | "portefolio";
    deadline: string | null;
    status: "open" | "in_progress" | "completed";
    posterName: string;
    isMine: boolean;
    proposalsCount: number;
  }
  interface ProjectProposal {
    _id: string;
    applicantId: string;
    applicantName: string;
    message: string;
    proposedBudget: string;
    portfolioLink: string;
    status: "pending" | "accepted" | "rejected";
    submittedAt: string;
  }

  const PROJECT_STATUS_CONFIG: Record<MarketplaceProject["status"], { label: string; color: string }> = {
    open: { label: "Em Aberto", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    in_progress: { label: "Em Curso", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    completed: { label: "Concluído", color: "text-slate-400 bg-slate-500/10 border-slate-500/20" },
  };

  const [marketplaceProjects, setMarketplaceProjects] = useState<MarketplaceProject[]>([]);
  const [loadingMarketplaceProjects, setLoadingMarketplaceProjects] = useState(true);
  const [projectSearch, setProjectSearch] = useState("");
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newProjectSkills, setNewProjectSkills] = useState("");
  const [newProjectBudget, setNewProjectBudget] = useState("");
  const [newProjectBudgetType, setNewProjectBudgetType] = useState<"fixo" | "portefolio">("fixo");
  const [newProjectDeadline, setNewProjectDeadline] = useState("");
  const [publishingProject, setPublishingProject] = useState(false);

  const [viewingProject, setViewingProject] = useState<MarketplaceProject | null>(null);
  const [projectProposals, setProjectProposals] = useState<ProjectProposal[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [isProjectOwnerView, setIsProjectOwnerView] = useState(false);
  const [proposalMessage, setProposalMessage] = useState("");
  const [proposalBudget, setProposalBudget] = useState("");
  const [proposalPortfolio, setProposalPortfolio] = useState("");
  const [sendingProposal, setSendingProposal] = useState(false);
  const [respondingProposalId, setRespondingProposalId] = useState<string | null>(null);

  const loadMarketplaceProjects = async (query: string) => {
    setLoadingMarketplaceProjects(true);
    try {
      const res = await fetch(`/api/marketplace/projects?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setMarketplaceProjects(data.projects || []);
      }
    } catch {
      showToast("Erro ao carregar a bolsa de projetos.", "error");
    } finally {
      setLoadingMarketplaceProjects(false);
    }
  };

  const handlePublishProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectTitle.trim() || !newProjectDescription.trim()) {
      showToast("Preencha o título e a descrição do projeto.", "error");
      return;
    }
    setPublishingProject(true);
    try {
      const res = await fetch("/api/marketplace/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newProjectTitle.trim(),
          description: newProjectDescription.trim(),
          skills: newProjectSkills,
          budget: newProjectBudget.trim(),
          budgetType: newProjectBudgetType,
          deadline: newProjectDeadline || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Projeto publicado na bolsa!", "success");
        setNewProjectTitle("");
        setNewProjectDescription("");
        setNewProjectSkills("");
        setNewProjectBudget("");
        setNewProjectDeadline("");
        loadMarketplaceProjects(projectSearch);
      } else {
        showToast(data.error || "Erro ao publicar o projeto.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao publicar o projeto.", "error");
    } finally {
      setPublishingProject(false);
    }
  };

  const handleUpdateProjectStatus = async (project: MarketplaceProject, status: MarketplaceProject["status"]) => {
    try {
      const res = await fetch(`/api/marketplace/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setMarketplaceProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, status } : p)));
        showToast("Estado do projeto atualizado.", "success");
      }
    } catch {
      showToast("Erro ao atualizar o estado do projeto.", "error");
    }
  };

  const handleDeleteProject = async (project: MarketplaceProject) => {
    try {
      const res = await fetch(`/api/marketplace/projects/${project.id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Projeto eliminado.", "success");
        setMarketplaceProjects((prev) => prev.filter((p) => p.id !== project.id));
      }
    } catch {
      showToast("Erro ao eliminar o projeto.", "error");
    }
  };

  const openProjectDetails = async (project: MarketplaceProject) => {
    setViewingProject(project);
    setProposalMessage("");
    setProposalBudget("");
    setProposalPortfolio("");
    setLoadingProposals(true);
    try {
      const res = await fetch(`/api/marketplace/projects/${project.id}/proposals`);
      if (res.ok) {
        const data = await res.json();
        setProjectProposals(data.proposals || []);
        setIsProjectOwnerView(data.isOwner);
      }
    } catch {
      showToast("Erro ao carregar as propostas.", "error");
    } finally {
      setLoadingProposals(false);
    }
  };

  const handleSendProposal = async () => {
    if (!viewingProject || !proposalMessage.trim()) {
      showToast("Escreva a sua proposta.", "error");
      return;
    }
    setSendingProposal(true);
    try {
      const res = await fetch(`/api/marketplace/projects/${viewingProject.id}/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: proposalMessage.trim(),
          proposedBudget: proposalBudget.trim(),
          portfolioLink: proposalPortfolio.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Proposta enviada com sucesso!", "success");
        openProjectDetails(viewingProject);
      } else {
        showToast(data.error || "Erro ao enviar a proposta.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao enviar a proposta.", "error");
    } finally {
      setSendingProposal(false);
    }
  };

  const handleRespondProposal = async (proposal: ProjectProposal, action: "accept" | "reject") => {
    if (!viewingProject) return;
    setRespondingProposalId(proposal._id);
    try {
      const res = await fetch(`/api/marketplace/projects/${viewingProject.id}/proposals/${proposal._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        openProjectDetails(viewingProject);
        loadMarketplaceProjects(projectSearch);
      } else {
        showToast(data.error || "Erro ao responder à proposta.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao responder à proposta.", "error");
    } finally {
      setRespondingProposalId(null);
    }
  };

  // --- LABORATÓRIOS (EXERCÍCIOS DE CÓDIGO) ---
  interface MarketplaceLab {
    id: string;
    title: string;
    description: string;
    language: string;
    difficulty: string;
    starterCode: string;
    stdin: string;
    expectedOutput: string;
    isPublic: boolean;
    usesCount: number;
    ownerName: string;
    isMine: boolean;
  }

  const LAB_LANGUAGES = ["python", "javascript", "typescript", "java", "c", "cpp", "csharp", "php", "ruby", "go"];

  const [labs, setLabs] = useState<MarketplaceLab[]>([]);
  const [loadingLabs, setLoadingLabs] = useState(true);
  const [labSearch, setLabSearch] = useState("");
  const [newLabTitle, setNewLabTitle] = useState("");
  const [newLabDescription, setNewLabDescription] = useState("");
  const [newLabLanguage, setNewLabLanguage] = useState("python");
  const [newLabDifficulty, setNewLabDifficulty] = useState("Iniciante");
  const [newLabStarterCode, setNewLabStarterCode] = useState("");
  const [newLabStdin, setNewLabStdin] = useState("");
  const [newLabExpectedOutput, setNewLabExpectedOutput] = useState("");
  const [newLabIsPublic, setNewLabIsPublic] = useState(true);
  const [publishingLab, setPublishingLab] = useState(false);

  const [openLab, setOpenLab] = useState<MarketplaceLab | null>(null);
  const [labCode, setLabCode] = useState("");
  const [labOutput, setLabOutput] = useState<{ stdout: string; stderr: string; passed?: boolean } | null>(null);
  const [runningLab, setRunningLab] = useState(false);

  const loadLabs = async (query: string) => {
    setLoadingLabs(true);
    try {
      const res = await fetch(`/api/marketplace/labs?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setLabs(data.labs || []);
      }
    } catch {
      showToast("Erro ao carregar os Laboratórios.", "error");
    } finally {
      setLoadingLabs(false);
    }
  };

  const handlePublishLab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabTitle.trim() || !newLabDescription.trim()) {
      showToast("Preencha o título e o enunciado do laboratório.", "error");
      return;
    }
    setPublishingLab(true);
    try {
      const res = await fetch("/api/marketplace/labs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newLabTitle.trim(),
          description: newLabDescription.trim(),
          language: newLabLanguage,
          difficulty: newLabDifficulty,
          starterCode: newLabStarterCode,
          stdin: newLabStdin,
          expectedOutput: newLabExpectedOutput,
          isPublic: newLabIsPublic,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Laboratório publicado com sucesso!", "success");
        setNewLabTitle("");
        setNewLabDescription("");
        setNewLabStarterCode("");
        setNewLabStdin("");
        setNewLabExpectedOutput("");
        loadLabs(labSearch);
      } else {
        showToast(data.error || "Erro ao publicar o Laboratório.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao publicar o Laboratório.", "error");
    } finally {
      setPublishingLab(false);
    }
  };

  const handleToggleLabVisibility = async (lab: MarketplaceLab) => {
    try {
      const res = await fetch(`/api/marketplace/labs/${lab.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !lab.isPublic }),
      });
      if (res.ok) {
        setLabs((prev) => prev.map((l) => (l.id === lab.id ? { ...l, isPublic: !l.isPublic } : l)));
      }
    } catch {
      showToast("Erro ao atualizar a visibilidade do Laboratório.", "error");
    }
  };

  const handleDeleteLab = async (lab: MarketplaceLab) => {
    try {
      const res = await fetch(`/api/marketplace/labs/${lab.id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Laboratório eliminado.", "success");
        setLabs((prev) => prev.filter((l) => l.id !== lab.id));
      }
    } catch {
      showToast("Erro ao eliminar o Laboratório.", "error");
    }
  };

  const openLabEditor = async (lab: MarketplaceLab) => {
    setOpenLab(lab);
    setLabCode(lab.starterCode || "");
    setLabOutput(null);
    try {
      const res = await fetch(`/api/marketplace/labs/${lab.id}/use`, { method: "POST" });
      if (res.ok) {
        setLabs((prev) => prev.map((l) => (l.id === lab.id ? { ...l, usesCount: l.usesCount + 1 } : l)));
      }
    } catch {
      // silencioso — não bloqueia a abertura do editor
    }
  };

  const handleRunLab = async () => {
    if (!openLab) return;
    setRunningLab(true);
    setLabOutput(null);
    try {
      const res = await fetch("/api/coding-lab/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: openLab.language,
          code: labCode,
          stdin: openLab.stdin,
          expectedOutput: openLab.expectedOutput,
          exerciseId: `marketplace-lab-${openLab.id}`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setLabOutput({ stdout: data.stdout, stderr: data.stderr, passed: data.passed });
        if (data.passed) showToast("Resultado correto!", "success");
      } else {
        showToast(data.error || "Erro ao executar o código.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao executar o código.", "error");
    } finally {
      setRunningLab(false);
    }
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
    if (tab === "models") {
      loadAiModels("");
    }
    if (tab === "prompts") {
      loadPrompts("");
    }
    if (tab === "templates") {
      loadTemplates("");
    }
    if (tab === "projects") {
      loadMarketplaceProjects("");
    }
    if (tab === "labs") {
      loadLabs("");
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
        <button
          onClick={() => setTab("models")}
          className={`h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
            tab === "models" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Bot className="h-3.5 w-3.5" /> Modelos IA
        </button>
        <button
          onClick={() => setTab("prompts")}
          className={`h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
            tab === "prompts" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <ScrollText className="h-3.5 w-3.5" /> Prompts
        </button>
        <button
          onClick={() => setTab("templates")}
          className={`h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
            tab === "templates" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <LayoutTemplate className="h-3.5 w-3.5" /> Templates
        </button>
        <button
          onClick={() => setTab("projects")}
          className={`h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
            tab === "projects" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Briefcase className="h-3.5 w-3.5" /> Projetos
        </button>
        <button
          onClick={() => setTab("labs")}
          className={`h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
            tab === "labs" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FlaskConical className="h-3.5 w-3.5" /> Laboratórios
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
      ) : tab === "datasets" ? (
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
      ) : tab === "models" ? (
        <div className="space-y-6">
          {/* Publicar Modelo IA */}
          <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Bot className="h-4.5 w-4.5 text-indigo-400" />
              Publicar Modelo IA
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Um Modelo IA é um assistente especializado (persona) com instruções e, opcionalmente,
              conhecimento próprio — executado pelo mesmo motor de IA do Tutor da plataforma. Não é
              um treino de modelo do zero: reutiliza o motor real com um "guião" (system prompt)
              e uma base de conhecimento própria opcional, indexada com o mesmo mecanismo de RAG usado
              nas lições dos cursos.
            </p>
            <form onSubmit={handlePublishModel} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  placeholder="Nome do assistente (ex: Revisor de Código Python)"
                  className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
                <input
                  value={newModelCategory}
                  onChange={(e) => setNewModelCategory(e.target.value)}
                  placeholder="Categoria (ex: Programação, Marketing, RH)"
                  className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <textarea
                value={newModelDescription}
                onChange={(e) => setNewModelDescription(e.target.value)}
                placeholder="Descrição curta: o que este assistente faz e para quem é útil..."
                className="w-full h-16 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none"
              />
              <textarea
                value={newModelSystemPrompt}
                onChange={(e) => setNewModelSystemPrompt(e.target.value)}
                placeholder="Instruções do assistente (system prompt): define o comportamento, tom e regras que a IA deve seguir..."
                className="w-full h-24 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none"
              />
              <textarea
                value={newModelKnowledge}
                onChange={(e) => setNewModelKnowledge(e.target.value)}
                placeholder="(Opcional) Conhecimento próprio: cole aqui texto de referência (FAQ, políticas, documentação) que o assistente deve consultar..."
                className="w-full h-20 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none"
              />
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={newModelIsPublic} onChange={(e) => setNewModelIsPublic(e.target.checked)} className="h-4 w-4 accent-indigo-500" />
                <span className="text-xs text-slate-300">Publicar como público (visível para todos no Marketplace)</span>
              </label>
              <button
                type="submit"
                disabled={publishingModel}
                className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-55"
              >
                {publishingModel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                {publishingModel ? "A publicar..." : "Publicar Modelo IA"}
              </button>
            </form>
          </div>

          {/* Pesquisa e Lista */}
          <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Search className="h-4.5 w-4.5 text-indigo-400" />
              Modelos IA Disponíveis
            </h3>
            <input
              value={aiModelSearch}
              onChange={(e) => {
                setAiModelSearch(e.target.value);
                loadAiModels(e.target.value);
              }}
              placeholder="Pesquisar por nome ou categoria..."
              className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
            />

            {loadingAiModels ? (
              <div className="flex items-center justify-center py-8 text-slate-500 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
              </div>
            ) : aiModels.length === 0 ? (
              <div className="border border-slate-900 border-dashed rounded-2xl p-8 text-center">
                <span className="text-xs text-slate-500">Ainda não há Modelos IA publicados para esta pesquisa.</span>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {aiModels.map((model) => (
                  <div key={model.id} className="border border-slate-900 bg-slate-950/60 rounded-2xl p-4 space-y-3 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">{model.category}</span>
                        <h4 className="font-bold text-xs text-white truncate">{model.name}</h4>
                      </div>
                      {model.isMine && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleToggleModelVisibility(model)}
                            title={model.isPublic ? "Tornar privado" : "Tornar público"}
                            className="h-6 w-6 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer"
                          >
                            {model.isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                          </button>
                          <button
                            onClick={() => handleDeleteModel(model)}
                            className="h-6 w-6 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed flex-1">{model.description}</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500">
                      {model.hasKnowledge && (
                        <span className="flex items-center gap-1 text-emerald-400"><Database className="h-3 w-3" /> Com conhecimento próprio</span>
                      )}
                      <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {model.usesCount} usos</span>
                    </div>
                    <span className="text-[10px] text-slate-600">Por {model.ownerName}</span>
                    <button
                      onClick={() => openTestModel(model)}
                      className="h-8 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-[11px] font-semibold text-indigo-400 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Conversar (1 Crédito IA/msg)
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Painel de teste/conversa */}
          {testingModel && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setTestingModel(null)}>
              <div
                className="w-full max-w-lg h-[70vh] bg-slate-950 border border-slate-800 rounded-3xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-slate-900 flex items-center justify-between shrink-0">
                  <div>
                    <h4 className="font-bold text-sm text-white">{testingModel.name}</h4>
                    <span className="text-[10px] text-slate-500">{testingModel.category}</span>
                  </div>
                  <button onClick={() => setTestingModel(null)} className="text-slate-500 hover:text-slate-300 cursor-pointer text-xs">
                    Fechar
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {testMessages.length === 0 && (
                    <span className="text-xs text-slate-600 italic">Escreva uma mensagem para começar a conversar com este assistente.</span>
                  )}
                  {testMessages.map((m, i) => (
                    <div
                      key={i}
                      className={`text-xs p-3 rounded-2xl max-w-[85%] leading-relaxed whitespace-pre-wrap ${
                        m.role === "user" ? "bg-indigo-600 text-white ml-auto" : "bg-slate-900 text-slate-200"
                      }`}
                    >
                      {m.content || (testLoading && i === testMessages.length - 1 ? "..." : "")}
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-slate-900 flex gap-2 shrink-0">
                  <input
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !testLoading) handleSendTestMessage();
                    }}
                    placeholder="Escreva a sua mensagem..."
                    className="flex-1 h-10 px-3 rounded-xl border border-slate-800 bg-slate-900 text-white text-xs focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    onClick={handleSendTestMessage}
                    disabled={testLoading}
                    className="h-10 w-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center cursor-pointer disabled:opacity-55 shrink-0"
                  >
                    {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : tab === "prompts" ? (
        <div className="space-y-6">
          {/* Publicar Prompt */}
          <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <ScrollText className="h-4.5 w-4.5 text-indigo-400" />
              Publicar Prompt
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Um Prompt é um template de instrução reutilizável. Use <code className="text-indigo-400">{"{{variavel}}"}</code> para
              marcar partes que devem ser preenchidas antes de usar — por exemplo, <code className="text-indigo-400">{"{{tema}}"}</code>{" "}
              ou <code className="text-indigo-400">{"{{publico_alvo}}"}</code>. Qualquer pessoa pode depois preencher essas variáveis
              e executar o prompt diretamente com o motor real de IA, ou simplesmente copiar o template para usar noutro lugar.
            </p>
            <form onSubmit={handlePublishPrompt} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  value={newPromptTitle}
                  onChange={(e) => setNewPromptTitle(e.target.value)}
                  placeholder="Título (ex: Gerador de Anúncio de Vaga)"
                  className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
                <input
                  value={newPromptCategory}
                  onChange={(e) => setNewPromptCategory(e.target.value)}
                  placeholder="Categoria (ex: RH, Marketing, Programação)"
                  className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <textarea
                value={newPromptDescription}
                onChange={(e) => setNewPromptDescription(e.target.value)}
                placeholder="Descrição curta: para que serve este prompt..."
                className="w-full h-14 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none"
              />
              <textarea
                value={newPromptTemplate}
                onChange={(e) => setNewPromptTemplate(e.target.value)}
                placeholder={"Template do prompt, ex: \"Escreve um anúncio de vaga para {{cargo}} na área de {{area}}, com tom {{tom}}.\""}
                className="w-full h-24 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none font-mono"
              />
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={newPromptIsPublic} onChange={(e) => setNewPromptIsPublic(e.target.checked)} className="h-4 w-4 accent-indigo-500" />
                <span className="text-xs text-slate-300">Publicar como público (visível para todos no Marketplace)</span>
              </label>
              <button
                type="submit"
                disabled={publishingPrompt}
                className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-55"
              >
                {publishingPrompt ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScrollText className="h-4 w-4" />}
                {publishingPrompt ? "A publicar..." : "Publicar Prompt"}
              </button>
            </form>
          </div>

          {/* Pesquisa e Lista */}
          <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Search className="h-4.5 w-4.5 text-indigo-400" />
              Prompts Disponíveis
            </h3>
            <input
              value={promptSearch}
              onChange={(e) => {
                setPromptSearch(e.target.value);
                loadPrompts(e.target.value);
              }}
              placeholder="Pesquisar por título ou categoria..."
              className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
            />

            {loadingPrompts ? (
              <div className="flex items-center justify-center py-8 text-slate-500 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
              </div>
            ) : prompts.length === 0 ? (
              <div className="border border-slate-900 border-dashed rounded-2xl p-8 text-center">
                <span className="text-xs text-slate-500">Ainda não há Prompts publicados para esta pesquisa.</span>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {prompts.map((prompt) => (
                  <div key={prompt.id} className="border border-slate-900 bg-slate-950/60 rounded-2xl p-4 space-y-3 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">{prompt.category}</span>
                        <h4 className="font-bold text-xs text-white truncate">{prompt.title}</h4>
                      </div>
                      {prompt.isMine && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleTogglePromptVisibility(prompt)}
                            title={prompt.isPublic ? "Tornar privado" : "Tornar público"}
                            className="h-6 w-6 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer"
                          >
                            {prompt.isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                          </button>
                          <button
                            onClick={() => handleDeletePrompt(prompt)}
                            className="h-6 w-6 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    {prompt.description && <p className="text-[11px] text-slate-400 leading-relaxed">{prompt.description}</p>}
                    <code className="text-[10px] text-slate-500 bg-slate-950/60 rounded-lg p-2 block leading-relaxed line-clamp-3 flex-1">
                      {prompt.template}
                    </code>
                    {prompt.variables.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {prompt.variables.map((v) => (
                          <span key={v} className="text-[9px] font-mono font-bold text-indigo-400 bg-indigo-500/5 border border-indigo-500/10 px-2 py-0.5 rounded-full">
                            {"{{"}{v}{"}}"}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1"><Wand2 className="h-3 w-3" /> {prompt.usesCount} usos</span>
                    </div>
                    <span className="text-[10px] text-slate-600">Por {prompt.ownerName}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCopyPrompt(prompt)}
                        className="h-8 px-3 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar
                      </button>
                      <button
                        onClick={() => openRunPrompt(prompt)}
                        className="flex-1 h-8 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-[11px] font-semibold text-indigo-400 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                        Executar (1 Crédito IA)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Painel de execução */}
          {runningPrompt && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setRunningPrompt(null)}>
              <div
                className="w-full max-w-lg max-h-[80vh] bg-slate-950 border border-slate-800 rounded-3xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-slate-900 flex items-center justify-between shrink-0">
                  <div>
                    <h4 className="font-bold text-sm text-white">{runningPrompt.title}</h4>
                    <span className="text-[10px] text-slate-500">{runningPrompt.category}</span>
                  </div>
                  <button onClick={() => setRunningPrompt(null)} className="text-slate-500 hover:text-slate-300 cursor-pointer text-xs">
                    Fechar
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {runningPrompt.variables.length === 0 ? (
                    <span className="text-xs text-slate-600 italic">Este prompt não tem variáveis — pode executá-lo diretamente.</span>
                  ) : (
                    runningPrompt.variables.map((v) => (
                      <div key={v} className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{v}</label>
                        <input
                          value={runVariables[v] || ""}
                          onChange={(e) => setRunVariables((prev) => ({ ...prev, [v]: e.target.value }))}
                          className="w-full h-9 px-3 rounded-lg border border-slate-800 bg-slate-900 text-white text-xs focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    ))
                  )}
                  {runResult && (
                    <div className="pt-3 border-t border-slate-900 space-y-1.5">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Resultado</span>
                      <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap bg-slate-900/60 rounded-xl p-3">{runResult}</p>
                    </div>
                  )}
                </div>
                <div className="p-3 border-t border-slate-900 shrink-0">
                  <button
                    onClick={handleRunPrompt}
                    disabled={runLoading}
                    className="w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
                  >
                    {runLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    {runLoading ? "A executar..." : "Executar Prompt"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : tab === "templates" ? (
        <div className="space-y-6">
          {/* Publicar Template */}
          <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <LayoutTemplate className="h-4.5 w-4.5 text-indigo-400" />
              Publicar Template
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Um Template é uma estrutura de documento pronta a reutilizar (contrato, checklist, briefing
              de projeto, plano de aula, etc.), escrita diretamente em texto/Markdown — diferente de um
              Prompt (instruções para a IA), aqui o conteúdo é o próprio documento final que se copia ou
              descarrega tal como está.
            </p>
            <form onSubmit={handlePublishTemplate} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  value={newTemplateTitle}
                  onChange={(e) => setNewTemplateTitle(e.target.value)}
                  placeholder="Título (ex: Checklist de Onboarding)"
                  className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
                <input
                  value={newTemplateCategory}
                  onChange={(e) => setNewTemplateCategory(e.target.value)}
                  placeholder="Categoria (ex: RH, Jurídico, Projetos)"
                  className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <textarea
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                placeholder="Descrição curta: para que serve este template..."
                className="w-full h-14 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none"
              />
              <textarea
                value={newTemplateContent}
                onChange={(e) => setNewTemplateContent(e.target.value)}
                placeholder={"Conteúdo do template em Markdown, ex:\n# Checklist de Onboarding\n1. ...\n2. ..."}
                className="w-full h-32 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none font-mono"
              />
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={newTemplateIsPublic} onChange={(e) => setNewTemplateIsPublic(e.target.checked)} className="h-4 w-4 accent-indigo-500" />
                <span className="text-xs text-slate-300">Publicar como público (visível para todos no Marketplace)</span>
              </label>
              <button
                type="submit"
                disabled={publishingTemplate}
                className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-55"
              >
                {publishingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutTemplate className="h-4 w-4" />}
                {publishingTemplate ? "A publicar..." : "Publicar Template"}
              </button>
            </form>
          </div>

          {/* Pesquisa e Lista */}
          <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Search className="h-4.5 w-4.5 text-indigo-400" />
              Templates Disponíveis
            </h3>
            <input
              value={templateSearch}
              onChange={(e) => {
                setTemplateSearch(e.target.value);
                loadTemplates(e.target.value);
              }}
              placeholder="Pesquisar por título ou categoria..."
              className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
            />

            {loadingTemplates ? (
              <div className="flex items-center justify-center py-8 text-slate-500 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
              </div>
            ) : templates.length === 0 ? (
              <div className="border border-slate-900 border-dashed rounded-2xl p-8 text-center">
                <span className="text-xs text-slate-500">Ainda não há Templates publicados para esta pesquisa.</span>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <div key={template.id} className="border border-slate-900 bg-slate-950/60 rounded-2xl p-4 space-y-3 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">{template.category}</span>
                        <h4 className="font-bold text-xs text-white truncate">{template.title}</h4>
                      </div>
                      {template.isMine && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleToggleTemplateVisibility(template)}
                            title={template.isPublic ? "Tornar privado" : "Tornar público"}
                            className="h-6 w-6 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer"
                          >
                            {template.isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template)}
                            className="h-6 w-6 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    {template.description && <p className="text-[11px] text-slate-400 leading-relaxed">{template.description}</p>}
                    <button
                      onClick={() => setPreviewingTemplate(template)}
                      className="text-left text-[10px] text-slate-500 bg-slate-950/60 rounded-lg p-2 leading-relaxed line-clamp-3 flex-1 font-mono cursor-pointer hover:bg-slate-950"
                    >
                      {template.content}
                    </button>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1"><Download className="h-3 w-3" /> {template.usesCount} usos</span>
                    </div>
                    <span className="text-[10px] text-slate-600">Por {template.ownerName}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCopyTemplate(template)}
                        className="flex-1 h-8 px-3 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar
                      </button>
                      <button
                        onClick={() => handleDownloadTemplate(template)}
                        className="flex-1 h-8 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-[11px] font-semibold text-indigo-400 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Descarregar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pré-visualização */}
          {previewingTemplate && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setPreviewingTemplate(null)}>
              <div
                className="w-full max-w-lg max-h-[80vh] bg-slate-950 border border-slate-800 rounded-3xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-slate-900 flex items-center justify-between shrink-0">
                  <h4 className="font-bold text-sm text-white">{previewingTemplate.title}</h4>
                  <button onClick={() => setPreviewingTemplate(null)} className="text-slate-500 hover:text-slate-300 cursor-pointer text-xs">
                    Fechar
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <pre className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap font-mono">{previewingTemplate.content}</pre>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : tab === "projects" ? (
        <div className="space-y-6">
          {/* Publicar Projeto */}
          <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Briefcase className="h-4.5 w-4.5 text-indigo-400" />
              Publicar Projeto
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              A Bolsa de Projetos é para trabalhos pontuais/freelance (não é uma vaga de emprego —
              isso está em "Empresas" — nem uma entrega de curso). Qualquer pessoa ou empresa pode
              publicar um projeto; outros utilizadores submetem propostas e o autor escolhe uma.
            </p>
            <form onSubmit={handlePublishProject} className="space-y-3">
              <input
                value={newProjectTitle}
                onChange={(e) => setNewProjectTitle(e.target.value)}
                placeholder="Título (ex: Landing page para lançamento de produto)"
                className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
              />
              <textarea
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                placeholder="Descreva o âmbito e os objetivos do projeto..."
                className="w-full h-20 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none"
              />
              <input
                value={newProjectSkills}
                onChange={(e) => setNewProjectSkills(e.target.value)}
                placeholder="Competências necessárias, separadas por vírgula (ex: React, Design, Copywriting)"
                className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
              />
              <div className="grid sm:grid-cols-3 gap-3">
                <select
                  value={newProjectBudgetType}
                  onChange={(e) => setNewProjectBudgetType(e.target.value as "fixo" | "portefolio")}
                  className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="fixo">Orçamento fixo</option>
                  <option value="portefolio">Para portefólio (sem pagamento)</option>
                </select>
                <input
                  value={newProjectBudget}
                  onChange={(e) => setNewProjectBudget(e.target.value)}
                  placeholder={newProjectBudgetType === "fixo" ? "Valor (ex: 500€)" : "Contrapartida (opcional)"}
                  className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
                <input
                  type="date"
                  value={newProjectDeadline}
                  onChange={(e) => setNewProjectDeadline(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={publishingProject}
                className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-55"
              >
                {publishingProject ? <Loader2 className="h-4 w-4 animate-spin" /> : <Briefcase className="h-4 w-4" />}
                {publishingProject ? "A publicar..." : "Publicar Projeto"}
              </button>
            </form>
          </div>

          {/* Pesquisa e Lista */}
          <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Search className="h-4.5 w-4.5 text-indigo-400" />
              Projetos em Aberto
            </h3>
            <input
              value={projectSearch}
              onChange={(e) => {
                setProjectSearch(e.target.value);
                loadMarketplaceProjects(e.target.value);
              }}
              placeholder="Pesquisar por título ou competência..."
              className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
            />

            {loadingMarketplaceProjects ? (
              <div className="flex items-center justify-center py-8 text-slate-500 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
              </div>
            ) : marketplaceProjects.length === 0 ? (
              <div className="border border-slate-900 border-dashed rounded-2xl p-8 text-center">
                <span className="text-xs text-slate-500">Ainda não há projetos publicados para esta pesquisa.</span>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {marketplaceProjects.map((project) => {
                  const cfg = PROJECT_STATUS_CONFIG[project.status];
                  return (
                    <div key={project.id} className="border border-slate-900 bg-slate-950/60 rounded-2xl p-4 space-y-3 flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-xs text-white">{project.title}</h4>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed flex-1">{project.description}</p>
                      {project.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {project.skills.map((s) => (
                            <span key={s} className="text-[9px] font-mono font-bold text-indigo-400 bg-indigo-500/5 border border-indigo-500/10 px-2 py-0.5 rounded-full">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1"><Coins className="h-3 w-3" /> {project.budgetType === "fixo" ? project.budget || "A combinar" : "Portefólio"}</span>
                        {project.deadline && (
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(project.deadline).toLocaleDateString("pt-PT")}</span>
                        )}
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {project.proposalsCount} propostas</span>
                      </div>
                      <span className="text-[10px] text-slate-600">Por {project.posterName}</span>
                      <div className="flex gap-2">
                        {project.isMine && (
                          <button
                            onClick={() => handleDeleteProject(project)}
                            className="h-8 w-8 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 flex items-center justify-center cursor-pointer shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => openProjectDetails(project)}
                          className="flex-1 h-8 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-[11px] font-semibold text-indigo-400 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {project.isMine ? "Ver Propostas" : "Ver Detalhes / Propor"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Painel de detalhes / propostas */}
          {viewingProject && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setViewingProject(null)}>
              <div
                className="w-full max-w-xl max-h-[85vh] bg-slate-950 border border-slate-800 rounded-3xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-slate-900 flex items-center justify-between shrink-0">
                  <div>
                    <h4 className="font-bold text-sm text-white">{viewingProject.title}</h4>
                    <span className="text-[10px] text-slate-500">Por {viewingProject.posterName}</span>
                  </div>
                  <button onClick={() => setViewingProject(null)} className="text-slate-500 hover:text-slate-300 cursor-pointer text-xs">
                    Fechar
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <p className="text-xs text-slate-300 leading-relaxed">{viewingProject.description}</p>

                  {loadingProposals ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
                    </div>
                  ) : isProjectOwnerView ? (
                    <div className="space-y-3 pt-3 border-t border-slate-900">
                      <h5 className="font-bold text-xs text-white">Propostas Recebidas</h5>
                      {projectProposals.length === 0 ? (
                        <span className="text-xs text-slate-500">Ainda não recebeu propostas.</span>
                      ) : (
                        projectProposals.map((p) => (
                          <div key={p._id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-900 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white">{p.applicantName}</span>
                              {p.proposedBudget && <span className="text-[10px] text-emerald-400">{p.proposedBudget}</span>}
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed">{p.message}</p>
                            {p.portfolioLink && (
                              <a href={p.portfolioLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-400 underline block">
                                {p.portfolioLink}
                              </a>
                            )}
                            {p.status === "pending" ? (
                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={() => handleRespondProposal(p, "reject")}
                                  disabled={respondingProposalId === p._id}
                                  className="h-7 px-3 rounded-lg border border-slate-800 text-[10px] font-semibold text-slate-400 hover:bg-slate-900 cursor-pointer disabled:opacity-55 flex items-center gap-1"
                                >
                                  <ThumbsDown className="h-3 w-3" /> Recusar
                                </button>
                                <button
                                  onClick={() => handleRespondProposal(p, "accept")}
                                  disabled={respondingProposalId === p._id}
                                  className="h-7 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[10px] font-semibold text-white cursor-pointer disabled:opacity-55 flex items-center gap-1"
                                >
                                  <ThumbsUp className="h-3 w-3" /> Aceitar
                                </button>
                              </div>
                            ) : (
                              <span
                                className={`text-[9px] font-bold px-2 py-0.5 rounded-full border inline-block ${
                                  p.status === "accepted"
                                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                    : "text-slate-400 bg-slate-500/10 border-slate-500/20"
                                }`}
                              >
                                {p.status === "accepted" ? "Aceite" : "Recusada"}
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 pt-3 border-t border-slate-900">
                      {projectProposals.length > 0 ? (
                        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-900 space-y-1.5">
                          <span className="text-xs font-bold text-white">A sua proposta</span>
                          <p className="text-[11px] text-slate-400 leading-relaxed">{projectProposals[0].message}</p>
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full border inline-block ${
                              projectProposals[0].status === "accepted"
                                ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                : projectProposals[0].status === "rejected"
                                  ? "text-slate-400 bg-slate-500/10 border-slate-500/20"
                                  : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                            }`}
                          >
                            {projectProposals[0].status === "accepted" ? "Aceite" : projectProposals[0].status === "rejected" ? "Recusada" : "Pendente"}
                          </span>
                        </div>
                      ) : viewingProject.status === "open" ? (
                        <>
                          <h5 className="font-bold text-xs text-white">Enviar Proposta</h5>
                          <textarea
                            value={proposalMessage}
                            onChange={(e) => setProposalMessage(e.target.value)}
                            placeholder="Explique a sua abordagem e experiência relevante..."
                            className="w-full h-20 p-3 rounded-xl border border-slate-800 bg-slate-900 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none"
                          />
                          <div className="grid sm:grid-cols-2 gap-3">
                            <input
                              value={proposalBudget}
                              onChange={(e) => setProposalBudget(e.target.value)}
                              placeholder="Valor proposto (opcional)"
                              className="h-9 px-3 rounded-lg border border-slate-800 bg-slate-900 text-white text-xs focus:border-indigo-500 focus:outline-none"
                            />
                            <input
                              value={proposalPortfolio}
                              onChange={(e) => setProposalPortfolio(e.target.value)}
                              placeholder="Link de portefólio (opcional)"
                              className="h-9 px-3 rounded-lg border border-slate-800 bg-slate-900 text-white text-xs focus:border-indigo-500 focus:outline-none"
                            />
                          </div>
                          <button
                            onClick={handleSendProposal}
                            disabled={sendingProposal}
                            className="w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
                          >
                            {sendingProposal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            {sendingProposal ? "A enviar..." : "Enviar Proposta"}
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Este projeto já não está a aceitar propostas.</span>
                      )}
                    </div>
                  )}

                  {isProjectOwnerView && viewingProject.status !== "completed" && (
                    <button
                      onClick={() => handleUpdateProjectStatus(viewingProject, "completed")}
                      className="w-full h-9 rounded-xl border border-slate-800 hover:bg-slate-900 text-xs font-semibold text-slate-300 cursor-pointer"
                    >
                      Marcar Projeto como Concluído
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Publicar Laboratório */}
          <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <FlaskConical className="h-4.5 w-4.5 text-indigo-400" />
              Publicar Laboratório
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Um Laboratório é um exercício de código independente de qualquer curso — enunciado,
              código inicial e, opcionalmente, um resultado esperado. É executado no mesmo motor real
              (Piston) do Coding Lab das aulas, com o código a correr de verdade, não simulado.
            </p>
            <form onSubmit={handlePublishLab} className="space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
                <input
                  value={newLabTitle}
                  onChange={(e) => setNewLabTitle(e.target.value)}
                  placeholder="Título (ex: Inversão de String)"
                  className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none sm:col-span-1"
                />
                <select
                  value={newLabLanguage}
                  onChange={(e) => setNewLabLanguage(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
                >
                  {LAB_LANGUAGES.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
                <select
                  value={newLabDifficulty}
                  onChange={(e) => setNewLabDifficulty(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option>Iniciante</option>
                  <option>Intermédio</option>
                  <option>Avançado</option>
                </select>
              </div>
              <textarea
                value={newLabDescription}
                onChange={(e) => setNewLabDescription(e.target.value)}
                placeholder="Enunciado do exercício: o que o código deve fazer..."
                className="w-full h-20 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none"
              />
              <textarea
                value={newLabStarterCode}
                onChange={(e) => setNewLabStarterCode(e.target.value)}
                placeholder="Código inicial (opcional)..."
                className="w-full h-24 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none font-mono"
              />
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  value={newLabStdin}
                  onChange={(e) => setNewLabStdin(e.target.value)}
                  placeholder="Entrada padrão / stdin (opcional)"
                  className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none font-mono"
                />
                <input
                  value={newLabExpectedOutput}
                  onChange={(e) => setNewLabExpectedOutput(e.target.value)}
                  placeholder="Resultado esperado (opcional — valida automaticamente)"
                  className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none font-mono"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={newLabIsPublic} onChange={(e) => setNewLabIsPublic(e.target.checked)} className="h-4 w-4 accent-indigo-500" />
                <span className="text-xs text-slate-300">Publicar como público (visível para todos no Marketplace)</span>
              </label>
              <button
                type="submit"
                disabled={publishingLab}
                className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-55"
              >
                {publishingLab ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                {publishingLab ? "A publicar..." : "Publicar Laboratório"}
              </button>
            </form>
          </div>

          {/* Pesquisa e Lista */}
          <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Search className="h-4.5 w-4.5 text-indigo-400" />
              Laboratórios Disponíveis
            </h3>
            <input
              value={labSearch}
              onChange={(e) => {
                setLabSearch(e.target.value);
                loadLabs(e.target.value);
              }}
              placeholder="Pesquisar por título ou linguagem..."
              className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
            />

            {loadingLabs ? (
              <div className="flex items-center justify-center py-8 text-slate-500 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
              </div>
            ) : labs.length === 0 ? (
              <div className="border border-slate-900 border-dashed rounded-2xl p-8 text-center">
                <span className="text-xs text-slate-500">Ainda não há Laboratórios publicados para esta pesquisa.</span>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {labs.map((lab) => (
                  <div key={lab.id} className="border border-slate-900 bg-slate-950/60 rounded-2xl p-4 space-y-3 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">{lab.language} · {lab.difficulty}</span>
                        <h4 className="font-bold text-xs text-white truncate">{lab.title}</h4>
                      </div>
                      {lab.isMine && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleToggleLabVisibility(lab)}
                            title={lab.isPublic ? "Tornar privado" : "Tornar público"}
                            className="h-6 w-6 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer"
                          >
                            {lab.isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                          </button>
                          <button
                            onClick={() => handleDeleteLab(lab)}
                            className="h-6 w-6 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed flex-1">{lab.description}</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1"><Play className="h-3 w-3" /> {lab.usesCount} execuções</span>
                    </div>
                    <span className="text-[10px] text-slate-600">Por {lab.ownerName}</span>
                    <button
                      onClick={() => openLabEditor(lab)}
                      className="h-8 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-[11px] font-semibold text-indigo-400 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Terminal className="h-3.5 w-3.5" />
                      Abrir no Editor
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Editor / execução real (Piston) */}
          {openLab && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setOpenLab(null)}>
              <div
                className="w-full max-w-2xl max-h-[85vh] bg-slate-950 border border-slate-800 rounded-3xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-slate-900 flex items-center justify-between shrink-0">
                  <div>
                    <h4 className="font-bold text-sm text-white">{openLab.title}</h4>
                    <span className="text-[10px] text-slate-500">{openLab.language} · {openLab.difficulty}</span>
                  </div>
                  <button onClick={() => setOpenLab(null)} className="text-slate-500 hover:text-slate-300 cursor-pointer text-xs">
                    Fechar
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <p className="text-xs text-slate-300 leading-relaxed">{openLab.description}</p>
                  <textarea
                    value={labCode}
                    onChange={(e) => setLabCode(e.target.value)}
                    spellCheck={false}
                    className="w-full h-52 p-3 rounded-xl border border-slate-800 bg-black text-emerald-400 text-xs focus:border-indigo-500 focus:outline-none resize-none font-mono"
                  />
                  {labOutput && (
                    <div className="space-y-2">
                      {labOutput.passed !== undefined && labOutput.passed !== null && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-block ${
                            labOutput.passed
                              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                              : "text-rose-400 bg-rose-500/10 border-rose-500/20"
                          }`}
                        >
                          {labOutput.passed ? "Resultado correto" : "Resultado incorreto"}
                        </span>
                      )}
                      <pre className="text-[11px] text-slate-300 bg-black rounded-lg p-3 whitespace-pre-wrap font-mono">{labOutput.stdout || "(sem output)"}</pre>
                      {labOutput.stderr && (
                        <pre className="text-[11px] text-rose-400 bg-black rounded-lg p-3 whitespace-pre-wrap font-mono">{labOutput.stderr}</pre>
                      )}
                    </div>
                  )}
                </div>
                <div className="p-3 border-t border-slate-900 shrink-0">
                  <button
                    onClick={handleRunLab}
                    disabled={runningLab}
                    className="w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
                  >
                    {runningLab ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    {runningLab ? "A executar..." : "Executar Código"}
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
