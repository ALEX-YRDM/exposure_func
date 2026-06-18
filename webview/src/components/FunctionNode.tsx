import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import type { FunctionNode as FunctionNodeType } from '../types/callChain';

type LayoutDirection = 'TB' | 'LR' | 'BT' | 'RL';

interface FunctionNodeData {
  label: string;
  functionData: FunctionNodeType;
  isExpanded: boolean;
  hasChildren: boolean;
  direction?: LayoutDirection;
  onToggleExpand: (nodeId: string) => void;
  onNavigate: (file: string, line: number) => void;
  onExpandLeaf: (nodeId: string) => void;
}

const CATEGORY_STYLE: Record<string, { color: string; dashed: boolean; label: string }> = {
  project: { color: '#4a9eff', dashed: false, label: '' },
  third_party: { color: '#e0a458', dashed: true, label: '3rd' },
  stdlib: { color: '#9b8cce', dashed: true, label: 'std' },
  builtin: { color: '#777', dashed: true, label: 'blt' },
};

// Handle positions per layout direction: [target (incoming), source (outgoing)]
const HANDLE_POSITIONS: Record<LayoutDirection, [Position, Position]> = {
  TB: [Position.Top, Position.Bottom],
  BT: [Position.Bottom, Position.Top],
  LR: [Position.Left, Position.Right],
  RL: [Position.Right, Position.Left],
};

function FunctionNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as FunctionNodeData;
  const fn = nodeData.functionData;
  const isProject = fn.is_project;
  const cat = CATEGORY_STYLE[fn.category] || CATEGORY_STYLE.third_party;
  const [targetPos, sourcePos] = HANDLE_POSITIONS[nodeData.direction || 'TB'];
  const fileName = fn.file_path?.split('/').pop() || '';
  const lineInfo = fn.start_line
    ? fn.end_line
      ? `${fn.start_line}-${fn.end_line}`
      : `${fn.start_line}`
    : '';

  const [showParams, setShowParams] = useState(false);

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

  const handleParamToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowParams((v) => !v);
  };

  const hasParams = fn.params && fn.params.length > 0;

  return (
    <div
      className={`function-node ${fn.category}`}
      onDoubleClick={handleClick}
      style={{
        padding: '8px 12px',
        borderRadius: 8,
        border: `2px ${cat.dashed ? 'dashed' : 'solid'} ${cat.color}`,
        background: `var(--node-bg, ${isProject ? '#1e2a3a' : '#2a2a2a'})`,
        color: 'var(--node-text, #e0e0e0)',
        fontSize: 12,
        width: '100%',
        cursor: 'grab',
        position: 'relative',
      }}
    >
      <Handle type="target" position={targetPos} style={{ background: cat.color }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
          {cat.label && (
            <span
              style={{
                background: cat.color,
                color: '#1a1a1a',
                padding: '1px 5px',
                borderRadius: 4,
                fontSize: 9,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {cat.label}
            </span>
          )}
          {fn.class_name && (
            <span
              style={{
                background: 'var(--class-badge-bg, #6a5acd)',
                color: 'var(--class-badge-text, #fff)',
                padding: '1px 6px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {fn.class_name}
            </span>
          )}
          <span style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fn.name}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {hasParams && (
            <button
              onClick={handleParamToggle}
              title={showParams ? 'Hide parameters' : 'Show parameters'}
              style={btnStyle}
            >
              {showParams ? '⌃' : '⌄'}
            </button>
          )}
          {nodeData.hasChildren && (
            <button onClick={handleToggle} title="Expand/Collapse children" style={btnStyle}>
              {nodeData.isExpanded ? '−' : '+'}
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: 3, color: 'var(--node-meta, #888)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {fileName && <span>{fileName}</span>}
        {lineInfo && <span> : {lineInfo}</span>}
      </div>

      {showParams && fn.params && fn.params.length > 0 && (
        <div style={{
          marginTop: 6,
          padding: '4px 6px',
          background: 'var(--node-params-bg, rgba(0,0,0,0.3))',
          borderRadius: 4,
          fontSize: 10,
          fontFamily: 'monospace',
          maxHeight: 120,
          overflowY: 'auto',
        }}>
          {fn.params.map((p, i) => (
            <div key={i} style={{ padding: '1px 0', color: 'var(--node-param-text, #9cdcfe)' }}>
              <span style={{ color: 'var(--node-param-name, #c586c0)' }}>{p.name}</span>
              {p.annotation && <span style={{ color: 'var(--node-meta, #888)' }}>: {p.annotation}</span>}
              {p.default_value && <span style={{ color: 'var(--node-default, #6a9955)' }}> = {p.default_value}</span>}
            </div>
          ))}
        </div>
      )}

      <Handle type="source" position={sourcePos} style={{ background: cat.color }} />
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--btn-border, #555)',
  borderRadius: 4,
  color: 'var(--node-text, #ccc)',
  cursor: 'pointer',
  width: 20,
  height: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  lineHeight: 1,
};

export const FunctionNode = memo(FunctionNodeComponent);
