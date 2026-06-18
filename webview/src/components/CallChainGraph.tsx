import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  MarkerType,
  NodeTypes,
  EdgeTypes,
  useNodesState,
  useEdgesState,
  useReactFlow,
  getNodesBounds,
  getViewportForBounds,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng, toSvg } from 'html-to-image';

import { FunctionNode } from './FunctionNode';
import { CallEdge } from './CallEdge';
import { applyDagreLayout } from '../layout/dagre';
import type { CallChainData, FunctionNode as FNType } from '../types/callChain';

type LayoutDirection = 'TB' | 'LR' | 'BT' | 'RL';
type ExportFormat = 'png' | 'svg';
type ExportFn = (format: ExportFormat) => void;

interface CallChainGraphProps {
  data: CallChainData;
  maxDepth: number;
  visibleCategories: Set<string>;
  direction: LayoutDirection;
  exportRef: React.MutableRefObject<ExportFn | null>;
  onNavigate: (file: string, line: number) => void;
  onExpandLeaf: (nodeId: string) => void;
  onExportImage: (format: ExportFormat, dataUrl: string) => void;
  onExportError: (message: string) => void;
}

const nodeTypes: NodeTypes = {
  functionNode: FunctionNode as any,
};

const edgeTypes: EdgeTypes = {
  callEdge: CallEdge as any,
};

export function CallChainGraph(props: CallChainGraphProps) {
  return (
    <ReactFlowProvider>
      <CallChainGraphInner {...props} />
    </ReactFlowProvider>
  );
}

function CallChainGraphInner({
  data,
  maxDepth,
  visibleCategories,
  direction,
  exportRef,
  onNavigate,
  onExpandLeaf,
  onExportImage,
  onExportError,
}: CallChainGraphProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const { getNodes } = useReactFlow();
  const exportingRef = React.useRef(false);

  const handleToggleExpand = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const { layoutNodes, layoutEdges } = useMemo(() => {
    if (!data || !data.nodes.length) {
      return { layoutNodes: [], layoutEdges: [] };
    }

    const nodeMap = new Map<string, FNType>();
    data.nodes.forEach((n) => nodeMap.set(n.id, n));

    const childrenMap = new Map<string, string[]>();
    data.edges.forEach((e) => {
      const children = childrenMap.get(e.source) || [];
      if (!children.includes(e.target)) {
        children.push(e.target);
      }
      childrenMap.set(e.source, children);
    });

    const depths = new Map<string, number>();
    const computeDepth = (id: string, depth: number, visited: Set<string>) => {
      if (visited.has(id)) return;
      visited.add(id);
      if (!depths.has(id) || depth < depths.get(id)!) {
        depths.set(id, depth);
      }
      const children = childrenMap.get(id) || [];
      children.forEach((c) => computeDepth(c, depth + 1, visited));
    };
    computeDepth(data.root, 0, new Set());

    const visibleNodeIds = new Set<string>();
    visibleNodeIds.add(data.root);
    depths.forEach((depth, id) => {
      if (depth <= maxDepth) {
        visibleNodeIds.add(id);
      }
      if (expandedNodes.has(id)) {
        const children = childrenMap.get(id) || [];
        children.forEach((c) => visibleNodeIds.add(c));
      }
    });

    const flowNodes: Node[] = [];
    visibleNodeIds.forEach((id) => {
      const fn = nodeMap.get(id);
      if (!fn) return;
      // Category filter — always keep the root node visible
      if (id !== data.root && !visibleCategories.has(fn.category)) return;
      const hasChildren = (childrenMap.get(id) || []).length > 0;
      flowNodes.push({
        id,
        type: 'functionNode',
        position: { x: 0, y: 0 },
        draggable: true,
        data: {
          label: fn.name,
          functionData: fn,
          isExpanded: expandedNodes.has(id),
          hasChildren,
          direction,
          onToggleExpand: handleToggleExpand,
          onNavigate,
          onExpandLeaf,
        },
      });
    });

    const renderedIds = new Set(flowNodes.map((n) => n.id));
    const flowEdges: Edge[] = data.edges
      .filter((e) => renderedIds.has(e.source) && renderedIds.has(e.target))
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'callEdge',
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--edge-color, #555)' },
        data: {
          arg_mappings: e.arg_mappings,
          call_line: e.call_line,
        },
      }));

    const { nodes: ln, edges: le } = applyDagreLayout(flowNodes, flowEdges, {
      rankdir: direction,
      ranksep: 90,
      nodesep: 50,
    });
    return { layoutNodes: ln, layoutEdges: le };
  }, [data, maxDepth, visibleCategories, direction, expandedNodes, handleToggleExpand, onNavigate, onExpandLeaf]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  useEffect(() => {
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [layoutNodes, layoutEdges, setNodes, setEdges]);

  // Register the export handler so the toolbar can trigger it.
  useEffect(() => {
    exportRef.current = (format: ExportFormat) => {
      if (exportingRef.current) return; // guard against re-entrancy
      exportingRef.current = true;
      exportImage(format, getNodes())
        .then((dataUrl) => {
          if (dataUrl) onExportImage(format, dataUrl);
        })
        .catch((err) => onExportError(String(err?.message || err)))
        .finally(() => {
          exportingRef.current = false;
        });
    };
    return () => {
      exportRef.current = null;
    };
  }, [exportRef, getNodes, onExportImage, onExportError]);

  if (!data || !data.nodes.length) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted, #888)' }}>
        No call chain data to display.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={2.5}
        nodesDraggable={true}
        panOnDrag={true}
        zoomOnScroll={true}
        defaultEdgeOptions={{
          type: 'callEdge',
          animated: false,
        }}
      >
        <Background color="var(--grid-color, #333)" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const fn = (n.data as any)?.functionData;
            return fn?.is_project ? 'var(--accent, #4a9eff)' : 'var(--node-border-color, #666)';
          }}
          style={{ background: 'var(--minimap-bg, #1a1a1a)' }}
        />
      </ReactFlow>
    </div>
  );
}

const EXPORT_PADDING = 0.1;
const IMG_BG = () =>
  getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#1e1e1e';

async function exportImage(format: ExportFormat, allNodes: Node[]): Promise<string> {
  const viewport = document.querySelector('.react-flow__viewport') as HTMLElement | null;
  if (!viewport || allNodes.length === 0) {
    throw new Error('Nothing to export.');
  }

  const bounds = getNodesBounds(allNodes);
  const padX = bounds.width * EXPORT_PADDING;
  const padY = bounds.height * EXPORT_PADDING;
  const imageWidth = Math.ceil(bounds.width + padX * 2);
  const imageHeight = Math.ceil(bounds.height + padY * 2);

  const transform = getViewportForBounds(
    bounds,
    imageWidth,
    imageHeight,
    0.5,
    2,
    EXPORT_PADDING
  );

  const options = {
    backgroundColor: IMG_BG(),
    width: imageWidth,
    height: imageHeight,
    style: {
      width: `${imageWidth}px`,
      height: `${imageHeight}px`,
      transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
    },
  };

  const generator = format === 'png' ? toPng : toSvg;
  return generator(viewport, options as any);
}
