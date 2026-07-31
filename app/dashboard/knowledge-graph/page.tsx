"use client";

import React, { useEffect, useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap, Node, Edge, MarkerType } from "reactflow";
import "reactflow/dist/style.css";
import { Share2, Loader2, RefreshCw, Info } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { useAccess } from "@/hooks/use-access";

interface KgNode {
  id: string;
  name: string;
  sourceCourseTitles: string[];
}
interface KgEdge {
  from: string;
  to: string;
}

export default function KnowledgeGraphPage() {
  const { showToast } = useToast();
  const { activeRole } = useAccess();
  const isModerator = activeRole === "ADMIN" || activeRole === "SUPORTE";

  const [nodes, setNodes] = useState<KgNode[]>([]);
  const [edges, setEdges] = useState<KgEdge[]>([]);
  const [stats, setStats] = useState<{ totalCourses: number; indexedCourses: number; pendingCourses: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [reindexing, setReindexing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/knowledge-graph");
      const data = await res.json();
      if (res.ok) {
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
        setStats({ totalCourses: data.totalCourses, indexedCourses: data.indexedCourses, pendingCourses: data.pendingCourses });
      }
    } catch {
      showToast("Erro ao carregar o Knowledge Graph.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReindex = async () => {
    setReindexing(true);
    try {
      const res = await fetch("/api/knowledge-graph", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast(`${data.processed} curso(s) indexado(s) com conceitos reais.`, "success");
        load();
      } else {
        showToast(data.error || "Erro ao reindexar.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao reindexar.", "error");
    } finally {
      setReindexing(false);
    }
  };

  const { flowNodes, flowEdges } = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.name, n]));
    const cols = Math.ceil(Math.sqrt(nodes.length || 1));
    const fn: Node[] = nodes.map((n, i) => ({
      id: n.name,
      position: { x: (i % cols) * 220, y: Math.floor(i / cols) * 120 },
      data: { label: n.name },
      style: {
        background: "#0f1524",
        border: "1px solid #3730a3",
        borderRadius: 12,
        color: "#818cf8",
        fontSize: 11,
        fontWeight: 700,
        padding: 10,
        width: 180,
      },
    }));
    const fe: Edge[] = edges
      .filter((e) => byId.has(e.from) && byId.has(e.to))
      .map((e, i) => ({
        id: `e-${i}`,
        source: e.from,
        target: e.to,
        animated: false,
        style: { stroke: "#334155" },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#334155" },
      }));
    return { flowNodes: fn, flowEdges: fe };
  }, [nodes, edges]);

  return (
    <div className="space-y-8 workspace-page-container">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Share2 className="h-6 w-6 text-indigo-400" />
            Knowledge Graph
          </h1>
          <p className="text-sm text-slate-400">Grafo real de conceitos, extraído por IA do conteúdo dos cursos publicados.</p>
        </div>
        {isModerator && (
          <button onClick={handleReindex} disabled={reindexing} className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-55">
            {reindexing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Reindexar (até 5 cursos)
          </button>
        )}
      </div>

      <div className="border border-amber-500/20 bg-amber-500/5 rounded-2xl p-4 flex items-start gap-2.5">
        <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-200 leading-relaxed">
          <strong>Nota de âmbito:</strong> este NÃO é um grafo mundial com milhões de conceitos
          (isso exigiria uma base como a Wikidata, fora de âmbito) — é um grafo real que cresce a
          partir do conteúdo genuíno dos cursos desta plataforma, um curso de cada vez.
          {stats && ` ${stats.indexedCourses}/${stats.totalCourses} cursos indexados.`}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 text-indigo-500 animate-spin" /></div>
      ) : nodes.length === 0 ? (
        <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-12 text-center">
          <span className="text-sm text-slate-500 italic">Ainda sem conceitos indexados — {isModerator ? "clique em Reindexar." : "peça a um administrador para reindexar."}</span>
        </div>
      ) : (
        <div className="h-[560px] rounded-2xl border border-slate-900 overflow-hidden bg-slate-950/40">
          <ReactFlow nodes={flowNodes} edges={flowEdges} fitView proOptions={{ hideAttribution: true }} nodesDraggable={false}>
            <Background color="#1e293b" gap={20} />
            <Controls />
            <MiniMap pannable zoomable style={{ background: "#0b1120" }} />
          </ReactFlow>
        </div>
      )}
    </div>
  );
}
