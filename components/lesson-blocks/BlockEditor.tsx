"use client";

import React, { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Plus,
  Trash2,
  Heading,
  Type,
  ImageIcon,
  Video,
  HelpCircle,
  MessageSquare,
  Code2,
  X,
} from "lucide-react";
import {
  LessonBlock,
  LessonBlockType,
  BLOCK_TYPE_LABELS,
  createEmptyBlock,
  newBlockId,
} from "@/lib/lesson-blocks";
import type { MediaItem } from "@/components/lesson-blocks/MediaLibraryPanel";

const BLOCK_TYPE_ICONS: Record<LessonBlockType, React.ElementType> = {
  heading: Heading,
  text: Type,
  image: ImageIcon,
  video: Video,
  quiz: HelpCircle,
  callout: MessageSquare,
  code: Code2,
};

const BLOCK_TYPES: LessonBlockType[] = ["heading", "text", "image", "video", "quiz", "callout", "code"];

const END_ZONE_ID = "block-editor-end-zone";

function mediaItemToBlock(item: MediaItem): LessonBlock {
  if (item.type === "image") {
    return { id: newBlockId(), type: "image", url: item.url || "", alt: item.alt || item.filename || "" };
  }
  return {
    id: newBlockId(),
    type: "video",
    provider: "mux",
    videoId: item.muxPlaybackId || undefined,
    uploadId: item.muxUploadId,
    status: item.status,
  };
}

interface BlockEditorProps {
  blocks: LessonBlock[];
  onChange: (blocks: LessonBlock[]) => void;
  /** Slot para a MediaLibraryPanel — fica dentro do mesmo DndContext, permitindo arrastar media para a lista. */
  children?: React.ReactNode;
}

/**
 * Editor visual em blocos, com arrastar-e-largar (reordenar blocos e arrastar
 * itens da Biblioteca de Media — `children` — para dentro da lista).
 */
export function BlockEditor({ blocks, onChange, children }: BlockEditorProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [insertPickerAt, setInsertPickerAt] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const updateBlock = (id: string, patch: Partial<LessonBlock>) => {
    onChange(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as LessonBlock) : b)));
  };

  const removeBlock = (id: string) => {
    onChange(blocks.filter((b) => b.id !== id));
  };

  const insertBlockAt = (index: number, type: LessonBlockType) => {
    const next = [...blocks];
    next.splice(index, 0, createEmptyBlock(type));
    onChange(next);
    setInsertPickerAt(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current as any;

    // Caso 1: um item da Biblioteca de Media foi largado na lista de blocos
    if (activeData?.source === "media-library") {
      const mediaItem: MediaItem = activeData.item;
      const newBlock = mediaItemToBlock(mediaItem);
      let insertIndex = blocks.length;
      if (over.id !== END_ZONE_ID) {
        const overIndex = blocks.findIndex((b) => b.id === over.id);
        if (overIndex !== -1) insertIndex = overIndex + 1;
      }
      const next = [...blocks];
      next.splice(insertIndex, 0, newBlock);
      onChange(next);
      return;
    }

    // Caso 2: reordenar blocos existentes
    if (active.id !== over.id && over.id !== END_ZONE_ID) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onChange(arrayMove(blocks, oldIndex, newIndex));
      }
    }
  };

  const activeBlock = blocks.find((b) => b.id === activeId);

  return (
    <div className="flex h-full min-h-0">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 min-w-0 overflow-y-auto p-3 space-y-1.5">
          <InsertBar
            active={insertPickerAt === 0}
            onToggle={() => setInsertPickerAt(insertPickerAt === 0 ? null : 0)}
            onPick={(type) => insertBlockAt(0, type)}
          />
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            {blocks.map((block, idx) => (
              <React.Fragment key={block.id}>
                <SortableBlockRow block={block} onUpdate={(patch) => updateBlock(block.id, patch)} onRemove={() => removeBlock(block.id)} />
                <InsertBar
                  active={insertPickerAt === idx + 1}
                  onToggle={() => setInsertPickerAt(insertPickerAt === idx + 1 ? null : idx + 1)}
                  onPick={(type) => insertBlockAt(idx + 1, type)}
                />
              </React.Fragment>
            ))}
          </SortableContext>
          <EndDropZone hasBlocks={blocks.length > 0} />
        </div>
        {children}
        <DragOverlay>
          {activeBlock ? (
            <div className="rounded-xl border border-indigo-500/50 bg-slate-900 p-3 shadow-2xl opacity-90 text-xs text-slate-300">
              {BLOCK_TYPE_LABELS[activeBlock.type]}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function EndDropZone({ hasBlocks }: { hasBlocks: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: END_ZONE_ID });
  return (
    <div
      ref={setNodeRef}
      className={`h-10 rounded-xl border border-dashed flex items-center justify-center text-[10px] transition-colors ${
        isOver ? "border-indigo-500 bg-indigo-500/10 text-indigo-300" : "border-slate-900 text-slate-700"
      }`}
    >
      {!hasBlocks ? "Arraste media aqui ou use os botões “+” para começar" : "Largar aqui para adicionar ao fim"}
    </div>
  );
}

function InsertBar({ active, onToggle, onPick }: { active: boolean; onToggle: () => void; onPick: (type: LessonBlockType) => void }) {
  return (
    <div className="relative flex items-center justify-center group h-2.5">
      <button
        onClick={onToggle}
        className={`absolute z-10 h-5 w-5 rounded-full bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer ${
          active ? "opacity-100 bg-indigo-600 text-white" : "opacity-0 group-hover:opacity-100"
        }`}
        title="Inserir bloco aqui"
      >
        {active ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
      </button>
      {active && (
        <div className="absolute z-20 top-6 flex flex-wrap gap-1 p-1.5 rounded-xl border border-slate-800 bg-slate-900 shadow-2xl w-64 no-3d-effect">
          {BLOCK_TYPES.map((type) => {
            const Icon = BLOCK_TYPE_ICONS[type];
            return (
              <button
                key={type}
                onClick={() => onPick(type)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-indigo-600 text-slate-300 hover:text-white text-[10px] font-semibold cursor-pointer transition-colors"
              >
                <Icon className="h-3 w-3" />
                {BLOCK_TYPE_LABELS[type]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SortableBlockRow({
  block,
  onUpdate,
  onRemove,
}: {
  block: LessonBlock;
  onUpdate: (patch: Partial<LessonBlock>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const Icon = BLOCK_TYPE_ICONS[block.type];

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="border border-slate-900 bg-slate-900/10 rounded-xl overflow-hidden no-3d-effect">
      <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-slate-900/70 bg-slate-900/20">
        <button {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 shrink-0">
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <Icon className="h-3 w-3 text-indigo-400 shrink-0" />
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex-1">{BLOCK_TYPE_LABELS[block.type]}</span>
        <button onClick={onRemove} className="text-slate-600 hover:text-rose-400 cursor-pointer shrink-0">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-2.5">
        <BlockFields block={block} onUpdate={onUpdate} />
      </div>
    </div>
  );
}

const fieldClass =
  "w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500";

function BlockFields({ block, onUpdate }: { block: LessonBlock; onUpdate: (patch: Partial<LessonBlock>) => void }) {
  switch (block.type) {
    case "heading":
      return (
        <div className="flex gap-2">
          <select
            value={block.level}
            onChange={(e) => onUpdate({ level: Number(e.target.value) as 2 | 3 })}
            className={`${fieldClass} w-20 shrink-0`}
          >
            <option value={2}>H2</option>
            <option value={3}>H3</option>
          </select>
          <input value={block.text} onChange={(e) => onUpdate({ text: e.target.value })} className={fieldClass} placeholder="Título" />
        </div>
      );

    case "text":
      return (
        <textarea
          value={block.markdown}
          onChange={(e) => onUpdate({ markdown: e.target.value })}
          className={`${fieldClass} h-24 resize-y font-mono`}
          placeholder="Texto (Markdown suportado)"
        />
      );

    case "image":
      return (
        <div className="space-y-2">
          {block.url && <img src={block.url} alt={block.alt || ""} className="max-h-32 rounded-lg border border-slate-800" />}
          <input value={block.url} onChange={(e) => onUpdate({ url: e.target.value })} className={fieldClass} placeholder="URL da imagem (ou arraste da Biblioteca de Media)" />
          <input value={block.alt || ""} onChange={(e) => onUpdate({ alt: e.target.value })} className={fieldClass} placeholder="Texto alternativo" />
          <input value={block.caption || ""} onChange={(e) => onUpdate({ caption: e.target.value })} className={fieldClass} placeholder="Legenda (opcional)" />
        </div>
      );

    case "video":
      return (
        <div className="space-y-2">
          {block.status === "processing" && (
            <p className="text-[10px] text-amber-400">A processar no Mux — o Playback ID é preenchido automaticamente quando estiver pronto.</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <select value={block.provider} onChange={(e) => onUpdate({ provider: e.target.value as "mux" | "youtube" })} className={fieldClass}>
              <option value="youtube">YouTube</option>
              <option value="mux">Mux</option>
            </select>
            <input
              value={block.videoId || ""}
              onChange={(e) => onUpdate({ videoId: e.target.value })}
              className={fieldClass}
              placeholder="ID do vídeo / Playback ID"
            />
          </div>
        </div>
      );

    case "quiz":
      return (
        <div className="space-y-2">
          <input value={block.question} onChange={(e) => onUpdate({ question: e.target.value })} className={fieldClass} placeholder="Pergunta" />
          <div className="space-y-1.5">
            {block.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={block.correctIndex === i}
                  onChange={() => onUpdate({ correctIndex: i })}
                  className="shrink-0 accent-indigo-500"
                  title="Resposta correta"
                />
                <input
                  value={opt}
                  onChange={(e) => {
                    const next = [...block.options];
                    next[i] = e.target.value;
                    onUpdate({ options: next });
                  }}
                  className={fieldClass}
                  placeholder={`Opção ${i + 1}`}
                />
                {block.options.length > 2 && (
                  <button
                    onClick={() => {
                      const next = block.options.filter((_, idx) => idx !== i);
                      onUpdate({ options: next, correctIndex: block.correctIndex >= next.length ? 0 : block.correctIndex });
                    }}
                    className="text-slate-600 hover:text-rose-400 cursor-pointer shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            {block.options.length < 6 && (
              <button
                onClick={() => onUpdate({ options: [...block.options, ""] })}
                className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer"
              >
                + Adicionar opção
              </button>
            )}
          </div>
          <textarea
            value={block.explanation || ""}
            onChange={(e) => onUpdate({ explanation: e.target.value })}
            className={`${fieldClass} h-14 resize-y`}
            placeholder="Explicação da resposta correta (opcional)"
          />
        </div>
      );

    case "callout":
      return (
        <div className="space-y-2">
          <select value={block.style} onChange={(e) => onUpdate({ style: e.target.value as "info" | "warning" | "tip" })} className={fieldClass}>
            <option value="info">Informação</option>
            <option value="warning">Aviso</option>
            <option value="tip">Dica</option>
          </select>
          <textarea value={block.text} onChange={(e) => onUpdate({ text: e.target.value })} className={`${fieldClass} h-16 resize-y`} placeholder="Texto do destaque" />
        </div>
      );

    case "code":
      return (
        <div className="space-y-2">
          <input value={block.language} onChange={(e) => onUpdate({ language: e.target.value })} className={fieldClass} placeholder="Linguagem (ex: javascript)" />
          <textarea
            value={block.code}
            onChange={(e) => onUpdate({ code: e.target.value })}
            className={`${fieldClass} h-24 resize-y font-mono`}
            placeholder="Código"
          />
        </div>
      );

    default:
      return null;
  }
}
