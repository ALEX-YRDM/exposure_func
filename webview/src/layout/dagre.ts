import dagre from 'dagre';
import { Node, Edge } from '@xyflow/react';

export interface LayoutOptions {
  rankdir?: 'TB' | 'BT' | 'LR' | 'RL';
  ranksep?: number;
  nodesep?: number;
  defaultNodeHeight?: number;
}

export function estimateNodeWidth(node: Node): number {
  const data = node.data as any;
  const fn = data?.functionData;
  if (!fn) return 200;

  const nameLen = (fn.name || '').length;
  const classLen = fn.class_name ? fn.class_name.length + 3 : 0;
  const textLen = nameLen + classLen;

  return Math.max(180, Math.min(400, textLen * 9 + 80));
}

export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } {
  const {
    rankdir = 'TB',
    ranksep = 90,
    nodesep = 50,
    defaultNodeHeight = 70,
  } = options;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir, ranksep, nodesep });

  const widths = new Map<string, number>();
  nodes.forEach((node) => {
    const w = estimateNodeWidth(node);
    widths.set(node.id, w);
    g.setNode(node.id, { width: w, height: defaultNodeHeight });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    const w = widths.get(node.id) || 200;
    return {
      ...node,
      position: {
        x: pos.x - w / 2,
        y: pos.y - defaultNodeHeight / 2,
      },
      style: { ...((node.style as any) || {}), width: w },
    };
  });

  return { nodes: layoutedNodes, edges };
}
