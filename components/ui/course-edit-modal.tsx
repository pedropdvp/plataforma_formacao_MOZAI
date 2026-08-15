"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, ChevronDown, ChevronRight, Save, Video, ExternalLink, History, RotateCcw, FileText, Upload, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { BlockEditor } from "@/components/lesson-blocks/BlockEditor";
import { MediaLibraryPanel } from "@/components/lesson-blocks/MediaLibraryPanel";
import { EditingPresenceIndicator } from "@/components/lesson-blocks/EditingPresenceIndicator";
import { LessonBlock, blocksToPlainText, getOrMigrateBlocks } from "@/lib/lesson-blocks";
import { parseVideoEmbed } from "@/lib/video-embed";

interface CourseVersion {
  versionNumber: number;
  title: string;
  editedByName: string;
  createdAt: string;
}

interface Lesson {
  id?: string;
  slug?: string;
  title: string;
  content: string;
  blocks?: LessonBlock[];
  videoProvider?: string;
  videoId?: string;
  videoUrl?: string;
  materialUrl?: string;
  materialName?: string;
  [key: string]: any;
}

interface ModuleData {
  id?: string;
  title: string;
  order?: number;
  lessons: Lesson[];
  [key: string]: any;
}

interface CourseEditModalProps {
  courseId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function CourseEditModal({ courseId, onClose, onSaved }: CourseEditModalProps) {
  const { showToast } = useToast();
  const confirmDialog = useConfirm();
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<CourseVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [openLessonKey, setOpenLessonKey] = useState<string | null>(null);
  const [isPublicMarketplace, setIsPublicMarketplace] = useState(false);
  const [marketplaceDescription, setMarketplaceDescription] = useState("");
  const [uploadingMaterialKey, setUploadingMaterialKey] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/courses/review?courseId=${courseId}`);
        const data = await res.json();
        if (res.ok && data.course) {
          setTitle(data.course.title || "");
          setDescription(data.course.description || "");
          setModules(data.course.modules || []);
          setIsPublicMarketplace(!!data.course.isPublicMarketplace);
          setMarketplaceDescription(data.course.marketplaceDescription || "");
        } else {
          showToast(data.error || "Erro ao carregar curso.", "error");
        }
      } catch (err) {
        showToast("Erro de comunicação ao carregar o curso.", "error");
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const availableLessons = modules.flatMap((mod) =>
    mod.lessons.map((l) => ({ slug: l.slug || l.id || l.title, title: l.title }))
  );

  const loadVersions = async () => {
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/versions`);
      const data = await res.json();
      if (res.ok) setVersions(data.versions || []);
    } catch {
      // silencioso — histórico é informativo, não bloqueia a edição
    }
  };

  const handleToggleVersions = () => {
    const next = !showVersions;
    setShowVersions(next);
    if (next && versions.length === 0) loadVersions();
  };

  const handleRestoreVersion = async (versionNumber: number) => {
    const confirmed = await confirmDialog({
      title: "Restaurar Versão",
      message: `Tem a certeza que deseja restaurar a versão #${versionNumber}? O estado atual será guardado como uma nova versão antes de restaurar, mas as alterações não guardadas neste editor serão perdidas.`,
      confirmLabel: "Restaurar",
      destructive: true,
    });
    if (!confirmed) return;

    setRestoringVersion(versionNumber);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionNumber }),
      });
      const data = await res.json();
      if (res.ok) {
        setModules(data.course.modules || []);
        showToast(`Versão #${versionNumber} restaurada.`, "success");
        loadVersions();
      } else {
        showToast(data.error || "Erro ao restaurar versão.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao restaurar versão.", "error");
    } finally {
      setRestoringVersion(null);
    }
  };

  const updateLesson = (mIdx: number, lIdx: number, patch: Partial<Lesson>) => {
    setModules((prev) => {
      const next = [...prev];
      const mod = { ...next[mIdx] };
      const lessons = [...mod.lessons];
      lessons[lIdx] = { ...lessons[lIdx], ...patch };
      mod.lessons = lessons;
      next[mIdx] = mod;
      return next;
    });
  };

  // Anexa o Material Original (PDF) de uma lição: carrega diretamente para o Vercel Blob
  // (mesmo padrão privado já usado pelos materiais da Fábrica de Cursos) e guarda só a
  // referência (URL + nome) na lição — o ficheiro em si nunca passa pelo corpo do pedido.
  const handleAttachMaterial = async (mIdx: number, lIdx: number, file: File) => {
    const key = `${mIdx}-${lIdx}`;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      showToast("Só é possível anexar ficheiros PDF como Material Original.", "error");
      return;
    }
    setUploadingMaterialKey(key);
    try {
      const { upload } = await import("@vercel/blob/client");
      const blob = await upload(file.name, file, {
        access: "private",
        handleUploadUrl: "/api/admin/courses/generate/upload-token",
      });
      updateLesson(mIdx, lIdx, { materialUrl: blob.url, materialName: file.name });
      showToast("Material original anexado — lembre-se de Guardar.", "success");
    } catch (err: any) {
      showToast(err?.message || "Erro ao anexar o material original.", "error");
    } finally {
      setUploadingMaterialKey(null);
    }
  };

  const handleRemoveMaterial = (mIdx: number, lIdx: number) => {
    updateLesson(mIdx, lIdx, { materialUrl: undefined, materialName: undefined });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/courses/review", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, title, description, modules, isPublicMarketplace, marketplaceDescription }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Curso atualizado com sucesso!", "success");
        onSaved();
      } else {
        showToast(data.error || "Erro ao guardar alterações.", "error");
      }
    } catch (err) {
      showToast("Erro de comunicação ao guardar o curso.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl max-h-[88vh] flex flex-col border border-slate-850 bg-slate-950 rounded-3xl p-6 shadow-2xl relative space-y-4 no-3d-effect">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-550 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="pb-3 border-b border-slate-900 pr-8">
          <h3 className="font-extrabold text-white text-base">Editar Curso</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Título, descrição e conteúdo/vídeo de cada lição</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
            <span className="text-xs font-semibold">A carregar curso...</span>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 -mr-2 pr-2 space-y-5">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Título do Curso</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Descrição</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full h-16 px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
              <div className="border border-slate-900 bg-slate-900/10 rounded-xl p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublicMarketplace}
                    onChange={(e) => setIsPublicMarketplace(e.target.checked)}
                    className="accent-indigo-500"
                  />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Publicar no Marketplace (visível a outras organizações)</span>
                </label>
                {isPublicMarketplace && (
                  <textarea
                    value={marketplaceDescription}
                    onChange={(e) => setMarketplaceDescription(e.target.value)}
                    placeholder="Descrição pública para o marketplace (opcional — usa a descrição do curso se vazio)"
                    className="w-full h-14 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                  />
                )}
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Lições</span>
              {modules.map((mod, mIdx) => (
                <div key={mod.id || mIdx} className="space-y-2">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide">{mod.title}</span>
                  {mod.lessons.map((lesson, lIdx) => {
                    const key = `${mIdx}-${lIdx}`;
                    const isOpen = openLessonKey === key;
                    return (
                      <div key={lesson.id || lIdx} className="border border-slate-900 bg-slate-900/10 rounded-xl overflow-hidden no-3d-effect">
                        <button
                          onClick={() => {
                            const nextKey = isOpen ? null : key;
                            setOpenLessonKey(nextKey);
                            // Migra conteúdo legado (só 'content' em Markdown) para blocks[] na primeira abertura.
                            if (nextKey && (!lesson.blocks || lesson.blocks.length === 0)) {
                              updateLesson(mIdx, lIdx, { blocks: getOrMigrateBlocks(lesson) });
                            }
                          }}
                          className="w-full flex items-center justify-between gap-2 p-3 text-left cursor-pointer hover:bg-slate-900/30 transition-colors"
                        >
                          <span className="text-xs font-semibold text-slate-200 truncate">{lesson.title}</span>
                          {isOpen ? <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" />}
                        </button>

                        {isOpen && (
                          <div className="p-3 pt-0 space-y-3 border-t border-slate-900">
                            <EditingPresenceIndicator courseId={courseId} lessonKey={lesson.slug || lesson.id || key} />
                            <div className="space-y-1.5 pt-3">
                              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">Título da Lição</label>
                              <input
                                value={lesson.title}
                                onChange={(e) => updateLesson(mIdx, lIdx, { title: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                <Video className="h-3 w-3" /> URL do Vídeo Principal (YouTube, Vimeo ou ficheiro .mp4)
                              </label>
                              <input
                                value={lesson.videoUrl ?? (lesson.videoProvider === "mux" ? `https://player.mux.com/${lesson.videoId || ""}` : lesson.videoId || "")}
                                onChange={(e) => updateLesson(mIdx, lIdx, { videoUrl: e.target.value })}
                                placeholder="https://www.youtube.com/watch?v=..."
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                              />
                              {lesson.videoUrl && !parseVideoEmbed(lesson.videoUrl) && (
                                <p className="text-[10px] text-amber-400">
                                  Não reconheci este URL como YouTube, Vimeo ou ficheiro de vídeo (.mp4/.webm/.ogg). Confirme o link.
                                </p>
                              )}
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                <FileText className="h-3 w-3" /> Material Original (PDF)
                              </label>
                              {lesson.materialUrl ? (
                                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                                  <span className="text-slate-300 truncate flex items-center gap-1.5">
                                    <FileText className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                                    {lesson.materialName || "material.pdf"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMaterial(mIdx, lIdx)}
                                    className="text-rose-400 hover:text-rose-300 cursor-pointer shrink-0"
                                    title="Remover material"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <label className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-950 border border-dashed border-slate-800 rounded-lg text-xs text-slate-500 hover:border-indigo-500 hover:text-indigo-400 cursor-pointer transition-colors">
                                  {uploadingMaterialKey === key ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Upload className="h-3.5 w-3.5" />
                                  )}
                                  {uploadingMaterialKey === key ? "A carregar..." : "Anexar PDF original desta lição"}
                                  <input
                                    type="file"
                                    accept="application/pdf"
                                    className="hidden"
                                    disabled={uploadingMaterialKey !== null}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleAttachMaterial(mIdx, lIdx, file);
                                      e.target.value = "";
                                    }}
                                  />
                                </label>
                              )}
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">Conteúdo da Lição</label>
                              <div className="border border-slate-800 rounded-xl overflow-hidden h-[420px] flex bg-slate-950/50">
                                <BlockEditor
                                  blocks={getOrMigrateBlocks(lesson)}
                                  onChange={(blocks) => updateLesson(mIdx, lIdx, { blocks, content: blocksToPlainText(blocks) })}
                                  availableLessons={availableLessons.filter((l) => l.slug !== (lesson.slug || lesson.id))}
                                >
                                  <MediaLibraryPanel />
                                </BlockEditor>
                              </div>
                            </div>
                            <a
                              href={`/dashboard/courses/${courseId}/lessons/${lesson.slug || lesson.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 underline decoration-dotted"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Ver esta lição (nova aba, depois de guardar)
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-900">
              <button
                onClick={handleToggleVersions}
                className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  Histórico de Versões
                </span>
                {showVersions ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
              </button>
              {showVersions && (
                <div className="space-y-1.5">
                  {versions.length === 0 ? (
                    <p className="text-[11px] text-slate-600 italic">Ainda não há versões anteriores guardadas — aparecem aqui a partir da próxima vez que guardar alterações.</p>
                  ) : (
                    versions.map((v) => (
                      <div key={v.versionNumber} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-900 bg-slate-900/10 text-xs">
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-200">Versão #{v.versionNumber}</span>
                          <span className="text-[10px] text-slate-500 block">
                            {v.editedByName} — {new Date(v.createdAt).toLocaleString("pt-PT")}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRestoreVersion(v.versionNumber)}
                          disabled={restoringVersion !== null}
                          className="h-7 px-2.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 hover:text-white text-[10px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          {restoringVersion === v.versionNumber ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                          Restaurar
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2.5 pt-2 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
