"use client";

import React, { useState, useEffect } from "react";
import { Award, Download, ExternalLink, Calendar, Loader2, X, Eye, ShieldCheck } from "lucide-react";
import { useAccess } from "@/hooks/use-access";

interface Diploma {
  id: string;
  title: string;
  recipientName: string;
  issueDate: string;
  verificationCode: string;
  grade: string;
  hours: number;
}

// Fallback estático dos cursos demos
const ALL_COURSES = [
  {
    _id: "course-1",
    title: "Especialista em Engenharia de IA e RAG Avançado",
    lessonsCount: 18,
    hours: 24,
  },
  {
    _id: "course-2",
    title: "Especialista em Next.js 16 e Composable SaaS",
    lessonsCount: 14,
    hours: 18,
  },
  {
    _id: "course-3",
    title: "Especialista em Smart Contracts e Criptografia com Solidity",
    lessonsCount: 22,
    hours: 30,
  },
];

export default function DiplomasPage() {
  const { userName } = useAccess();
  const [diplomas, setDiplomas] = useState<Diploma[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estados de visualização e download
  const [previewDiploma, setPreviewDiploma] = useState<Diploma | null>(null);
  const [downloadingDipId, setDownloadingDipId] = useState<string | null>(null);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);

  const studentName = userName || "Estudante MOZAI";

  useEffect(() => {
    async function loadDiplomasData() {
      try {
        const [catalogRes, progressRes] = await Promise.all([
          fetch("/api/catalog"),
          fetch("/api/progress"),
        ]);

        let allAvailableCourses: any[] = ALL_COURSES;
        if (catalogRes.ok) {
          const data = await catalogRes.json();
          const real = (data.courses || []).map((c: any) => {
            const mins = typeof c.minutes === "number" ? c.minutes : 0;
            const hours = mins >= 60 ? Math.round(mins / 60) : 12; // Carga horária
            return {
              _id: c._id,
              title: `Especialista em ${c.title}`,
              lessonsCount: c.lessonsCount || 0,
              hours,
            };
          });
          if (real.length > 0) {
            const realIds = new Set(real.map((c: any) => c._id));
            allAvailableCourses = [...real, ...ALL_COURSES.filter((c) => !realIds.has(c._id))];
          }
        }

        let progressList: any[] = [];
        if (progressRes.ok) {
          const pdata = await progressRes.json();
          progressList = pdata.progress || [];
        }

        // Mapear apenas cursos concluídos a 100% como diplomas reais
        const dips: Diploma[] = [];
        allAvailableCourses.forEach((course) => {
          const courseProgress = progressList.filter(
            (p: any) => p.courseId === course._id && p.status === "completed"
          );
          const completedCount = courseProgress.length;
          const denom = course.lessonsCount > 0 ? course.lessonsCount : 3;

          if (completedCount >= denom && denom > 0) {
            // Obter data de conclusão
            let finalDate = "Hoje";
            if (courseProgress.length > 0) {
              const dates = courseProgress
                .map((p: any) => p.updatedAt ? new Date(p.updatedAt) : new Date())
                .sort((a, b) => b.getTime() - a.getTime());
              if (dates.length > 0) {
                finalDate = dates[0].toLocaleDateString("pt-PT");
              }
            }

            // Gerar um código único
            const hash = course._id.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
            const code = `DIP-${hash}-9841-${Math.floor(1000 + Math.random() * 9000)}`;

            dips.push({
              id: `dip-${course._id}`,
              title: course.title,
              recipientName: studentName,
              issueDate: finalDate,
              verificationCode: code,
              grade: "Excelente (100%)",
              hours: course.hours,
            });
          }
        });

        setDiplomas(dips);
      } catch (err) {
        console.error("Erro ao ler dados de diplomas:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadDiplomasData();
  }, [studentName]);

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
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <Award className="h-7 w-7 text-indigo-400" />
          Meus Diplomas
        </h1>
        <p className="text-sm text-slate-400">
          Gere, consulte e descarregue os seus diplomas académicos oficiais verificados pela MOZAI.
        </p>
      </div>

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
                Complete todas as etapas obrigatórias de um dos cursos a 100% para que o seu diploma oficial seja assinado e emitido nesta área.
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
                    Este diploma atesta formalmente a conclusão da formação avançada com carga horária de {dip.hours} horas, incluindo avaliações práticas no Coding Lab e verificação automática por agentes.
                  </p>
                </div>

                {/* Stats Metadata */}
                <div className="grid grid-cols-3 gap-4 py-4 border-t border-b border-slate-900/60 text-xs">
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
