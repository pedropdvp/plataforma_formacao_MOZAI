"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CourseEditModal } from "@/components/ui/course-edit-modal";
import { BlockEditor } from "@/components/lesson-blocks/BlockEditor";
import { MediaLibraryPanel } from "@/components/lesson-blocks/MediaLibraryPanel";
import { EditingPresenceIndicator } from "@/components/lesson-blocks/EditingPresenceIndicator";
import { CourseMapButton } from "@/components/lesson-blocks/CourseMapCanvas";
import { LessonBlock, blocksToPlainText, getOrMigrateBlocks } from "@/lib/lesson-blocks";
import {
  Sparkles,
  FileText,
  Layers,
  Check,
  Loader2,
  ArrowRight,
  Trash2,
  Calendar,
  Plus,
  X,
  BookOpen,
  Award,
  UploadCloud,
  ChevronRight,
  ChevronDown,
  Edit2,
  Eye,
  Globe,
  SquarePlay,
  FileIcon,
  BarChart3,
} from "lucide-react";
import { CourseAnalyticsPanel } from "@/components/lesson-blocks/CourseAnalyticsPanel";

type Step = "BRIEF" | "OUTLINE" | "GENERATION" | "REVIEW";

export default function ContentFactoryPage() {
  const [step, setStep] = useState<Step>("BRIEF");
  const [jobId, setJobId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);

  // --- STEP 1: BRIEF STATE ---
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("Intermédio");
  const [duration, setDuration] = useState("4 semanas");
  const [objectives, setObjectives] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [briefingId, setBriefingId] = useState<string>("");
  const [attachments, setAttachments] = useState<{ name: string; size: number; source?: "file" | "url" | "youtube" }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [generatingOutline, setGeneratingOutline] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [importingUrl, setImportingUrl] = useState(false);
  const [youtubeInput, setYoutubeInput] = useState("");
  const [importingYoutube, setImportingYoutube] = useState(false);

  // --- STEP 2: OUTLINE STATE ---
  const [outline, setOutline] = useState<any>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [tempTitle, setTempTitle] = useState("");
  const [tempDesc, setTempDesc] = useState("");
  const [activeModuleIdx, setActiveModuleIdx] = useState<number | null>(null);
  const [startingGeneration, setStartingGeneration] = useState(false);

  // --- STEP 3: GENERATION STATE ---
  const [progress, setProgress] = useState(0);
  const [genStatus, setGenStatus] = useState("PENDING");
  const [currentLessonIdx, setCurrentLessonIdx] = useState(0);
  const [totalLessons, setTotalLessons] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);

  // --- STEP 4: REVIEW STATE ---
  const [fullCourse, setFullCourse] = useState<any>(null);
  const [selectedModuleIdx, setSelectedModuleIdx] = useState(0);
  const [selectedLessonIdx, setSelectedLessonIdx] = useState(0);
  const [savingContent, setSavingContent] = useState(false);
  const [reviewingAction, setReviewingAction] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const { showToast } = useToast();
  const confirmDialog = useConfirm();
  const router = useRouter();
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [analyticsCourseId, setAnalyticsCourseId] = useState<string | null>(null);

  // --- HISTORY STATE ---
  const [savedCourses, setSavedCourses] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Carregar histórico de cursos no MongoDB
  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/catalog");
      if (res.ok) {
        const data = await res.json();
        // Filtrar apenas cursos de IA
        const aiCourses = (data.courses || []).filter((c: any) => c.category === "IA Custom");
        setSavedCourses(aiCourses);
      }
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDeleteCourse = async (course: any) => {
    const confirmed = await confirmDialog({
      title: "Apagar Curso",
      message: `Tem a certeza que deseja apagar "${course.title}"? Esta ação é irreversível.`,
      confirmLabel: "Apagar",
      destructive: true,
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/courses/review?courseId=${course._id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        showToast("Curso apagado com sucesso.", "success");
        fetchHistory();
      } else {
        showToast(data.error || "Erro ao apagar curso.", "error");
      }
    } catch (err) {
      showToast("Erro de comunicação ao apagar curso.", "error");
    }
  };

  // Polling para progresso de geração
  useEffect(() => {
    let interval: any;
    if (step === "GENERATION" && jobId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/admin/courses/generate/status?jobId=${jobId}`);
          if (res.ok) {
            const data = await res.json();
            setProgress(data.progress || 0);
            setGenStatus(data.status);
            setCurrentLessonIdx(data.currentLessonIndex || 0);
            setTotalLessons(data.totalLessons || 0);

            if (data.status === "COMPLETED" && data.resultCourseId) {
              setCourseId(data.resultCourseId);
              clearInterval(interval);
              // Carregar curso completo para revisão
              await loadCourseForReview(data.resultCourseId);
              setStep("REVIEW");
            } else if (data.status === "FAILED") {
              setGenError(data.error || "Ocorreu um erro na geração.");
              clearInterval(interval);
            }
          }
        } catch (err: any) {
          console.error("Erro ao verificar progresso:", err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [step, jobId]);

  const loadCourseForReview = async (id: string) => {
    try {
      const res = await fetch(`/api/catalog`);
      if (res.ok) {
        const cat = await res.json();
        // Puxar detalhes do curso no MongoDB simulando a página
        const detailsRes = await fetch(`/api/admin/courses/review?courseId=${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId: id, action: "get_details" })
        });
        // Como o endpoint review só aceita approve/reject, podemos buscar o curso diretamente simulando o loading da aula
        // Mas podemos fazer um GET especial ou usar as informações guardadas em MongoDB
        // Vamos buscar da base de dados localmente carregando o catálogo
      }
      
      // Carregar curso diretamente via MongoDB fetch local simulado
      const detailsRes = await fetch(`/api/admin/courses/generate/status?jobId=${jobId}`);
      if (detailsRes.ok) {
        // Para simplificar, faremos um fetch do catálogo completo ou obteremos os dados retornados
        // Vamos carregar o curso a partir do banco de dados na rota do catálogo ou criando um GET rápido
      }

      // Vamos criar um endpoint rápido na API para buscar os detalhes do curso rascunho
      const fetchCourse = await fetch(`/api/admin/courses/generate/status?jobId=${jobId}`); // fallback
      // Mas para o review, precisamos ver a estrutura completa. Vamos buscar da API
      const r = await fetch(`/api/admin/courses/generate/status?jobId=${jobId}`);
    } catch (e) {
      console.error(e);
    }
  };

  // Carrega curso para revisão a partir de MongoDB
  const fetchCourseData = async (cId: string) => {
    try {
      // Usando uma chamada fictícia ou endpoint para obter o rascunho completo
      const res = await fetch(`/api/admin/courses/generate/status?jobId=${jobId}`);
      // Como precisamos ler os módulos completos do curso rascunho de IA,
      // faremos um fetch usando uma API existente ou estendendo o review.ts
    } catch {}
  };

  useEffect(() => {
    if (step === "REVIEW" && courseId) {
      // Buscar os detalhes completos do curso
      const load = async () => {
        try {
          const res = await fetch(`/api/admin/courses/generate/status?jobId=${jobId}`);
          // Para contornar e carregar o curso completo de forma robusta, podemos
          // estender a API do review para nos dar o rascunho do curso!
          const detailsRes = await fetch(`/api/admin/courses/generate/status?jobId=${jobId}`);
          // Fazer chamada ao MongoDB indiretamente através de uma API existente
          const response = await fetch(`/api/admin/courses/generate/status?jobId=${jobId}`);
        } catch {}
      };
      load();
    }
  }, [step, courseId]);

  // Tratar Upload de Ficheiros
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    const newAttachments = [...attachments];

    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
      newAttachments.push({ name: files[i].name, size: files[i].size, source: "file" as const });
    }

    const currentBriefingId = briefingId || Math.random().toString(36).substring(7);
    formData.append("briefingId", currentBriefingId);

    try {
      const res = await fetch("/api/admin/courses/generate/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setBriefingId(data.briefingId);
        setAttachments(newAttachments);
      } else {
        showToast("Falha ao carregar ficheiros.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Erro ao enviar ficheiros.", "error");
    } finally {
      setUploading(false);
    }
  };

  // Tratar Importação de uma URL de site (artigo/documentação)
  const handleImportUrl = async () => {
    if (!urlInput.trim()) return;
    setImportingUrl(true);
    try {
      const currentBriefingId = briefingId || Math.random().toString(36).substring(7);
      const res = await fetch("/api/admin/courses/generate/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim(), briefingId: currentBriefingId }),
      });
      const data = await res.json();
      if (res.ok) {
        setBriefingId(data.briefingId);
        setAttachments((prev) => [...prev, { name: data.sourceName || urlInput.trim(), size: 0, source: "url" as const }]);
        setUrlInput("");
        showToast("Conteúdo do site importado com sucesso.", "success");
      } else {
        showToast(data.error || "Erro ao importar o site.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Erro de comunicação ao importar o site.", "error");
    } finally {
      setImportingUrl(false);
    }
  };

  // Tratar Importação de transcrição de um vídeo do YouTube
  const handleImportYoutube = async () => {
    if (!youtubeInput.trim()) return;
    setImportingYoutube(true);
    try {
      const currentBriefingId = briefingId || Math.random().toString(36).substring(7);
      const res = await fetch("/api/admin/courses/generate/import-youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: youtubeInput.trim(), briefingId: currentBriefingId }),
      });
      const data = await res.json();
      if (res.ok) {
        setBriefingId(data.briefingId);
        setAttachments((prev) => [...prev, { name: data.sourceName || youtubeInput.trim(), size: 0, source: "youtube" as const }]);
        setYoutubeInput("");
        showToast("Transcrição do YouTube importada com sucesso.", "success");
      } else {
        showToast(data.error || "Erro ao importar a transcrição.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Erro de comunicação ao importar a transcrição.", "error");
    } finally {
      setImportingYoutube(false);
    }
  };

  // Tratar Submissão do Briefing (Etapa 1 -> Etapa 2)
  const handleBriefSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setGeneratingOutline(true);
    try {
      const res = await fetch("/api/admin/courses/generate/outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          level,
          duration,
          objectives,
          targetAudience,
          briefingId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setOutline(data.outline);
        setJobId(data.jobId);
        setTempTitle(data.outline.title);
        setTempDesc(data.outline.description);
        setStep("OUTLINE");
      } else {
        showToast("Erro ao gerar outline de curso.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Erro de comunicação com a IA.", "error");
    } finally {
      setGeneratingOutline(false);
    }
  };

  // Iniciar Geração de Aulas (Etapa 2 -> Etapa 3)
  const handleStartGeneration = async () => {
    if (!jobId || !outline) return;

    setStartingGeneration(true);
    setGenError(null);
    setProgress(0);

    try {
      const res = await fetch("/api/admin/courses/generate/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          outline,
        }),
      });

      if (res.ok) {
        setStep("GENERATION");
      } else {
        showToast("Erro ao iniciar a geração do conteúdo.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Erro ao conectar ao motor de geração.", "error");
    } finally {
      setStartingGeneration(false);
    }
  };

  // Atualizar curso para revisão após completado
  useEffect(() => {
    if (step === "REVIEW" && courseId) {
      const loadDraft = async () => {
        try {
          // Podemos fazer fetch do curso do MongoDB fazendo uma requisição rápida
          // Vamos fazer uma rota GET temporária ou carregar os detalhes
          // Já que o curso foi gerado e salvo, podemos buscar no catálogo
          const res = await fetch(`/api/catalog`);
          if (res.ok) {
            // Fazer requisição para buscar o rascunho completo de MongoDB
            const detailsRes = await fetch(`/api/admin/courses/review`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ courseId, action: "get_draft" }) // Action tratada no route.ts se expandirmos
            });
            // Vamos ler do backend expandido ou simular
          }
        } catch {}
      };
      loadDraft();
    }
  }, [step, courseId]);

  // Adicionar GET/detalhes no review
  // Para evitar criar outra API, faremos um fetch das lições simulado ou usando a nossa API de status que agora também retorna os dados do curso gerado se concluído!
  // Sim! Vamos carregar os dados salvos do curso diretamente
  useEffect(() => {
    if (step === "REVIEW" && courseId && jobId) {
      const fetchCourse = async () => {
        try {
          const res = await fetch(`/api/admin/courses/generate/status?jobId=${jobId}`);
          if (res.ok) {
            // Vamos obter o curso diretamente do banco de dados
            // Como a nossa API start salvou o curso em MongoDB, vamos estender status/route.ts ou review/route.ts para fornecer os dados completos para revisão humana!
            // Vamos fazer uma chamada especial para ler o curso de review!
          }
        } catch {}
      };
      fetchCourse();
    }
  }, [step, courseId]);

  // Vamos carregar o curso a partir do banco de dados estendendo `/api/admin/courses/review` para GET!
  // Sim, vamos usar a API existente para puxar o rascunho.
  const loadDraftCourse = async () => {
    try {
      const res = await fetch(`/api/admin/courses/review?courseId=${courseId}`);
      if (res.ok) {
        const data = await res.json();
        setFullCourse(data.course);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (step === "REVIEW" && courseId) {
      loadDraftCourse();
    }
  }, [step, courseId]);

  // Atualiza os blocks[] da lição selecionada no estado local (edição em tempo real no BlockEditor)
  const updateSelectedLessonBlocks = (blocks: LessonBlock[]) => {
    setFullCourse((prev: any) => {
      if (!prev) return prev;
      const updated = { ...prev, modules: [...prev.modules] };
      const mod = { ...updated.modules[selectedModuleIdx], lessons: [...updated.modules[selectedModuleIdx].lessons] };
      mod.lessons[selectedLessonIdx] = { ...mod.lessons[selectedLessonIdx], blocks, content: blocksToPlainText(blocks) };
      updated.modules[selectedModuleIdx] = mod;
      return updated;
    });
  };

  // Persiste as edições de conteúdo (blocks) do rascunho no MongoDB
  const handleSaveContentEdit = async () => {
    if (!fullCourse || !courseId) return;
    setSavingContent(true);
    try {
      const res = await fetch("/api/admin/courses/review", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, modules: fullCourse.modules }),
      });
      if (res.ok) {
        showToast("Alterações guardadas no rascunho.", "success");
      } else {
        showToast("Erro ao guardar alterações.", "error");
      }
    } catch (e) {
      showToast("Erro de comunicação ao guardar edições.", "error");
    } finally {
      setSavingContent(false);
    }
  };

  // Aprovar e publicar o curso
  const handleApprove = async () => {
    if (!courseId) return;
    setReviewingAction(true);

    try {
      const res = await fetch("/api/admin/courses/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, action: "approve" }),
      });

      if (res.ok) {
        showToast("Curso aprovado, publicado e indexado com sucesso no RAG do Tutor!", "success", 6000);
        setStep("BRIEF");
        setTopic("");
        setAttachments([]);
        setObjectives("");
        fetchHistory();
      } else {
        showToast("Erro ao aprovar o curso.", "error");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReviewingAction(false);
    }
  };

  // Rejeitar e apagar o curso
  const handleReject = async () => {
    if (!courseId) return;
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!courseId) return;
    setShowRejectModal(false);
    setReviewingAction(true);

    try {
      const res = await fetch("/api/admin/courses/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, action: "reject" }),
      });

      if (res.ok) {
        showToast("Curso eliminado com sucesso.", "success");
        setStep("BRIEF");
        setTopic("");
        setAttachments([]);
        setObjectives("");
      } else {
        showToast("Erro ao rejeitar o curso.", "error");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReviewingAction(false);
    }
  };

  // Adicionar Modificações locais no Outline
  const handleAddModule = () => {
    if (!outline) return;
    const newMod = {
      title: "Novo Módulo",
      order: (outline.modules || []).length + 1,
      lessons: [],
    };
    setOutline({
      ...outline,
      modules: [...(outline.modules || []), newMod],
    });
  };

  const handleAddLesson = (modIdx: number) => {
    if (!outline) return;
    const newLes = {
      title: "Nova Lição",
      objectives: ["Aprender os conceitos desta aula."],
    };
    const updatedModules = [...outline.modules];
    updatedModules[modIdx].lessons = [...(updatedModules[modIdx].lessons || []), newLes];
    setOutline({
      ...outline,
      modules: updatedModules,
    });
  };

  const handleRemoveLesson = (modIdx: number, lesIdx: number) => {
    if (!outline) return;
    const updatedModules = [...outline.modules];
    updatedModules[modIdx].lessons = updatedModules[modIdx].lessons.filter((_: any, idx: number) => idx !== lesIdx);
    setOutline({
      ...outline,
      modules: updatedModules,
    });
  };

  return (
    <>
    <div className="space-y-8 workspace-page-container">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-indigo-400" />
          Fábrica de Cursos (IA)
        </h1>
        <p className="text-sm text-slate-400">
          Crie cursos completos e integrados com IA: do briefing inicial à curadoria humana e publicação em RAG.
        </p>
      </div>

      {/* Wizard Steps indicator */}
      <div className="flex items-center gap-2 pb-2 overflow-x-auto border-b border-slate-900">
        <span
          className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
            step === "BRIEF" ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-500"
          }`}
        >
          1. Briefing & Anexos
        </span>
        <ChevronRight className="h-4 w-4 text-slate-700" />
        <span
          className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
            step === "OUTLINE" ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-500"
          }`}
        >
          2. Outline & Validação
        </span>
        <ChevronRight className="h-4 w-4 text-slate-700" />
        <span
          className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
            step === "GENERATION" ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-500"
          }`}
        >
          3. Geração Assíncrona
        </span>
        <ChevronRight className="h-4 w-4 text-slate-700" />
        <span
          className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
            step === "REVIEW" ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-500"
          }`}
        >
          4. Revisão & Curação
        </span>
      </div>

      {/* Main Wizard Screens */}
      {step === "BRIEF" && (
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Formulário do Briefing */}
          <div className="lg:col-span-2 space-y-6">
            <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-8 space-y-6">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-indigo-400" />
                Definir Briefing do Curso
              </h3>

              <form onSubmit={handleBriefSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-400">Tema do Curso</label>
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="Ex: Fundamentos de Criptomoedas"
                      className="w-full h-11 px-4 rounded-xl border border-slate-800 bg-slate-950 text-white text-sm focus:border-indigo-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-400">Nível do Curso</label>
                    <select
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-slate-800 bg-slate-950 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    >
                      <option>Básico</option>
                      <option>Intermédio</option>
                      <option>Avançado</option>
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-400">Duração Planeada</label>
                    <input
                      type="text"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="Ex: 4 semanas ou 20 horas"
                      className="w-full h-11 px-4 rounded-xl border border-slate-800 bg-slate-950 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-400">Público-alvo</label>
                    <input
                      type="text"
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      placeholder="Ex: Programadores juniores"
                      className="w-full h-11 px-4 rounded-xl border border-slate-800 bg-slate-950 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400">Objetivos Pedagógicos</label>
                  <textarea
                    value={objectives}
                    onChange={(e) => setObjectives(e.target.value)}
                    placeholder="Ex: Explicar descentralização, hash de blocos, funcionamento de wallets e altcoins principais..."
                    className="w-full h-24 p-4 rounded-xl border border-slate-800 bg-slate-950 text-white text-sm focus:border-indigo-500 focus:outline-none resize-none"
                  />
                </div>

                {/* File Attachment Area */}
                <div className="border border-slate-900 bg-slate-950/40 rounded-2xl p-6 space-y-4">
                  <span className="text-xs font-semibold text-slate-400 block">Anexar Materiais Auxiliares (PDFs, Slides, Artigos)</span>
                  <div className="border-2 border-dashed border-slate-800 rounded-xl p-6 text-center hover:border-indigo-500/50 transition-colors relative cursor-pointer">
                    <input
                      type="file"
                      multiple
                      accept=".txt,.md,.pdf,.pptx,.docx"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      disabled={uploading}
                    />
                    <UploadCloud className="h-8 w-8 text-slate-500 mx-auto mb-2" />
                    <span className="block text-xs font-bold text-slate-300">Arraste arquivos ou clique para fazer upload</span>
                    <span className="text-[10px] text-slate-500 block mt-1">Suporta .txt, .md, .pdf, .pptx e .docx — texto e imagens são extraídos automaticamente</span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="flex gap-1.5">
                      <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="URL de um artigo/site"
                        className="flex-1 h-9 px-3 rounded-lg border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleImportUrl}
                        disabled={importingUrl || !urlInput.trim()}
                        className="h-9 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                      >
                        {importingUrl ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
                        Importar Site
                      </button>
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="url"
                        value={youtubeInput}
                        onChange={(e) => setYoutubeInput(e.target.value)}
                        placeholder="URL de um vídeo do YouTube"
                        className="flex-1 h-9 px-3 rounded-lg border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleImportYoutube}
                        disabled={importingYoutube || !youtubeInput.trim()}
                        className="h-9 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                      >
                        {importingYoutube ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SquarePlay className="h-3.5 w-3.5" />}
                        Importar Transcrição
                      </button>
                    </div>
                  </div>

                  {attachments.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-900">
                      {attachments.map((file, idx) => {
                        const SourceIcon = file.source === "url" ? Globe : file.source === "youtube" ? SquarePlay : FileIcon;
                        return (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-900 text-xs">
                            <span className="font-medium text-slate-300 truncate max-w-[80%] flex items-center gap-1.5">
                              <SourceIcon className="h-3 w-3 text-slate-500 shrink-0" />
                              {file.name}
                            </span>
                            {file.size > 0 && <span className="text-[10px] text-slate-500 shrink-0">{(file.size / 1024).toFixed(1)} KB</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={generatingOutline || !topic.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-xs font-semibold text-white transition-all disabled:opacity-50"
                >
                  {generatingOutline ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      A Elaborar Esboço Pedagógico...
                    </>
                  ) : (
                    <>
                      Gerar Outline do Curso
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Histórico lateral */}
          <div className="lg:col-span-1 space-y-6">
            <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-4">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <BookOpen className="h-4.5 w-4.5 text-indigo-400" />
                Cursos Gerados por IA ({savedCourses.length})
              </h3>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {loadingHistory ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
                  </div>
                ) : savedCourses.length === 0 ? (
                  <span className="text-[11px] text-slate-600 italic block py-2">
                    Nenhum curso gerado no catálogo deste tenant.
                  </span>
                ) : (
                  savedCourses.map((c) => (
                    <div
                      key={c._id}
                      className="p-3 rounded-xl border border-slate-900 bg-slate-950/40 hover:border-slate-800 text-slate-400 flex items-center justify-between gap-2 no-3d-effect"
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="font-bold text-xs truncate text-slate-200">{c.title}</span>
                        <span className="text-[9px] text-slate-500 flex items-center gap-1 mt-1">
                          <Layers className="h-3 w-3" />
                          {c.lessonsCount} lições • {c.minutes}m
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => router.push(`/dashboard/courses/${c._id}/lessons/${c.firstLesson}`)}
                          disabled={!c.firstLesson}
                          title="Visualizar"
                          className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingCourseId(c._id)}
                          title="Editar"
                          className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setAnalyticsCourseId(c._id)}
                          title="Analytics"
                          className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                        >
                          <BarChart3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCourse(c)}
                          title="Apagar"
                          className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {step === "OUTLINE" && outline && (
        <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-900 pb-4">
            <div>
              {editingTitle ? (
                <input
                  type="text"
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  onBlur={() => {
                    setOutline({ ...outline, title: tempTitle });
                    setEditingTitle(false);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-lg text-white font-bold"
                  autoFocus
                />
              ) : (
                <h2
                  className="text-lg font-bold text-white flex items-center gap-2 cursor-pointer"
                  onClick={() => setEditingTitle(true)}
                >
                  {outline.title}
                  <Edit2 className="h-4 w-4 text-slate-500" />
                </h2>
              )}

              {editingDesc ? (
                <input
                  type="text"
                  value={tempDesc}
                  onChange={(e) => setTempDesc(e.target.value)}
                  onBlur={() => {
                    setOutline({ ...outline, description: tempDesc });
                    setEditingDesc(false);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 w-full mt-2"
                  autoFocus
                />
              ) : (
                <p
                  className="text-xs text-slate-400 mt-1 cursor-pointer flex items-center gap-2"
                  onClick={() => setEditingDesc(true)}
                >
                  {outline.description}
                  <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                </p>
              )}
            </div>
            <button
              onClick={() => setStep("BRIEF")}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
          </div>

          <div className="space-y-4">
            <span className="text-xs font-semibold text-slate-500 block uppercase tracking-wider">
              Módulos e Lições Propostos (Validação Humana)
            </span>

            {outline.modules?.map((mod: any, mIdx: number) => (
              <div key={mIdx} className="border border-slate-900 bg-slate-950/40 rounded-2xl overflow-hidden">
                <div
                  className="p-4 bg-slate-950 flex items-center justify-between cursor-pointer"
                  onClick={() => setActiveModuleIdx(activeModuleIdx === mIdx ? null : mIdx)}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-indigo-500/10 text-xs font-bold text-indigo-400">
                      M{mod.order}
                    </span>
                    <input
                      type="text"
                      value={mod.title}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const updated = [...outline.modules];
                        updated[mIdx].title = e.target.value;
                        setOutline({ ...outline, modules: updated });
                      }}
                      className="bg-transparent border-b border-transparent focus:border-slate-800 focus:bg-slate-950 px-1 py-0.5 text-xs font-bold text-white focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-500">{(mod.lessons || []).length} lições</span>
                    {activeModuleIdx === mIdx ? (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {activeModuleIdx === mIdx && (
                  <div className="p-4 border-t border-slate-900 space-y-3 bg-slate-950/20">
                    {mod.lessons?.map((les: any, lIdx: number) => (
                      <div key={lIdx} className="flex items-start gap-4 p-3 bg-slate-950/50 border border-slate-900 rounded-xl">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <input
                              type="text"
                              value={les.title}
                              onChange={(e) => {
                                const updated = [...outline.modules];
                                updated[mIdx].lessons[lIdx].title = e.target.value;
                                setOutline({ ...outline, modules: updated });
                              }}
                              className="bg-transparent border-b border-transparent focus:border-slate-800 focus:bg-slate-950 px-1 text-xs font-semibold text-slate-200 w-[80%] focus:outline-none"
                            />
                            <button
                              onClick={() => handleRemoveLesson(mIdx, lIdx)}
                              className="text-slate-600 hover:text-rose-400 p-1 hover:bg-slate-900 rounded"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="space-y-1 pl-1">
                            <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-bold">Objetivos</span>
                            <div className="text-[10px] text-slate-400 space-y-1">
                              {les.objectives?.map((obj: string, oIdx: number) => (
                                <input
                                  key={oIdx}
                                  type="text"
                                  value={obj}
                                  onChange={(e) => {
                                    const updated = [...outline.modules];
                                    updated[mIdx].lessons[lIdx].objectives[oIdx] = e.target.value;
                                    setOutline({ ...outline, modules: updated });
                                  }}
                                  className="bg-transparent border-b border-transparent focus:border-slate-800 focus:bg-slate-950 px-1 py-0.5 w-full text-slate-400 focus:outline-none"
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={() => handleAddLesson(mIdx)}
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 pt-2"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar Lição
                    </button>
                  </div>
                )}
              </div>
            ))}

            <button
              onClick={handleAddModule}
              className="w-full border border-dashed border-slate-800 rounded-xl p-3 text-center text-xs font-semibold text-slate-500 hover:border-slate-700 hover:text-slate-400 transition-colors"
            >
              Adicionar Módulo
            </button>
          </div>

          <button
            onClick={handleStartGeneration}
            disabled={startingGeneration}
            className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-all disabled:opacity-50"
          >
            {startingGeneration ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Agendando Geração...
              </>
            ) : (
              <>
                Aprovar Outline e Iniciar Geração de Aulas
                <Check className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      )}

      {step === "GENERATION" && (
        <div className="border border-slate-900 bg-slate-900/10 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-6 min-h-[400px]">
          {genError ? (
            <>
              <div className="p-4 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <X className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <span className="block text-sm font-bold text-white">Falha na Geração Assíncrona</span>
                <span className="text-xs text-rose-400">{genError}</span>
              </div>
              <button
                onClick={() => setStep("OUTLINE")}
                className="h-10 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white transition-colors"
              >
                Voltar e Tentar Novamente
              </button>
            </>
          ) : (
            <>
              <Loader2 className="h-10 w-10 text-indigo-400 animate-spin" />
              <div className="space-y-2 max-w-[360px]">
                <span className="block text-sm font-bold text-white">Gerando Curso Lição a Lição...</span>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                  <span>Lição {currentLessonIdx} de {totalLessons}</span>
                  <span>{progress}% concluído</span>
                </div>
                <span className="text-[10px] text-slate-500 block italic pt-2">
                  Os materiais anexados (Briefing RAG) estão a ser analisados para compor o conteúdo da aula atual.
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {step === "REVIEW" && fullCourse && (
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Navegador lateral do rascunho completo */}
          <div className="lg:col-span-1 border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Lições Geradas
              </span>
              <CourseMapButton courseTitle={fullCourse.title} modules={fullCourse.modules || []} />
            </div>

            <div className="space-y-4">
              {fullCourse.modules?.map((mod: any, mIdx: number) => (
                <div key={mIdx} className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase px-1">
                    {mod.title}
                  </span>
                  <div className="space-y-1 pl-1">
                    {mod.lessons?.map((les: any, lIdx: number) => (
                      <div
                        key={lIdx}
                        onClick={() => {
                          setSelectedModuleIdx(mIdx);
                          setSelectedLessonIdx(lIdx);
                        }}
                        className={`p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                          selectedModuleIdx === mIdx && selectedLessonIdx === lIdx
                            ? "border-indigo-500 bg-indigo-500/5 text-white"
                            : "border-slate-900 bg-slate-950/30 hover:border-slate-800 text-slate-400"
                        }`}
                      >
                        {les.title}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Editor e Preview de Conteúdo */}
          <div className="lg:col-span-3 space-y-6">
            {/* Header de Revisão */}
            <div className="p-6 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                  Revisão & Aprovação do Rascunho
                </span>
                <h2 className="text-lg font-bold text-white mt-1">{fullCourse.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReject}
                  disabled={reviewingAction}
                  className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-rose-950/20 text-slate-400 hover:text-rose-400 text-xs font-semibold border border-slate-800 transition-colors"
                >
                  Rejeitar Curso
                </button>
                <button
                  onClick={handleApprove}
                  disabled={reviewingAction}
                  className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors flex items-center gap-1.5"
                >
                  {reviewingAction ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Aprovar e Publicar
                </button>
              </div>
            </div>

            {/* Conteúdo da Lição Selecionada */}
            {fullCourse.modules?.[selectedModuleIdx]?.lessons?.[selectedLessonIdx] && (
              <div className="space-y-6">
                <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                    <h3 className="font-bold text-sm text-white">
                      Lição: {fullCourse.modules[selectedModuleIdx].lessons[selectedLessonIdx].title}
                    </h3>
                    <button
                      onClick={handleSaveContentEdit}
                      disabled={savingContent}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {savingContent && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Guardar Alterações
                    </button>
                  </div>

                  {courseId && (
                    <EditingPresenceIndicator
                      courseId={courseId}
                      lessonKey={
                        fullCourse.modules[selectedModuleIdx].lessons[selectedLessonIdx].slug ||
                        fullCourse.modules[selectedModuleIdx].lessons[selectedLessonIdx].id ||
                        `${selectedModuleIdx}-${selectedLessonIdx}`
                      }
                    />
                  )}

                  <div className="border border-slate-800 rounded-2xl overflow-hidden h-[420px] flex bg-slate-950/50">
                    <BlockEditor
                      blocks={getOrMigrateBlocks(fullCourse.modules[selectedModuleIdx].lessons[selectedLessonIdx])}
                      onChange={updateSelectedLessonBlocks}
                      availableLessons={(fullCourse.modules || [])
                        .flatMap((m: any) => m.lessons || [])
                        .map((l: any) => ({ slug: l.slug || l.id, title: l.title }))
                        .filter((l: any) => l.slug !== (fullCourse.modules[selectedModuleIdx].lessons[selectedLessonIdx].slug || fullCourse.modules[selectedModuleIdx].lessons[selectedLessonIdx].id))}
                    >
                      <MediaLibraryPanel />
                    </BlockEditor>
                  </div>
                </div>

                {/* Quizzes e Labs */}
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-4">
                    <span className="font-bold text-xs text-white block">Quizzes Gerados</span>
                    <div className="space-y-4">
                      {fullCourse.modules[selectedModuleIdx].lessons[selectedLessonIdx].exercises?.map((ex: any, idx: number) => (
                        <div key={idx} className="p-4 rounded-2xl bg-slate-950 border border-slate-900 space-y-2 text-xs">
                          <p className="font-semibold text-slate-200">{ex.question}</p>
                          <div className="space-y-1 text-slate-400">
                            {ex.options?.map((opt: string, oIdx: number) => (
                              <div key={oIdx} className="flex items-center gap-2">
                                <input type="radio" checked={oIdx === ex.correctIndex} readOnly className="h-3.5 w-3.5" />
                                <span>{opt}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-4">
                    <span className="font-bold text-xs text-white block">Desafio Programação (Lab)</span>
                    <pre className="text-xs text-slate-400 leading-relaxed bg-slate-950 p-4 rounded-2xl border border-slate-900 whitespace-pre-wrap font-mono">
                      {fullCourse.modules[selectedModuleIdx].lessons[selectedLessonIdx].lab || "Sem laboratório de código associado."}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>

      {/* ── Modal de Confirmação de Rejeição ── */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ animation: "fadeIn 200ms ease-out" }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowRejectModal(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-800/80 bg-[#0a0f1e]/95 backdrop-blur-xl shadow-2xl" style={{ animation: "scaleIn 250ms cubic-bezier(0.16,1,0.3,1)" }}>
            <div className="absolute -top-px left-1/2 -translate-x-1/2 w-2/3 h-px bg-gradient-to-r from-transparent via-rose-500/60 to-transparent" />
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="h-7 w-7 text-rose-400" />
              </div>
              <h3 className="text-base font-bold text-white mb-1.5">Rejeitar Rascunho</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">Deseja rejeitar e eliminar este rascunho permanentemente? Esta ação é irreversível.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowRejectModal(false)} className="flex-1 rounded-xl border border-slate-700/60 bg-slate-800/50 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700/50 hover:text-white cursor-pointer transition-all">Cancelar</button>
                <button onClick={confirmReject} className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 hover:shadow-lg hover:shadow-rose-500/25 cursor-pointer transition-all">Sim, eliminar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingCourseId && (
        <CourseEditModal
          courseId={editingCourseId}
          onClose={() => setEditingCourseId(null)}
          onSaved={() => {
            setEditingCourseId(null);
            fetchHistory();
          }}
        />
      )}

      {analyticsCourseId && (
        <CourseAnalyticsPanel courseId={analyticsCourseId} onClose={() => setAnalyticsCourseId(null)} />
      )}

      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.92) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </>
  );
}
