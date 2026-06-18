import React, { useState, useCallback } from 'react';
import { BaseEdge, getSmoothStepPath, EdgeProps } from '@xyflow/react';
import { ArgTooltip } from './ArgTooltip';
import type { ArgMapping } from '../types/callChain';

interface CallEdgeData {
  arg_mappings: ArgMapping[];
  call_line: number;
}

export function CallEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
  markerEnd,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  });

  const edgeData = data as unknown as CallEdgeData | undefined;
  const mappings = edgeData?.arg_mappings || [];

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    setHovered(true);
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
  }, []);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: hovered ? '#4a9eff' : '#555',
          strokeWidth: hovered ? 2.5 : 1.5,
          transition: 'stroke 0.2s, stroke-width 0.2s',
        }}
      />
      {/* Wider invisible path for easier hover targeting */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: 'pointer' }}
      />
      <ArgTooltip
        mappings={mappings}
        x={mousePos.x}
        y={mousePos.y}
        visible={hovered}
      />
    </>
  );
}
