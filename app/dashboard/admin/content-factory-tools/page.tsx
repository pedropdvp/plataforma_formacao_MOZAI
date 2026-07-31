"use client";

import React, { useState } from "react";
import {
  Wand2, Loader2, Presentation, Briefcase, GraduationCap, FileText, Layers,
  Mic, FileAudio, Languages, Image as ImageIcon, Download, Info,
} from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";

type Tool =
  | "slides" | "project-brief" | "exam" | "summary" | "flashcards"
  | "podcast" | "transcribe" | "translate" | "infographic";

const TOOLS: { id: Tool; label: string; icon: React.ElementType; credits: number }[] = [
  { id: "slides", label: "Slides", icon: Presentation, credits: 1 },
  { id: "project-brief", label: "Projetos", icon: Briefcase, credits: 1 },
  { id: "exam", label: "Exames", icon: GraduationCap, credits: 2 },
  { id: "summary", label: "Resumos", icon: FileText, credits: 1 },
  { id: "flashcards", label: "Flashcards", icon: Layers, credits: 1 },
  { id: "podcast", label: "Podcasts", icon: Mic, credits: 3 },
  { id: "transcribe", label: "Transcrições & Legendas", icon: FileAudio, credits: 2 },
  { id: "translate", label: "Traduções", icon: Languages, credits: 1 },
  { id: "infographic", label: "Infográficos", icon: ImageIcon, credits: 3 },
];

export default function ContentFactoryToolsPage() {
  const { showToast } = useToast();
  const [tool, setTool] = useState<Tool>("slides");
  const [sourceText, setSourceText] = useState("");
  const [title, setTitle] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("inglês");
  const [questionCount, setQuestionCount] = useState(12);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);

  const activeTool = TOOLS.find((t) => t.id === tool)!;

  const handleGenerate = async () => {
    setGenerating(true);
    setResult(null);
    try {
      let body: any = { sourceText, title };

      if (tool === "exam") body.questionCount = questionCount;
      if (tool === "translate") body.targetLanguage = targetLanguage;

      if (tool === "transcribe") {
        if (!audioFile) {
          showToast("Escolha um ficheiro de áudio/vídeo.", "error");
          setGenerating(false);
          return;
        }
        setUploadingAudio(true);
        const { upload } = await import("@vercel/blob/client");
        const blob = await upload(audioFile.name, audioFile, {
          access: "public",
          handleUploadUrl: "/api/admin/content-factory-tools/audio-upload-token",
        });
        setUploadingAudio(false);
        body = { audioUrl: blob.url, title };
      }

      const res = await fetch(`/api/admin/content-factory-tools/${tool}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        showToast("Gerado com sucesso — pendente de revisão humana.", "success");
      } else {
        showToast(data.error || "Erro ao gerar.", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Erro de comunicação.", "error");
    } finally {
      setGenerating(false);
      setUploadingAudio(false);
    }
  };

  return (
    <div className="space-y-8 workspace-page-container">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Wand2 className="h-6 w-6 text-indigo-400" />
          Content Factory — Ferramentas
        </h1>
        <p className="text-sm text-slate-400">Geradores reais de conteúdo educativo — cada resultado fica pendente de revisão humana antes de ser usado.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTool(t.id); setResult(null); }}
            className={`h-9 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              tool === t.id ? "bg-indigo-600 text-white" : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (opcional)" className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />

        {tool === "transcribe" ? (
          <input
            type="file"
            accept="audio/*,video/*"
            onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
            className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-[11px] file:mr-3 file:h-full file:border-0 file:bg-slate-900 file:text-slate-300 file:px-3 file:text-xs file:rounded-l-xl file:cursor-pointer"
          />
        ) : (
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Cole aqui o conteúdo da lição/curso a partir do qual gerar..."
            className="w-full h-32 p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none resize-none"
          />
        )}

        {tool === "exam" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Número de perguntas:</span>
            <input type="number" min={8} max={20} value={questionCount} onChange={(e) => setQuestionCount(parseInt(e.target.value) || 12)} className="w-20 h-9 px-2 rounded-lg border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
          </div>
        )}

        {tool === "translate" && (
          <input value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} placeholder="Idioma de destino (ex: inglês, francês)" className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
        )}

        <button onClick={handleGenerate} disabled={generating} className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-55">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {uploadingAudio ? "A carregar ficheiro..." : generating ? "A gerar..." : `Gerar ${activeTool.label} (${activeTool.credits} Créditos IA)`}
        </button>
      </div>

      {result && (
        <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-3xl p-6 space-y-3">
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> Resultado (pendente de revisão)</span>

          {tool === "slides" && result.slides.map((s: any, i: number) => (
            <div key={i} className="p-3 rounded-xl bg-slate-950/60 border border-slate-900">
              <h4 className="font-bold text-xs text-white">{i + 1}. {s.title}</h4>
              <ul className="text-[11px] text-slate-400 list-disc list-inside mt-1">{s.bullets.map((b: string, j: number) => <li key={j}>{b}</li>)}</ul>
            </div>
          ))}

          {tool === "project-brief" && (
            <div className="text-xs text-slate-300 space-y-1">
              <p><strong>{result.project.title}</strong></p>
              <p>{result.project.objective}</p>
              <p className="text-slate-500">Entregáveis: {result.project.deliverables.join(", ")}</p>
            </div>
          )}

          {tool === "exam" && (
            <div className="text-xs text-slate-300 space-y-2">
              <p className="font-bold">{result.exam.title} — {result.exam.timeLimitMinutes} min — {result.exam.questions.length} perguntas</p>
              {result.exam.questions.slice(0, 3).map((q: any, i: number) => <p key={i} className="text-slate-500">{i + 1}. {q.question}</p>)}
              <p className="text-slate-600 italic">... e mais {result.exam.questions.length - 3} perguntas.</p>
            </div>
          )}

          {tool === "summary" && <p className="text-xs text-slate-300 whitespace-pre-wrap">{result.summary}</p>}

          {tool === "flashcards" && result.flashcards.map((f: any, i: number) => (
            <div key={i} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-900 text-xs">
              <strong className="text-white">{f.front}</strong> — <span className="text-slate-400">{f.back}</span>
            </div>
          ))}

          {tool === "podcast" && (
            <div className="space-y-2">
              <audio controls src={result.audioUrl} className="w-full" />
              <p className="text-[11px] text-slate-400 whitespace-pre-wrap">{result.script}</p>
            </div>
          )}

          {tool === "transcribe" && (
            <div className="space-y-2">
              <p className="text-xs text-slate-300 whitespace-pre-wrap">{result.text}</p>
              <a href={result.srtUrl} download className="text-[11px] text-indigo-400 underline flex items-center gap-1 w-fit"><Download className="h-3 w-3" /> Descarregar legendas (.srt)</a>
            </div>
          )}

          {tool === "translate" && <p className="text-xs text-slate-300 whitespace-pre-wrap">{result.translation}</p>}

          {tool === "infographic" && (
            <div className="space-y-2">
              <img src={result.imageUrl} alt="Infográfico gerado" className="rounded-xl max-w-sm" />
              <a href={result.imageUrl} download className="text-[11px] text-indigo-400 underline flex items-center gap-1 w-fit"><Download className="h-3 w-3" /> Descarregar</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
