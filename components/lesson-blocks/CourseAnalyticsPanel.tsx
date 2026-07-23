"use client";

import React, { useEffect, useState } from "react";
import { X, Loader2, BarChart3, Clock, Users, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DetailModal } from "@/components/ui/detail-modal";

interface LessonAnalytics {
  lessonId: string;
  slug: string;
  title: string;
  completedCount: number;
  completionRate: number;
  avgTimeSeconds: number | null;
  studentIds: string[];
}

interface AnalyticsData {
  courseTitle: string;
  totalStudents: number;
  lessons: LessonAnalytics[];
  erroredQuestions: { questionText: string; correctOption: string; count: number }[];
  studentNames: { userId: string; name: string; email: string }[];
}

function formatTime(seconds: number | null): string {
  if (seconds === null) return "—";
  const m = Math.round(seconds / 60);
  return m < 1 ? "<1m" : `${m}m`;
}

export function CourseAnalyticsPanel({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ title: string; items: any[]; columns?: any[] } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/courses/${courseId}/analytics`);
        const json = await res.json();
        if (res.ok) {
          setData(json);
        } else {
          setError(json.error || "Erro ao carregar analytics.");
        }
      } catch {
        setError("Erro de comunicação ao carregar analytics.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseId]);

  const nameOf = (userId: string) => {
    const u = data?.studentNames.find((s) => s.userId === userId);
    return u ? { name: u.name, email: u.email } : { name: userId, email: "" };
  };

  const chartData = (data?.lessons || []).map((l) => ({
    name: l.title.length > 18 ? `${l.title.slice(0, 18)}…` : l.title,
    fullTitle: l.title,
    "Taxa de Conclusão (%)": l.completionRate,
  }));

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col border border-slate-850 bg-slate-950 rounded-3xl p-6 shadow-2xl relative space-y-4 no-3d-effect">
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-550 hover:text-white transition-colors cursor-pointer">
          <X className="h-5 w-5" />
        </button>

        <div className="pb-3 border-b border-slate-900 pr-8">
          <h3 className="font-extrabold text-white text-base flex items-center gap-2">
            <BarChart3 className="h-4.5 w-4.5 text-indigo-400" />
            Analytics {data ? `— ${data.courseTitle}` : ""}
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Dados reais de utilização — sem números fabricados</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
            <span className="text-xs font-semibold">A calcular estatísticas...</span>
          </div>
        ) : error ? (
          <p className="text-xs text-rose-400 py-8 text-center">{error}</p>
        ) : data ? (
          <div className="overflow-y-auto flex-1 -mr-2 pr-2 space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-slate-900 bg-slate-900/10 rounded-2xl p-4 flex items-center gap-3">
                <Users className="h-5 w-5 text-indigo-400" />
                <div>
                  <span className="block text-xl font-extrabold text-white leading-none">{data.totalStudents}</span>
                  <span className="text-[10px] text-slate-500">Alunos com progresso</span>
                </div>
              </div>
              <div className="border border-slate-900 bg-slate-900/10 rounded-2xl p-4 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-400" />
                <div>
                  <span className="block text-xl font-extrabold text-white leading-none">{data.erroredQuestions.length}</span>
                  <span className="text-[10px] text-slate-500">Perguntas com erros registados</span>
                </div>
              </div>
            </div>

            {data.totalStudents === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-6">
                Ainda sem atividade de alunos registada neste curso. As estatísticas aparecem aqui assim que houver progresso real.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Taxa de Conclusão por Lição</span>
                  <div className="h-64 border border-slate-900 rounded-2xl bg-slate-900/10 p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                        <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 11 }}
                          labelStyle={{ color: "#fff" }}
                        />
                        <Bar dataKey="Taxa de Conclusão (%)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Detalhe por Lição</span>
                  <div className="space-y-1.5">
                    {data.lessons.map((l) => (
                      <button
                        key={l.lessonId}
                        onClick={() =>
                          setDetail({
                            title: l.title,
                            items: l.studentIds.map((id) => nameOf(id)),
                            columns: [
                              { key: "name", label: "Aluno" },
                              { key: "email", label: "Email" },
                            ],
                          })
                        }
                        disabled={l.completedCount === 0}
                        className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-900 bg-slate-900/10 hover:border-indigo-500/30 text-left cursor-pointer disabled:cursor-default disabled:hover:border-slate-900 transition-colors"
                      >
                        <span className="text-xs font-semibold text-slate-200 truncate flex-1">{l.title}</span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 shrink-0">
                          <Clock className="h-3 w-3" /> {formatTime(l.avgTimeSeconds)}
                        </span>
                        <span className="text-[10px] font-bold text-indigo-400 shrink-0">{l.completionRate}% ({l.completedCount})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {data.erroredQuestions.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Perguntas Mais Erradas</span>
                    <div className="space-y-1.5">
                      {data.erroredQuestions.map((q, i) => (
                        <div key={i} className="p-3 rounded-xl border border-slate-900 bg-slate-900/10 text-xs space-y-1">
                          <p className="font-semibold text-slate-200">{q.questionText}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-emerald-400">Correta: {q.correctOption || "—"}</span>
                            <span className="text-[10px] text-rose-400 font-bold">{q.count}x errada</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : null}

        <button
          onClick={onClose}
          className="w-full h-10 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 font-semibold text-xs transition-colors cursor-pointer shrink-0"
        >
          Fechar
        </button>
      </div>

      {detail && (
        <DetailModal
          title={detail.title}
          subtitle="Alunos que concluíram esta lição"
          items={detail.items}
          columns={detail.columns}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
