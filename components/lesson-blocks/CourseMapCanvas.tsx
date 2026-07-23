"use client";

import React, { useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap, Node, Edge, MarkerType } from "reactflow";
import "reactflow/dist/style.css";
import { X, Map as MapIcon } from "lucide-react";
import type { LessonBlock } from "@/lib/lesson-blocks";

interface CanvasLesson {
  id?: string;
  slug?: string;
  title: string;
  blocks?: LessonBlock[];
}

interface CanvasModule {
  title: string;
  lessons: CanvasLesson[];
}

interface CourseMapCanvasProps {
  courseTitle: string;
  modules: CanvasModule[];
  onClose: () => void;
}

/**
 * Mapa visual do curso: módulos/lições como nós, com arestas a refletir tanto a
 * ordem linear como as ramificações (branchTargets) definidas nos blocos de quiz —
 * a primeira utilidade real do canvas é tornar visível o que o índice linear atual
 * não consegue mostrar.
 */
export function CourseMapCanvas({ courseTitle, modules, onClose }: CourseMapCanvasProps) {
  const { nodes, edges } = useMemo(() => buildGraph(modules), [modules]);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-6xl h-[85vh] flex flex-col border border-slate-850 bg-slate-950 rounded-3xl shadow-2xl overflow-hidden no-3d-effect">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-900 shrink-0">
          <div className="flex items-center gap-2">
            <MapIcon className="h-4.5 w-4.5 text-indigo-400" />
            <div>
              <h3 className="font-extrabold text-white text-base">Mapa do Curso</h3>
              <p className="text-[11px] text-slate-500">{courseTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-550 hover:text-white transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0">
          <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
            <Background color="#1e293b" gap={20} />
            <Controls />
            <MiniMap
              nodeColor={(n) => (n.data?.isBranchSource ? "#f59e0b" : "#6366f1")}
              maskColor="rgba(2,6,23,0.7)"
              style={{ background: "#0f172a" }}
            />
          </ReactFlow>
        </div>

        <div className="flex items-center gap-4 px-6 py-3 border-t border-slate-900 shrink-0 text-[10px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-indigo-500" /> Percurso linear
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Ramificação (quiz)
          </span>
        </div>
      </div>
    </div>
  );
}

/** Botão auto-contido: abre/fecha o CourseMapCanvas — ponto de entrada reutilizável. */
export function CourseMapButton({ courseTitle, modules }: { courseTitle: string; modules: CanvasModule[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer"
      >
        <MapIcon className="h-3.5 w-3.5" />
        Ver Mapa do Curso
      </button>
      {open && <CourseMapCanvas courseTitle={courseTitle} modules={modules} onClose={() => setOpen(false)} />}
    </>
  );
}

function buildGraph(modules: CanvasModule[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const slugOf = (l: CanvasLesson) => l.slug || l.id || l.title;

  let prevSlug: string | null = null;

  modules.forEach((mod, mIdx) => {
    mod.lessons.forEach((lesson, lIdx) => {
      const slug = slugOf(lesson);
      nodes.push({
        id: slug,
        position: { x: lIdx * 190, y: mIdx * 105 },
        data: { label: lesson.title },
        style: {
          background: "#0f172a",
          color: "#e2e8f0",
          border: "1px solid #334155",
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 600,
          padding: "8px 12px",
          width: 170,
        },
      });

      // Aresta linear: liga à lição anterior (dentro do módulo ou entre módulos)
      if (prevSlug) {
        edges.push({
          id: `linear-${prevSlug}-${slug}`,
          source: prevSlug,
          target: slug,
          animated: false,
          style: { stroke: "#6366f1", strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
        });
      }
      prevSlug = slug;

      // Arestas de ramificação: cada bloco quiz com branchTargets aponta para lições específicas
      for (const block of lesson.blocks || []) {
        if (block.type === "quiz" && block.branchTargets) {
          for (const bt of block.branchTargets) {
            edges.push({
              id: `branch-${slug}-${bt.optionIndex}-${bt.nextLessonSlug}`,
              source: slug,
              target: bt.nextLessonSlug,
              animated: true,
              style: { stroke: "#f59e0b", strokeWidth: 1.5, strokeDasharray: "4 3" },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#f59e0b" },
            });
          }
        }
      }
    });
  });

  return { nodes, edges };
}
