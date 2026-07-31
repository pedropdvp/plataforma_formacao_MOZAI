"use client";

import React, { useMemo } from "react";
import ReactFlow, { Background, Controls, MiniMap, Node, Edge, MarkerType } from "reactflow";
import "reactflow/dist/style.css";

interface GraphSkillNode {
  id: string;
  label: string;
  score: number;
  type: string;
  level: string;
  connections: string[];
  daysSinceActivity: number | null;
}

interface SkillsGraphCanvasProps {
  nodes: GraphSkillNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// O texto de cada nó é sempre cinza muito claro (independente do tema claro/escuro da
// plataforma) — os retângulos de fundo são sempre escuros, pelo que qualquer variante de
// azul/cinza escuro (como o "Bloqueado" tinha antes) fica ilegível sobre eles.
const NODE_TEXT_COLOR = "#e2e8f0";

const LEVEL_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  Bloqueado: { border: "#1e293b", bg: "#0b1120", text: NODE_TEXT_COLOR },
  Iniciado: { border: "#78350f", bg: "#0f1524", text: NODE_TEXT_COLOR },
  Básico: { border: "#164e63", bg: "#0f1524", text: NODE_TEXT_COLOR },
  Intermédio: { border: "#3730a3", bg: "#0f1524", text: NODE_TEXT_COLOR },
  Avançado: { border: "#065f46", bg: "#0f1524", text: NODE_TEXT_COLOR },
};

/**
 * Grafo de Competências real, renderizado com nós e arestas verdadeiros (ReactFlow) —
 * antes o campo "connections" existia nos dados mas era mostrado como uma lista de
 * badges de texto ("Requisito para: x, y"), nunca como um grafo visual navegável.
 */
export function SkillsGraphCanvas({ nodes, selectedId, onSelect }: SkillsGraphCanvasProps) {
  const { flowNodes, flowEdges } = useMemo(() => buildSkillsGraph(nodes, selectedId), [nodes, selectedId]);

  return (
    <div className="h-[500px] rounded-2xl border border-slate-900 overflow-hidden bg-slate-950/40">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodeClick={(_, node) => onSelect(node.id)}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
      >
        <Background color="#1e293b" gap={20} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => LEVEL_COLORS[(n.data as any)?.level as string]?.text || "#6366f1"}
          maskColor="rgba(2,6,23,0.7)"
          style={{ background: "#0f172a" }}
        />
      </ReactFlow>
    </div>
  );
}

function buildSkillsGraph(
  nodes: GraphSkillNode[],
  selectedId: string | null
): { flowNodes: Node[]; flowEdges: Edge[] } {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Um nó é "raiz" de cadeia se nenhum outro nó o lista como conexão (dependência de saída).
  const targeted = new Set(nodes.flatMap((n) => n.connections));
  const roots = nodes.filter((n) => !targeted.has(n.id));

  const depthOf = new Map<string, number>();
  const laneOf = new Map<string, number>();
  let lane = 0;

  const visit = (id: string, depth: number, currentLane: number, visited: Set<string>) => {
    if (visited.has(id)) return;
    visited.add(id);
    depthOf.set(id, depth);
    laneOf.set(id, currentLane);
    const node = byId.get(id);
    (node?.connections || []).forEach((childId) => {
      if (byId.has(childId)) visit(childId, depth + 1, currentLane, visited);
    });
  };

  const visited = new Set<string>();
  roots.forEach((root) => {
    if (visited.has(root.id)) return;
    visit(root.id, 0, lane, visited);
    lane++;
  });
  // Segurança: qualquer nó não alcançado (ciclo improvável) ganha a sua própria linha.
  nodes.forEach((n) => {
    if (!visited.has(n.id)) {
      visit(n.id, 0, lane, visited);
      lane++;
    }
  });

  const flowNodes: Node[] = nodes.map((n) => {
    const colors = LEVEL_COLORS[n.level] || LEVEL_COLORS.Bloqueado;
    const isSelected = n.id === selectedId;
    const isDecaying = n.daysSinceActivity !== null && n.daysSinceActivity > 30 && n.score > 0;

    return {
      id: n.id,
      position: { x: (depthOf.get(n.id) || 0) * 220, y: (laneOf.get(n.id) || 0) * 100 },
      data: { label: `${n.label} — ${n.score}%`, level: n.level },
      style: {
        background: colors.bg,
        color: isSelected ? "#ffffff" : colors.text,
        border: `1.5px solid ${isSelected ? "#6366f1" : colors.border}`,
        borderStyle: isDecaying ? "dashed" : "solid",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 700,
        padding: "8px 12px",
        width: 190,
        boxShadow: isSelected ? "0 0 0 3px rgba(99,102,241,0.25)" : "none",
        cursor: "pointer",
      },
    };
  });

  const flowEdges: Edge[] = nodes.flatMap((n) =>
    n.connections
      .filter((targetId) => byId.has(targetId))
      .map((targetId) => {
        const targetNode = byId.get(targetId)!;
        const unlocked = n.score > 0 && targetNode.score > 0;
        return {
          id: `${n.id}-${targetId}`,
          source: n.id,
          target: targetId,
          animated: unlocked,
          style: { stroke: unlocked ? "#6366f1" : "#334155", strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: unlocked ? "#6366f1" : "#334155" },
        };
      })
  );

  return { flowNodes, flowEdges };
}
