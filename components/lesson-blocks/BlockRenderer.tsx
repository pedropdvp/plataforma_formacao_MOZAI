"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Play, Info, AlertTriangle, Lightbulb, CheckCircle2, XCircle, ChevronDown, Sparkles, Loader2, RotateCw, GitBranch, Volume2 } from "lucide-react";
import type { LessonBlock } from "@/lib/lesson-blocks";
import { CodeLabBlockView } from "@/components/lesson-blocks/CodeLabBlockView";

interface BlockRendererProps {
  blocks: LessonBlock[];
  /** Contexto opcional (curso + lição), permite cachear no servidor a explicação alternativa gerada por IA nos callouts. */
  courseId?: string;
  lessonKey?: string;
  /** Lições do curso (slug + título), usadas para resolver o destino de quizzes ramificados. */
  lessons?: { slug: string; title: string }[];
}

/**
 * Renderiza um array de LessonBlock. Usado tanto no editor (pré-visualização)
 * como no visualizador do aluno — garante que o que o autor vê é o que o aluno vê.
 */
export function BlockRenderer({ blocks, courseId, lessonKey, lessons }: BlockRendererProps) {
  if (!blocks || blocks.length === 0) {
    return <p className="text-sm text-slate-400 leading-relaxed">Conteúdo desta lição ainda em preparação.</p>;
  }

  return (
    <div className="space-y-4">
      {blocks.map((block) => (
        <BlockView key={block.id} block={block} courseId={courseId} lessonKey={lessonKey} lessons={lessons} />
      ))}
    </div>
  );
}

function BlockView({
  block,
  courseId,
  lessonKey,
  lessons,
}: {
  block: LessonBlock;
  courseId?: string;
  lessonKey?: string;
  lessons?: { slug: string; title: string }[];
}) {
  switch (block.type) {
    case "heading": {
      const Tag = block.level === 2 ? "h2" : "h3";
      return (
        <div className="flex items-center gap-2 mt-6 mb-1 group">
          <Tag className={block.level === 2 ? "text-lg font-bold text-white m-0" : "text-base font-semibold text-white m-0"}>
            {block.text}
          </Tag>
          <NarrationButton text={block.text} audioUrl={block.audioUrl} courseId={courseId} lessonKey={lessonKey} blockId={block.id} />
        </div>
      );
    }

    case "text":
      return (
        <div className="space-y-1.5">
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap m-0">{block.markdown}</p>
          <NarrationButton text={block.markdown} audioUrl={block.audioUrl} courseId={courseId} lessonKey={lessonKey} blockId={block.id} />
        </div>
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
      return <QuizBlockView block={block} courseId={courseId} lessons={lessons} />;

    case "callout":
      return <CalloutBlockView block={block} courseId={courseId} lessonKey={lessonKey} />;

    case "code":
      return (
        <pre className="rounded-xl border border-slate-800 bg-slate-950 p-4 overflow-x-auto text-xs text-slate-200 font-mono">
          <code>{block.code}</code>
        </pre>
      );

    case "accordion":
      return <AccordionBlockView block={block} />;

    case "tabs":
      return <TabsBlockView block={block} />;

    case "flashcards":
      return <FlashcardsBlockView block={block} />;

    case "hotspot":
      return <HotspotBlockView block={block} />;

    case "codeLab":
      return (
        <CodeLabBlockView
          language={block.language}
          starterCode={block.starterCode}
          expectedOutput={block.expectedOutput}
          instructions={block.instructions}
        />
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

function CalloutBlockView({
  block,
  courseId,
  lessonKey,
}: {
  block: Extract<LessonBlock, { type: "callout" }>;
  courseId?: string;
  lessonKey?: string;
}) {
  const cfg = CALLOUT_STYLES[block.style] || CALLOUT_STYLES.info;
  const Icon = cfg.icon;
  const [alternateText, setAlternateText] = useState<string | undefined>(block.alternateText);
  const [showAlternate, setShowAlternate] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleExplainDifferently = async () => {
    if (alternateText) {
      setShowAlternate((prev) => !prev);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/lessons/explain-differently", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: block.text, courseId, lessonKey, blockId: block.id }),
      });
      const data = await res.json();
      if (res.ok && data.explanation) {
        setAlternateText(data.explanation);
        setShowAlternate(true);
      }
    } catch {
      // silencioso — o texto original continua visível
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`rounded-2xl border p-4 text-sm leading-relaxed space-y-2.5 ${cfg.classes}`}>
      <div className="flex items-start gap-3">
        <Icon className="h-4 w-4 mt-0.5 shrink-0" />
        <span>{showAlternate && alternateText ? alternateText : block.text}</span>
      </div>
      <button
        onClick={handleExplainDifferently}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-80 hover:opacity-100 cursor-pointer disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : showAlternate ? <RotateCw className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
        {loading ? "A gerar explicação..." : showAlternate ? "Ver texto original" : "Explicar de outra forma"}
      </button>
    </div>
  );
}

function AccordionBlockView({ block }: { block: Extract<LessonBlock, { type: "accordion" }> }) {
  const [openId, setOpenId] = useState<string | null>(block.items[0]?.id ?? null);
  return (
    <div className="space-y-1.5">
      {block.items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/20 overflow-hidden no-3d-effect">
            <button
              onClick={() => setOpenId(isOpen ? null : item.id)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left cursor-pointer hover:bg-slate-900/30 transition-colors"
            >
              <span className="text-sm font-semibold text-white">{item.title}</span>
              <ChevronDown className={`h-4 w-4 text-slate-500 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && <div className="px-4 pb-3 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{item.content}</div>}
          </div>
        );
      })}
    </div>
  );
}

function TabsBlockView({ block }: { block: Extract<LessonBlock, { type: "tabs" }> }) {
  const [activeId, setActiveId] = useState<string | undefined>(block.items[0]?.id);
  const active = block.items.find((it) => it.id === activeId) || block.items[0];
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/20 overflow-hidden no-3d-effect">
      <div className="flex items-center gap-1 p-1.5 border-b border-slate-800 overflow-x-auto">
        {block.items.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveId(item.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              active?.id === item.id ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="p-4 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{active?.content}</div>
    </div>
  );
}

function FlashcardsBlockView({ block }: { block: Extract<LessonBlock, { type: "flashcards" }> }) {
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {block.cards.map((card) => {
        const isFlipped = !!flipped[card.id];
        return (
          <button
            key={card.id}
            onClick={() => setFlipped((prev) => ({ ...prev, [card.id]: !prev[card.id] }))}
            className="text-left rounded-2xl border border-slate-800 bg-slate-900/20 hover:border-indigo-500/40 p-4 min-h-[96px] flex items-center justify-center text-center cursor-pointer transition-colors no-3d-effect"
          >
            <span className={`text-sm ${isFlipped ? "text-slate-400 italic" : "text-white font-semibold"}`}>
              {isFlipped ? card.back : card.front}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function HotspotBlockView({ block }: { block: Extract<LessonBlock, { type: "hotspot" }> }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = block.points.find((p) => p.id === activeId);
  if (!block.imageUrl) return null;
  return (
    <div className="space-y-2">
      <div className="relative rounded-2xl border border-slate-800 overflow-hidden">
        <img src={block.imageUrl} alt="" className="w-full h-auto block" />
        {block.points.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveId(activeId === p.id ? null : p.id)}
            className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500 hover:bg-indigo-400 border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-bold text-white cursor-pointer transition-transform hover:scale-110"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            title={p.label}
          >
            +
          </button>
        ))}
      </div>
      {active && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-3">
          <p className="text-xs font-bold text-white mb-1">{active.label}</p>
          <p className="text-xs text-slate-400 leading-relaxed">{active.description}</p>
        </div>
      )}
    </div>
  );
}

function QuizBlockView({
  block,
  courseId,
  lessons,
}: {
  block: Extract<LessonBlock, { type: "quiz" }>;
  courseId?: string;
  lessons?: { slug: string; title: string }[];
}) {
  const [selected, setSelected] = useState<number | null>(null);

  if (!block.question) return null;

  const branchTarget = selected !== null ? block.branchTargets?.find((bt) => bt.optionIndex === selected) : undefined;
  const branchLesson = branchTarget ? lessons?.find((l) => l.slug === branchTarget.nextLessonSlug) : undefined;

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
      {branchTarget && courseId && (
        <Link
          href={`/dashboard/courses/${courseId}/lessons/${branchTarget.nextLessonSlug}`}
          className="flex items-center justify-between gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-2.5 text-xs font-bold text-indigo-200 hover:bg-indigo-500/20 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5" />
            Continuar para: {branchLesson?.title || branchTarget.nextLessonSlug}
          </span>
          <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
        </Link>
      )}
    </div>
  );
}

/**
 * Botão "Ouvir" — gera (ou reaproveita, se já em cache) narração por voz sintética
 * de um bloco heading/text. Ação explícita por bloco, nunca automática, para manter
 * o custo (a ElevenLabs cobra por carácter) sempre visível e controlado pelo autor.
 */
function NarrationButton({
  text,
  audioUrl: initialAudioUrl,
  courseId,
  lessonKey,
  blockId,
}: {
  text: string;
  audioUrl?: string;
  courseId?: string;
  lessonKey?: string;
  blockId: string;
}) {
  const [audioUrl, setAudioUrl] = useState<string | undefined>(initialAudioUrl);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!text || !text.trim()) return null;

  const handleClick = async () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
      setPlaying(true);
      audio.onended = () => setPlaying(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/lessons/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, courseId, lessonKey, blockId }),
      });
      const data = await res.json();
      if (res.ok && data.audioUrl) {
        setAudioUrl(data.audioUrl);
        const audio = new Audio(data.audioUrl);
        audio.play();
        setPlaying(true);
        audio.onended = () => setPlaying(false);
      } else {
        setError(data.error || "Narração indisponível.");
      }
    } catch {
      setError("Erro de comunicação ao gerar narração.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      <button
        onClick={handleClick}
        disabled={loading}
        title={error || "Ouvir narração por voz sintética"}
        className={`opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-50 ${
          playing ? "text-indigo-400 opacity-100" : error ? "text-rose-500 opacity-100" : "text-slate-600 hover:text-indigo-400"
        }`}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}
