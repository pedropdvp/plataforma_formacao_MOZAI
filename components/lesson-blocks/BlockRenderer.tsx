"use client";

import React, { useState } from "react";
import { Play, Info, AlertTriangle, Lightbulb, CheckCircle2, XCircle } from "lucide-react";
import type { LessonBlock } from "@/lib/lesson-blocks";

/**
 * Renderiza um array de LessonBlock. Usado tanto no editor (pré-visualização)
 * como no visualizador do aluno — garante que o que o autor vê é o que o aluno vê.
 */
export function BlockRenderer({ blocks }: { blocks: LessonBlock[] }) {
  if (!blocks || blocks.length === 0) {
    return <p className="text-sm text-slate-400 leading-relaxed">Conteúdo desta lição ainda em preparação.</p>;
  }

  return (
    <div className="space-y-4">
      {blocks.map((block) => (
        <BlockView key={block.id} block={block} />
      ))}
    </div>
  );
}

function BlockView({ block }: { block: LessonBlock }) {
  switch (block.type) {
    case "heading": {
      const Tag = block.level === 2 ? "h2" : "h3";
      return (
        <Tag className={block.level === 2 ? "text-lg font-bold text-white mt-6 mb-1" : "text-base font-semibold text-white mt-4 mb-1"}>
          {block.text}
        </Tag>
      );
    }

    case "text":
      return (
        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{block.markdown}</p>
      );

    case "image":
      if (!block.url) return null;
      return (
        <figure className="space-y-1.5">
          <img
            src={block.url}
            alt={block.alt || ""}
            className="rounded-2xl border border-slate-800 max-w-full h-auto"
          />
          {block.caption && <figcaption className="text-[11px] text-slate-500 text-center">{block.caption}</figcaption>}
        </figure>
      );

    case "video":
      return <VideoBlockView provider={block.provider} videoId={block.videoId} status={block.status} />;

    case "quiz":
      return <QuizBlockView block={block} />;

    case "callout":
      return <CalloutBlockView block={block} />;

    case "code":
      return (
        <pre className="rounded-xl border border-slate-800 bg-slate-950 p-4 overflow-x-auto text-xs text-slate-200 font-mono">
          <code>{block.code}</code>
        </pre>
      );

    default:
      return null;
  }
}

function VideoBlockView({ provider, videoId, status }: { provider?: string; videoId?: string; status?: string }) {
  if (videoId && status === "processing") {
    return (
      <div className="relative rounded-3xl overflow-hidden aspect-video bg-slate-900 border border-slate-800 flex flex-col items-center justify-center gap-3 shadow-2xl">
        <div className="p-5 rounded-full bg-amber-500/10 text-amber-400 animate-pulse">
          <Play className="h-10 w-10 fill-amber-400" />
        </div>
        <span className="text-[11px] text-slate-500">A processar vídeo (Mux)... isto pode demorar alguns minutos.</span>
      </div>
    );
  }
  if (videoId && provider === "mux") {
    return (
      <div className="relative rounded-3xl overflow-hidden aspect-video bg-black border border-slate-800 shadow-2xl">
        <iframe
          src={`https://player.mux.com/${videoId}`}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          title="Vídeo da lição"
        />
      </div>
    );
  }
  if (videoId && provider === "youtube") {
    const id = videoId.includes("http")
      ? (videoId.split("v=")[1]?.split("&")[0] || videoId.split("/").pop())
      : videoId;
    return (
      <div className="relative rounded-3xl overflow-hidden aspect-video bg-black border border-slate-800 shadow-2xl">
        <iframe
          src={`https://www.youtube.com/embed/${id}`}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="Vídeo da lição"
        />
      </div>
    );
  }
  return (
    <div className="relative rounded-3xl overflow-hidden aspect-video bg-slate-900 border border-slate-800 flex flex-col items-center justify-center gap-3 shadow-2xl">
      <div className="p-5 rounded-full bg-slate-800 text-slate-500">
        <Play className="h-10 w-10 fill-slate-500" />
      </div>
      <span className="text-[11px] text-slate-500">Vídeo por configurar — escolha um vídeo da Biblioteca de Media.</span>
    </div>
  );
}

const CALLOUT_STYLES: Record<string, { icon: React.ElementType; classes: string }> = {
  info: { icon: Info, classes: "border-indigo-500/30 bg-indigo-500/10 text-indigo-200" },
  warning: { icon: AlertTriangle, classes: "border-amber-500/30 bg-amber-500/10 text-amber-200" },
  tip: { icon: Lightbulb, classes: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" },
};

function CalloutBlockView({ block }: { block: Extract<LessonBlock, { type: "callout" }> }) {
  const cfg = CALLOUT_STYLES[block.style] || CALLOUT_STYLES.info;
  const Icon = cfg.icon;
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 text-sm leading-relaxed ${cfg.classes}`}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{block.text}</span>
    </div>
  );
}

function QuizBlockView({ block }: { block: Extract<LessonBlock, { type: "quiz" }> }) {
  const [selected, setSelected] = useState<number | null>(null);

  if (!block.question) return null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4 space-y-3 no-3d-effect">
      <p className="text-sm font-semibold text-white">{block.question}</p>
      <div className="space-y-1.5">
        {block.options.map((opt, i) => {
          const isSelected = selected === i;
          const isCorrect = i === block.correctIndex;
          const showResult = selected !== null;
          return (
            <button
              key={i}
              onClick={() => setSelected(i)}
              disabled={showResult}
              className={`w-full flex items-center justify-between gap-2 text-left px-3.5 py-2.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer disabled:cursor-default ${
                showResult && isCorrect
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : showResult && isSelected && !isCorrect
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                  : "border-slate-800 bg-slate-950 text-slate-300 hover:border-indigo-500/40"
              }`}
            >
              <span>{opt}</span>
              {showResult && isCorrect && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
              {showResult && isSelected && !isCorrect && <XCircle className="h-3.5 w-3.5 shrink-0" />}
            </button>
          );
        })}
      </div>
      {selected !== null && block.explanation && (
        <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800 pt-2.5">{block.explanation}</p>
      )}
    </div>
  );
}
