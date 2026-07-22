"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, ChevronDown, ChevronRight, Save, Video } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";

interface Lesson {
  id?: string;
  slug?: string;
  title: string;
  content: string;
  videoProvider?: string;
  videoId?: string;
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [openLessonKey, setOpenLessonKey] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/courses/review?courseId=${courseId}`);
        const data = await res.json();
        if (res.ok && data.course) {
          setTitle(data.course.title || "");
          setDescription(data.course.description || "");
          setModules(data.course.modules || []);
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/courses/review", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, title, description, modules }),
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
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col border border-slate-850 bg-slate-950 rounded-3xl p-6 shadow-2xl relative space-y-4 no-3d-effect">
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
                          onClick={() => setOpenLessonKey(isOpen ? null : key)}
                          className="w-full flex items-center justify-between gap-2 p-3 text-left cursor-pointer hover:bg-slate-900/30 transition-colors"
                        >
                          <span className="text-xs font-semibold text-slate-200 truncate">{lesson.title}</span>
                          {isOpen ? <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" />}
                        </button>

                        {isOpen && (
                          <div className="p-3 pt-0 space-y-3 border-t border-slate-900">
                            <div className="space-y-1.5 pt-3">
                              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">Título da Lição</label>
                              <input
                                value={lesson.title}
                                onChange={(e) => updateLesson(mIdx, lIdx, { title: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">Conteúdo (Markdown)</label>
                              <textarea
                                value={lesson.content}
                                onChange={(e) => updateLesson(mIdx, lIdx, { content: e.target.value })}
                                className="w-full h-32 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 resize-y"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                  <Video className="h-3 w-3" /> Fornecedor de Vídeo
                                </label>
                                <select
                                  value={lesson.videoProvider || "youtube"}
                                  onChange={(e) => updateLesson(mIdx, lIdx, { videoProvider: e.target.value })}
                                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                                >
                                  <option value="youtube">YouTube</option>
                                  <option value="mux">Mux</option>
                                </select>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">ID do Vídeo</label>
                                <input
                                  value={lesson.videoId || ""}
                                  onChange={(e) => updateLesson(mIdx, lIdx, { videoId: e.target.value })}
                                  placeholder="ex: dQw4w9WgXcQ"
                                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
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
