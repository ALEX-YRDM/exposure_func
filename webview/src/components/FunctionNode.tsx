import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import type { FunctionNode as FunctionNodeType } from '../types/callChain';

interface FunctionNodeData {
  label: string;
  functionData: FunctionNodeType;
  isExpanded: boolean;
  hasChildren: boolean;
  onToggleExpand: (nodeId: string) => void;
  onNavigate: (file: string, line: number) => void;
  onExpandLeaf: (nodeId: string) => void;
}

function FunctionNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as FunctionNodeData;
  const fn = nodeData.functionData;
  const isProject = fn.is_project;
  const fileName = fn.file_path?.split('/').pop() || '';
  const lineInfo = fn.start_line
    ? fn.end_line
      ? `${fn.start_line}-${fn.end_line}`
      : `${fn.start_line}`
    : '';

  const handleClick = () => {
    if (fn.file_path && fn.start_line) {
      nodeData.onNavigate(fn.file_path, fn.start_line);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isProject && !nodeData.isExpanded) {
      nodeData.onExpandLeaf(fn.id);
    } else {
      nodeData.onToggleExpand(fn.id);
    }
  };

  return (
    <div
      className={`function-node ${isProject ? 'project' : 'third-party'}`}
      onClick={handleClick}
      style={{
        padding: '10px 14px',
        borderRadius: 8,
        border: isProject ? '2px solid #4a9eff' : '2px dashed #666',
        background: isProject ? '#1e2a3a' : '#2a2a2a',
        color: '#e0e0e0',
        fontSize: 12,
        minWidth: 220,
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#4a9eff' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {fn.class_name && (
            <span
              style={{
                background: '#6a5acd',
                padding: '1px 6px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              {fn.class_name}
            </span>
          )}
          <span style={{ fontWeight: 700, fontSize: 13 }}>{fn.name}</span>
        </div>
        {nodeData.hasChildren && (
          <button
            onClick={handleToggle}
            style={{
              background: 'transparent',
              border: '1px solid #555',
              borderRadius: 4,
              color: '#ccc',
              cursor: 'pointer',
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            {nodeData.isExpanded ? '−' : '+'}
          </button>
        )}
      </div>

      <div style={{ marginTop: 4, color: '#888', fontSize: 11 }}>
        {fileName && <span>{fileName}</span>}
        {lineInfo && <span> : {lineInfo}</span>}
      </div>

      <div style={{ marginTop: 2, color: '#6a9fc5', fontSize: 10, fontFamily: 'monospace' }}>
        {fn.signature}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: '#4a9eff' }} />
    </div>
  );
}

export const FunctionNode = memo(FunctionNodeComponent);
