import React from 'react';
import type { ArgMapping } from '../types/callChain';

interface ArgTooltipProps {
  mappings: ArgMapping[];
  x: number;
  y: number;
  visible: boolean;
}

export function ArgTooltip({ mappings, x, y, visible }: ArgTooltipProps) {
  if (!visible || mappings.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: x + 10,
        top: y - 10,
        background: '#1e1e1e',
        border: '1px solid #444',
        borderRadius: 6,
        padding: '8px 12px',
        zIndex: 9999,
        fontSize: 11,
        fontFamily: 'monospace',
        color: '#e0e0e0',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        maxWidth: 400,
        pointerEvents: 'none',
      }}
    >
      <div style={{ marginBottom: 4, fontWeight: 600, color: '#4a9eff', fontSize: 10 }}>
        Arguments → Parameters
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #333' }}>
            <th style={{ textAlign: 'left', padding: '2px 8px 2px 0', color: '#888' }}>Param</th>
            <th style={{ textAlign: 'left', padding: '2px 8px', color: '#888' }}>Value</th>
            <th style={{ textAlign: 'left', padding: '2px 0', color: '#888' }}>Type</th>
          </tr>
        </thead>
        <tbody>
          {mappings.map((m, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #2a2a2a' }}>
              <td style={{ padding: '3px 8px 3px 0', color: '#c586c0' }}>{m.param_name}</td>
              <td style={{ padding: '3px 8px', color: m.default_value ? '#6a9955' : '#ce9178' }}>
                {m.arg_expr}
                {m.default_value && (
                  <span style={{ color: '#6a9955', marginLeft: 4 }}>
                    (default: {m.default_value})
                  </span>
                )}
              </td>
              <td style={{ padding: '3px 0', color: '#569cd6', fontSize: 10 }}>{m.arg_type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
