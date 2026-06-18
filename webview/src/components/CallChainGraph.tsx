import React, { useMemo, useState, useCallback } from 'react';
import {
  ReactFlow,
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { FunctionNode } from './FunctionNode';
import { CallEdge } from './CallEdge';
import { applyDagreLayout } from '../layout/dagre';
import type { CallChainData, FunctionNode as FNType } from '../types/callChain';

interface CallChainGraphProps {
  data: CallChainData;
  maxDepth: number;
  visibleCategories: Set<string>;
  onNavigate: (file: string, line: number) => void;
  onExpandLeaf: (nodeId: string) => void;
}

const nodeTypes: NodeTypes = {
  functionNode: FunctionNode as any,
};

const edgeTypes: EdgeTypes = {
  callEdge: CallEdge as any,
};

export function CallChainGraph({ data, maxDepth, visibleCategories, onNavigate, onExpandLeaf }: CallChainGraphProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

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
        const parentVisible = data.edges.some(
          (e) => e.target === id && (expandedNodes.has(e.source) || depths.get(e.source)! < maxDepth)
        );
        if (depth <= maxDepth) {
          visibleNodeIds.add(id);
        }
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
      ranksep: 90,
      nodesep: 50,
    });
    return { layoutNodes: ln, layoutEdges: le };
  }, [data, maxDepth, visibleCategories, expandedNodes, handleToggleExpand, onNavigate, onExpandLeaf]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  React.useEffect(() => {
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [layoutNodes, layoutEdges, setNodes, setEdges]);

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
