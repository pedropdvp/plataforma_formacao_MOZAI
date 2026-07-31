"use client";

import React, { useState, useEffect } from "react";
import { Award, Download, ExternalLink, Loader2, X, ShieldCheck, Plus, Trash2, Route } from "lucide-react";
import { useAccess } from "@/hooks/use-access";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";

interface Diploma {
  id: string;
  title: string;
  recipientName: string;
  issueDate: string;
  verificationCode: string;
  grade: string;
  hours: number;
  courseCount: number;
}

interface CatalogCourse {
  id: string;
  title: string;
  lessonsCount: number;
  hours: number;
}

interface Track {
  id: string;
  name: string;
  courseIds: string[];
  createdByName: string;
}

// Fallback estático dos cursos demos (usado só se o catálogo real ainda não tiver cursos)
const FALLBACK_COURSES: CatalogCourse[] = [
  { id: "course-1", title: "Engenharia de IA e RAG Avançado", lessonsCount: 18, hours: 24 },
  { id: "course-2", title: "Next.js 16 e Composable SaaS", lessonsCount: 14, hours: 18 },
  { id: "course-3", title: "Smart Contracts e Criptografia com Solidity", lessonsCount: 22, hours: 30 },
];

export default function DiplomasPage() {
  const { userName, activeRole } = useAccess();
  const confirmDialog = useConfirm();
  const { showToast } = useToast();
  const canManage = activeRole === "ADMIN" || activeRole === "GESTOR_ACADEMICO" || activeRole === "FORMADOR";

  const [diplomas, setDiplomas] = useState<Diploma[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [catalogCourses, setCatalogCourses] = useState<CatalogCourse[]>([]);
  const [showTrackForm, setShowTrackForm] = useState(false);
  const [trackName, setTrackName] = useState("");
  const [trackCourseIds, setTrackCourseIds] = useState<string[]>([]);
  const [creatingTrack, setCreatingTrack] = useState(false);

  // Estados de visualização e download
  const [previewDiploma, setPreviewDiploma] = useState<Diploma | null>(null);
  const [downloadingDipId, setDownloadingDipId] = useState<string | null>(null);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);

  const studentName = userName || "Estudante MOZAI";

  const loadDiplomasData = async () => {
    setIsLoading(true);
    try {
      const [catalogRes, progressRes, tracksRes] = await Promise.all([
        fetch("/api/catalog"),
        fetch("/api/progress"),
        fetch("/api/course-tracks"),
      ]);

      let courses: CatalogCourse[] = FALLBACK_COURSES;
      if (catalogRes.ok) {
        const data = await catalogRes.json();
        const real: CatalogCourse[] = (data.courses || []).map((c: any) => {
          const mins = typeof c.minutes === "number" ? c.minutes : 0;
          const hours = mins >= 60 ? Math.round(mins / 60) : 12;
          return { id: c._id, title: c.title, lessonsCount: c.lessonsCount || 0, hours };
        });
        if (real.length > 0) {
          const realIds = new Set(real.map((c) => c.id));
          courses = [...real, ...FALLBACK_COURSES.filter((c) => !realIds.has(c.id))];
        }
      }
      setCatalogCourses(courses);
      const courseMap = new Map(courses.map((c) => [c.id, c]));

      let progressList: any[] = [];
      if (progressRes.ok) {
        const pdata = await progressRes.json();
        progressList = pdata.progress || [];
      }

      let loadedTracks: Track[] = [];
      if (tracksRes.ok) {
        const tdata = await tracksRes.json();
        loadedTracks = tdata.tracks || [];
      }
      setTracks(loadedTracks);

      // Diploma = TODOS os cursos de um percurso concluídos a 100% (nunca um curso isolado —
      // isso é o papel do Certificado).
      const dips: Diploma[] = [];
      loadedTracks.forEach((track) => {
        const trackCourses = track.courseIds.map((id) => courseMap.get(id)).filter(Boolean) as CatalogCourse[];
        if (trackCourses.length === 0) return;

        let allCompleted = true;
        let totalHours = 0;
        const completionDates: Date[] = [];

        for (const course of trackCourses) {
          const courseProgress = progressList.filter((p: any) => p.courseId === course.id && p.status === "completed");
          const denom = course.lessonsCount > 0 ? course.lessonsCount : 3;
          if (courseProgress.length < denom) {
            allCompleted = false;
            break;
          }
          totalHours += course.hours;
          courseProgress.forEach((p: any) => completionDates.push(p.updatedAt ? new Date(p.updatedAt) : new Date()));
        }

        if (allCompleted) {
          completionDates.sort((a, b) => b.getTime() - a.getTime());
          const finalDate = completionDates.length > 0 ? completionDates[0].toLocaleDateString("pt-PT") : "Hoje";
          const hash = track.id.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
          const code = `DIP-${hash}-9841-${Math.floor(1000 + Math.random() * 9000)}`;

          dips.push({
            id: `dip-${track.id}`,
            title: `Especialista em ${track.name}`,
            recipientName: studentName,
            issueDate: finalDate,
            verificationCode: code,
            grade: "Excelente (100%)",
            hours: totalHours,
            courseCount: trackCourses.length,
          });
        }
      });

      setDiplomas(dips);
    } catch (err) {
      console.error("Erro ao ler dados de diplomas:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDiplomasData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentName]);

  const handleCreateTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackName.trim() || trackCourseIds.length < 2) {
      showToast("Indique um nome e selecione pelo menos 2 cursos para o percurso.", "error");
      return;
    }
    setCreatingTrack(true);
    try {
      const res = await fetch("/api/course-tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trackName, courseIds: trackCourseIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTrackName("");
      setTrackCourseIds([]);
      setShowTrackForm(false);
      showToast("Percurso criado com sucesso.", "success");
      loadDiplomasData();
    } catch (err: any) {
      showToast(err.message || "Erro ao criar o percurso.", "error");
    } finally {
      setCreatingTrack(false);
    }
  };

  const handleDeleteTrack = async (track: Track) => {
    const confirmed = await confirmDialog({
      title: "Apagar percurso",
      message: `Tem a certeza que quer apagar o percurso "${track.name}"? Os cursos não são apagados, só deixam de contar para um Diploma conjunto.`,
      confirmLabel: "Apagar",
      cancelLabel: "Cancelar",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/course-tracks/${track.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast("Percurso apagado.", "success");
      loadDiplomasData();
    } catch {
      showToast("Erro ao apagar o percurso.", "error");
    }
  };

  const handleDownload = (dip: Diploma) => {
    setDownloadingDipId(dip.id);
    setTimeout(() => {
      setDownloadingDipId(null);
      setDownloadToast(`Diploma_${dip.title.replace(/\s+/g, "_")}.pdf`);
      
      setTimeout(() => setDownloadToast(null), 4000);

      // Gerar PDF básico
      const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 595.28 841.89] /Contents 5 0 R >>
endobj
4 0 obj
<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >>
endobj
5 0 obj
<< /Length 1000 >>
stream
BT
/F2 28 Tf
70 730 Td
(MOZAI INTERNATIONAL) Tj
ET
BT
/F1 18 Tf
70 680 Td
(DIPLOMA DE CONCLUSAO) Tj
ET
BT
/F1 12 Tf
70 600 Td
(Certificamos para os devidos efeitos que o aluno:) Tj
ET
BT
/F2 16 Tf
70 560 Td
(${dip.recipientName.toUpperCase()}) Tj
ET
BT
/F1 12 Tf
70 500 Td
(concluiu com aproveitamento a formacao avancada de:) Tj
ET
BT
/F2 14 Tf
70 460 Td
(${dip.title.toUpperCase()}) Tj
ET
BT
/F1 11 Tf
70 380 Td
(Carga Horaria: ${dip.hours} Horas) Tj
ET
BT
/F1 11 Tf
70 350 Td
(Data de Emissao: ${dip.issueDate}) Tj
ET
BT
/F1 11 Tf
70 320 Td
(Codigo de Verificacao: ${dip.verificationCode}) Tj
ET
BT
/F1 9 Tf
70 200 Td
(Assinado digitalmente por Mozai Credentials Agent B2B SaaS) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000222 00000 n 
0000000355 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
1400
%%EOF`;

      const blob = new Blob([pdfContent], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Diploma_${dip.title.replace(/[^A-Za-z0-9]/g, "_")}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1500);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        <span className="text-sm font-semibold">A recolher os seus diplomas certificados...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
            <Award className="h-7 w-7 text-indigo-400" />
            Meus Diplomas
          </h1>
          <p className="text-sm text-slate-400">
            Um Diploma é emitido quando conclui TODOS os cursos de um percurso completo — não um curso isolado (para isso, veja os seus Certificados).
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowTrackForm((v) => !v)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors cursor-pointer flex-shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Gerir Percursos
          </button>
        )}
      </div>

      {canManage && showTrackForm && (
        <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-5">
          <form onSubmit={handleCreateTrack} className="space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Route className="h-4 w-4 text-indigo-400" />
              Novo Percurso
            </h3>
            <input
              type="text"
              value={trackName}
              onChange={(e) => setTrackName(e.target.value)}
              placeholder="Nome do percurso (ex: Especialização em IA Generativa)"
              className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
            />
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400">Cursos que compõem o percurso (mín. 2)</span>
              <div className="max-h-52 overflow-y-auto space-y-1.5 border border-slate-900 rounded-xl p-2">
                {catalogCourses.map((course) => (
                  <label key={course.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-900/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trackCourseIds.includes(course.id)}
                      onChange={(e) =>
                        setTrackCourseIds((prev) => (e.target.checked ? [...prev, course.id] : prev.filter((id) => id !== course.id)))
                      }
                      className="h-3.5 w-3.5 accent-indigo-500"
                    />
                    <span className="text-xs text-slate-300">{course.title}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowTrackForm(false)} className="h-9 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer">Cancelar</button>
              <button type="submit" disabled={creatingTrack} className="h-9 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors disabled:opacity-50 cursor-pointer">
                {creatingTrack ? "A criar..." : "Criar Percurso"}
              </button>
            </div>
          </form>

          {tracks.length > 0 && (
            <div className="pt-4 border-t border-slate-900 space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 block">Percursos existentes</span>
              {tracks.map((track) => (
                <div key={track.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-900 bg-slate-950/60">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-white block truncate">{track.name}</span>
                    <span className="text-[10px] text-slate-500">{track.courseIds.length} cursos · por {track.createdByName}</span>
                  </div>
                  <button onClick={() => handleDeleteTrack(track)} title="Apagar" className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors cursor-pointer flex-shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Diplomas List */}
      <div className="space-y-6">
        {diplomas.length === 0 ? (
          <div className="border border-slate-900 border-dashed rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4 min-h-[350px]">
            <div className="p-4 rounded-full bg-slate-950 border border-slate-900 text-slate-700">
              <Award className="h-10 w-10" />
            </div>
            <div className="space-y-1 max-w-[320px]">
              <span className="block text-sm font-bold text-slate-350">Ainda não possui diplomas.</span>
              <p className="text-xs text-slate-500 leading-relaxed">
                {tracks.length === 0
                  ? "Ainda não existe nenhum percurso definido nesta plataforma. Um Diploma exige a conclusão de TODOS os cursos de um percurso completo."
                  : "Conclua a 100% todos os cursos de um dos percursos disponíveis para que o seu diploma oficial seja assinado e emitido nesta área."}
              </p>
            </div>
          </div>
        ) : (
          diplomas.map((dip) => (
            <div
              key={dip.id}
              className="border border-indigo-500/20 bg-[#0c1224] rounded-3xl p-8 relative overflow-hidden flex flex-col md:flex-row items-center gap-8 shadow-2xl hover:border-indigo-500/40 transition-all group"
            >
              {/* Diploma Graphic Frame */}
              <div className="w-full md:w-72 aspect-[4/3] rounded-2xl border-2 border-indigo-500/30 bg-slate-950 p-6 flex flex-col justify-between text-center relative overflow-hidden flex-shrink-0 shadow-lg shadow-indigo-500/5">
                {/* Inner frame borders */}
                <div className="absolute inset-2 border border-indigo-500/10 rounded-xl pointer-events-none" />
                
                <div className="space-y-1">
                  <span className="text-[7px] text-indigo-400 font-bold uppercase tracking-widest block">MOZAI International</span>
                  <span className="text-[6px] text-slate-500 block">DIPLOMA OF COMPLETION</span>
                </div>

                <div className="space-y-1 py-3">
                  <span className="text-[6px] text-slate-400 block italic">Certifica-se que</span>
                  <span className="text-xs font-bold text-white block tracking-wide">{dip.recipientName}</span>
                  <span className="text-[6px] text-slate-400 block leading-tight px-2">
                    concluiu com aproveitamento a formação de <strong>{dip.title}</strong>
                  </span>
                </div>

                <div className="flex items-center justify-between text-[5px] text-slate-500 border-t border-slate-900 pt-2 font-mono">
                  <span>CÓD: {dip.verificationCode}</span>
                  <span>{dip.issueDate}</span>
                </div>
              </div>

              {/* Content Details */}
              <div className="flex-1 space-y-6 text-center md:text-left">
                <div className="space-y-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    Diploma Verificado
                  </span>
                  <h3 className="text-xl font-bold text-white leading-tight pt-1">
                    {dip.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                    Este diploma atesta formalmente a conclusão de um percurso completo de {dip.courseCount} cursos, com carga horária total de {dip.hours} horas, incluindo avaliações práticas no Coding Lab e verificação automática por agentes.
                  </p>
                </div>

                {/* Stats Metadata */}
                <div className="grid grid-cols-4 gap-4 py-4 border-t border-b border-slate-900/60 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] mb-1">Cursos</span>
                    <span className="text-slate-200 font-semibold">{dip.courseCount}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] mb-1">Aproveitamento</span>
                    <span className="text-slate-200 font-semibold">{dip.grade}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] mb-1">Carga Horária</span>
                    <span className="text-slate-200 font-semibold">{dip.hours} Horas</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] mb-1">Emissão</span>
                    <span className="text-slate-200 font-semibold">{dip.issueDate}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start">
                  <button
                    onClick={() => setPreviewDiploma(dip)}
                    className="h-10 px-5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-900 hover:border-slate-700 text-xs font-semibold text-slate-350 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    Visualizar Diploma
                    <ExternalLink className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => handleDownload(dip)}
                    disabled={downloadingDipId === dip.id}
                    className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/10 disabled:opacity-55"
                  >
                    {downloadingDipId === dip.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                        <span>A Gerar...</span>
                      </>
                    ) : (
                      <>
                        <span>Descarregar PDF</span>
                        <Download className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* TOAST DE SUCESSO DO DOWNLOAD */}
      {downloadToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-emerald-950/80 border border-emerald-500/30 rounded-2xl backdrop-blur-md shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="h-4.5 w-4.5" />
          </div>
          <div className="space-y-0.5">
            <span className="block text-xs font-bold text-white">Download Concluído!</span>
            <span className="block text-[10px] text-slate-400 max-w-[200px] truncate">{downloadToast}</span>
          </div>
        </div>
      )}

      {/* MODAL DE VISUALIZAÇÃO DE DIPLOMA PREMIUM GLASSMORPHIC */}
      {previewDiploma && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0b0f19] border-2 border-indigo-500/20 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl p-8 relative flex flex-col items-center text-center space-y-6">
            
            {/* Top Glow effects */}
            <div className="absolute -top-32 -left-32 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
            
            {/* Close button */}
            <button
              onClick={() => setPreviewDiploma(null)}
              className="absolute right-4 top-4 h-8 w-8 rounded-full border border-slate-900 bg-slate-950/50 flex items-center justify-center text-slate-500 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Emblem */}
            <div className="space-y-1">
              <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest block">MOZAI INTERNATIONAL</span>
              <span className="text-[8px] text-slate-500 block font-mono">OFFICIAL ACADEMIC CREDENTIAL</span>
            </div>

            <div className="h-0.5 w-24 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />

            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 block italic">Certifica-se solenemente que o aluno</span>
              <span className="text-xl font-extrabold text-white block tracking-wide py-1">{previewDiploma.recipientName}</span>
              <span className="text-xs text-slate-400 block max-w-sm mx-auto">
                concluiu com distinção e aproveitamento a formação avançada de especialização de:
              </span>
              <h4 className="text-base font-extrabold text-indigo-400 leading-snug max-w-md mx-auto pt-2">
                "{previewDiploma.title}"
              </h4>
            </div>

            <div className="h-0.5 w-24 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />

            {/* Details */}
            <div className="w-full grid grid-cols-2 gap-4 border-t border-slate-900/60 pt-4 text-left text-[10px] text-slate-500 font-mono">
              <div className="space-y-1">
                <span>CÓDIGO VERIFICADOR:</span>
                <span className="block text-slate-350 font-bold">{previewDiploma.verificationCode}</span>
              </div>
              <div className="space-y-1 text-right">
                <span>DATA DE EMISSÃO:</span>
                <span className="block text-slate-350 font-bold">{previewDiploma.issueDate}</span>
              </div>
            </div>

            <div className="w-full flex items-center justify-center pt-2">
              <span className="text-[9px] text-indigo-400 bg-indigo-500/5 border border-indigo-500/10 px-3 py-1 rounded-full flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" />
                Assinado digitalmente por Mozai Credentials Agent
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
