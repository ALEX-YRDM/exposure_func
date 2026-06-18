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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { FunctionNode } from './FunctionNode';
import { CallEdge } from './CallEdge';
import { applyDagreLayout } from '../layout/dagre';
import type { CallChainData, FunctionNode as FNType } from '../types/callChain';

interface CallChainGraphProps {
  data: CallChainData;
  onNavigate: (file: string, line: number) => void;
  onExpandLeaf: (nodeId: string) => void;
}

const nodeTypes: NodeTypes = {
  functionNode: FunctionNode as any,
};

const edgeTypes: EdgeTypes = {
  callEdge: CallEdge as any,
};

const DEFAULT_VISIBLE_DEPTH = 2;

export function CallChainGraph({ data, onNavigate, onExpandLeaf }: CallChainGraphProps) {
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

  const { nodes, edges } = useMemo(() => {
    if (!data || !data.nodes.length) {
      return { nodes: [], edges: [] };
    }

    const nodeMap = new Map<string, FNType>();
    data.nodes.forEach((n) => nodeMap.set(n.id, n));

    const childrenMap = new Map<string, string[]>();
    data.edges.forEach((e) => {
      const children = childrenMap.get(e.source) || [];
      children.push(e.target);
      childrenMap.set(e.source, children);
    });

    const depths = new Map<string, number>();
    const computeDepth = (id: string, depth: number) => {
      if (depths.has(id) && depths.get(id)! <= depth) return;
      depths.set(id, depth);
      const children = childrenMap.get(id) || [];
      children.forEach((c) => computeDepth(c, depth + 1));
    };
    computeDepth(data.root, 0);

    const visibleNodeIds = new Set<string>();
    depths.forEach((depth, id) => {
      const parentExpanded = data.edges.some(
        (e) => e.target === id && expandedNodes.has(e.source)
      );
      if (depth <= DEFAULT_VISIBLE_DEPTH || parentExpanded || expandedNodes.has(id)) {
        visibleNodeIds.add(id);
      }
    });
    visibleNodeIds.add(data.root);

    const flowNodes: Node[] = [];
    visibleNodeIds.forEach((id) => {
      const fn = nodeMap.get(id);
      if (!fn) return;
      const hasChildren = (childrenMap.get(id) || []).length > 0;
      flowNodes.push({
        id,
        type: 'functionNode',
        position: { x: 0, y: 0 },
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

    const flowEdges: Edge[] = data.edges
      .filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'callEdge',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#555' },
        data: {
          arg_mappings: e.arg_mappings,
          call_line: e.call_line,
        },
      }));

    return applyDagreLayout(flowNodes, flowEdges);
  }, [data, expandedNodes, handleToggleExpand, onNavigate, onExpandLeaf]);

  if (!data || !data.nodes.length) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
        No call chain data to display.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'callEdge',
          animated: false,
        }}
      >
        <Background color="#333" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const fn = (n.data as any)?.functionData;
            return fn?.is_project ? '#4a9eff' : '#666';
          }}
          style={{ background: '#1a1a1a' }}
        />
      </ReactFlow>
    </div>
  );
}
