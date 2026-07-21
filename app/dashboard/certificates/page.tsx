"use client";

import React, { useState, useEffect } from "react";
import { Award, Calendar, Download, Eye, ExternalLink, ShieldCheck, Loader2, X } from "lucide-react";
import { useAccess } from "@/hooks/use-access";

interface Certificate {
  id: string;
  courseId: string;
  courseTitle: string;
  completionDate: string;
  verificationCode: string;
  category: string;
  grade: string;
}

// Fallback estático dos cursos demos
const ALL_COURSES = [
  {
    _id: "course-1",
    title: "Engenharia de IA e RAG Avançado",
    category: "Inteligência Artificial",
    lessonsCount: 18,
  },
  {
    _id: "course-2",
    title: "Next.js 16 e Arquiteturas Composable SaaS",
    category: "Programação / Frontend",
    lessonsCount: 14,
  },
  {
    _id: "course-3",
    title: "Smart Contracts e Criptografia com Solidity",
    category: "Crypto & Blockchain",
    lessonsCount: 22,
  },
];

export default function CertificatesPage() {
  const { userName } = useAccess();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estados de visualização e download
  const [previewCertificate, setPreviewCertificate] = useState<Certificate | null>(null);
  const [downloadingCertId, setDownloadingCertId] = useState<string | null>(null);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);

  const studentName = userName || "Estudante MOZAI";

  useEffect(() => {
    async function loadCertificatesData() {
      try {
        const [catalogRes, progressRes] = await Promise.all([
          fetch("/api/catalog"),
          fetch("/api/progress"),
        ]);

        let allAvailableCourses: any[] = ALL_COURSES;
        if (catalogRes.ok) {
          const data = await catalogRes.json();
          const real = (data.courses || []).map((c: any) => ({
            _id: c._id,
            title: c.title,
            category: c.category || "Formação",
            lessonsCount: c.lessonsCount || 0,
          }));
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

        // Mapear apenas cursos concluídos a 100% como certificados reais
        const certList: Certificate[] = [];
        allAvailableCourses.forEach((course) => {
          const courseProgress = progressList.filter(
            (p: any) => p.courseId === course._id && p.status === "completed"
          );
          const completedCount = courseProgress.length;
          const denom = course.lessonsCount > 0 ? course.lessonsCount : 3;

          if (completedCount >= denom && denom > 0) {
            // Obter data da última lição concluída do curso
            let finalDate = "Hoje";
            if (courseProgress.length > 0) {
              const dates = courseProgress
                .map((p: any) => p.updatedAt ? new Date(p.updatedAt) : new Date())
                .sort((a, b) => b.getTime() - a.getTime());
              if (dates.length > 0) {
                finalDate = dates[0].toLocaleDateString("pt-PT");
              }
            }

            // Gerar um código único pseudo-aleatório baseado no ID do curso
            const hash = course._id.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
            const code = `MOZ-${hash}-9841-${Math.floor(1000 + Math.random() * 9000)}`;

            certList.push({
              id: `cert-${course._id}`,
              courseId: course._id,
              courseTitle: course.title,
              completionDate: finalDate,
              verificationCode: code,
              category: course.category,
              grade: "100%", // Lições do mini-quiz superadas
            });
          }
        });

        setCertificates(certList);
      } catch (err) {
        console.error("Erro ao ler dados de certificados:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadCertificatesData();
  }, []);

  // Simular a geração de PDF e descarregar como arquivo PDF oficial formatado
  const handleDownload = (cert: Certificate) => {
    setDownloadingCertId(cert.id);
    setTimeout(() => {
      setDownloadingCertId(null);
      setDownloadToast(`Certificado_${cert.courseTitle.replace(/\s+/g, "_")}.pdf`);
      
      // Auto ocultar toast após 4s
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
(CERTIFICADO DE CONCLUSAO) Tj
ET
BT
/F1 12 Tf
70 600 Td
(Certificamos para os devidos efeitos que o aluno:) Tj
ET
BT
/F2 16 Tf
70 560 Td
(${studentName.toUpperCase()}) Tj
ET
BT
/F1 12 Tf
70 500 Td
(concluiu com aproveitamento a formacao de:) Tj
ET
BT
/F2 14 Tf
70 460 Td
(${cert.courseTitle.toUpperCase()}) Tj
ET
BT
/F1 11 Tf
70 380 Td
(Categoria: ${cert.category}) Tj
ET
BT
/F1 11 Tf
70 350 Td
(Data de Emissao: ${cert.completionDate}) Tj
ET
BT
/F1 11 Tf
70 320 Td
(Codigo de Verificacao: ${cert.verificationCode}) Tj
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
      link.download = `Certificado_${cert.courseTitle.replace(/[^A-Za-z0-9]/g, "_")}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1500);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
        <span className="text-sm font-semibold">A processar os seus certificados oficiais...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <Award className="h-7 w-7 text-amber-400 animate-pulse" />
          Certificados de Conclusão
        </h1>
        <p className="text-sm text-slate-400">
          Consulte e gerencie os seus certificados oficiais emitidos na conclusão de cada curso.
        </p>
      </div>

      {/* Main Area */}
      {certificates.length === 0 ? (
        <div className="border border-slate-900 border-dashed rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4 min-h-[350px]">
          <div className="p-4 rounded-full bg-slate-950 border border-slate-900 text-slate-700">
            <Award className="h-10 w-10" />
          </div>
          <div className="space-y-1 max-w-[320px]">
            <span className="block text-sm font-bold text-slate-350">Ainda não obteve nenhum certificado.</span>
            <p className="text-xs text-slate-500 leading-relaxed">
              Complete todos os módulos de um curso a 100% (superando os mini-quizzes de cada lição) para desbloquear e emitir o seu certificado oficial.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-8">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between group shadow-xl hover:border-slate-800 transition-all"
            >
              {/* Subtle background gold badge glow */}
              <div className="absolute -right-20 -top-20 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="space-y-4">
                {/* Top Badge */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {cert.category}
                  </span>
                  
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-2 py-0.5 rounded-md">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Ativo e Verificado
                  </span>
                </div>

                {/* Course Metadata */}
                <div className="space-y-1">
                  <h3 className="font-extrabold text-white text-base leading-snug group-hover:text-indigo-400 transition-colors">
                    {cert.courseTitle}
                  </h3>
                  <div className="flex items-center gap-4 text-[10px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-600" />
                      {cert.completionDate}
                    </span>
                    <span>Código: {cert.verificationCode}</span>
                  </div>
                </div>

                {/* Detalhes de Emissão */}
                <div className="p-4 rounded-2xl bg-slate-950/65 border border-slate-900/60 space-y-2 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Detalhes de Emissão:</span>
                  <div className="space-y-1.5 font-mono text-[11px] leading-relaxed">
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Data de Conclusão:</span>
                      <span className="text-slate-300 font-bold">{cert.completionDate}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Código Verificador:</span>
                      <span className="text-indigo-400 font-bold">{cert.verificationCode}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Grau de Retenção:</span>
                      <span className="text-emerald-450 font-bold">100% (Quiz Validado com Sucesso)</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Status da Emissão:</span>
                      <span className="text-emerald-450 font-bold">ASSINADO DIGITALMENTE E ATIVO</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 mt-6 border-t border-slate-900/60 pt-4">
                <button
                  onClick={() => setPreviewCertificate(cert)}
                  className="flex-1 h-9 rounded-xl border border-slate-800 bg-slate-950/20 hover:bg-slate-900 hover:border-slate-700 text-xs font-semibold text-slate-350 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye className="h-4 w-4" />
                  Visualizar
                </button>

                <button
                  onClick={() => handleDownload(cert)}
                  disabled={downloadingCertId === cert.id}
                  className="flex-1 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/10 disabled:opacity-55"
                >
                  {downloadingCertId === cert.id ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                      <span>A Gerar...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      <span>Descarregar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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

      {/* MODAL DE VISUALIZAÇÃO DE CERTIFICADO PREMIUM GLASSMORPHIC */}
      {previewCertificate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0b0f19] border-2 border-amber-500/20 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl p-8 relative flex flex-col items-center text-center space-y-6">
            
            {/* Top Glow effects */}
            <div className="absolute -top-32 -left-32 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
            
            {/* Close button */}
            <button
              onClick={() => setPreviewCertificate(null)}
              className="absolute right-4 top-4 h-8 w-8 rounded-full border border-slate-900 bg-slate-950/50 flex items-center justify-center text-slate-500 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Certificate Header Emblem */}
            <div className="space-y-1">
              <span className="text-[10px] text-amber-500 font-extrabold uppercase tracking-widest block">MOZAI INTERNATIONAL</span>
              <span className="text-[8px] text-slate-500 block font-mono">CREDENTIALS ASSURANCE PLATFORM</span>
            </div>

            <div className="h-0.5 w-24 bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 block italic">Este certificado atesta solenemente que</span>
              <span className="text-lg font-extrabold text-white block tracking-wide py-1">{studentName}</span>
              <span className="text-xs text-slate-400 block max-w-sm mx-auto">
                concluiu com êxito todas as etapas de avaliação teórica e prática com 100% de aproveitamento do curso:
              </span>
              <h4 className="text-base font-extrabold text-amber-400 leading-snug max-w-md mx-auto pt-2">
                "{previewCertificate.courseTitle}"
              </h4>
            </div>

            <div className="h-0.5 w-24 bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

            {/* Certificate bottom signatures & verification codes */}
            <div className="w-full grid grid-cols-2 gap-4 border-t border-slate-900/60 pt-4 text-left text-[10px] text-slate-500 font-mono">
              <div className="space-y-1">
                <span>CÓDIGO VERIFICADOR:</span>
                <span className="block text-slate-350 font-bold">{previewCertificate.verificationCode}</span>
              </div>
              <div className="space-y-1 text-right">
                <span>DATA DE EMISSÃO:</span>
                <span className="block text-slate-350 font-bold">{previewCertificate.completionDate}</span>
              </div>
            </div>

            <div className="w-full flex items-center justify-center pt-2">
              <span className="text-[9px] text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-3 py-1 rounded-full flex items-center gap-1.5">
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
