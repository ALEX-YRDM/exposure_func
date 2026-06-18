import React, { useState } from 'react';
import type { HistoryEntry } from '../types/callChain';

interface HistoryPanelProps {
  history: HistoryEntry[];
  currentKey: string | null;
  onSelect: (entry: HistoryEntry) => void;
}

export function HistoryPanel({ history, currentKey, onSelect }: HistoryPanelProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (entry: HistoryEntry) => {
    onSelect(entry);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={history.length === 0}
        title="Recently viewed functions"
        style={{
          ...buttonStyle,
          opacity: history.length === 0 ? 0.5 : 1,
          cursor: history.length === 0 ? 'default' : 'pointer',
        }}
      >
        History ({history.length}) {open ? '▴' : '▾'}
      </button>

      {open && history.length > 0 && (
        <>
          {/* click-away layer */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 50 }}
          />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              minWidth: 260,
              maxHeight: 320,
              overflowY: 'auto',
              background: 'var(--toolbar-bg, #252526)',
              border: '1px solid var(--toolbar-border, #333)',
              borderRadius: 6,
              boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
              zIndex: 51,
              padding: 4,
            }}
          >
            {history.map((entry) => {
              const fileName = entry.file.split('/').pop() || entry.file;
              const isCurrent = entry.key === currentKey;
              return (
                <div
                  key={entry.key}
                  onClick={() => handleSelect(entry)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    background: isCurrent ? 'var(--select-bg, #094771)' : 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrent) e.currentTarget.style.background = 'var(--select-bg, #2a2d2e)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrent) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text, #e0e0e0)' }}>
                    {entry.label}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted, #888)' }}>
                    {fileName}:{entry.line}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  background: 'var(--select-bg)',
  color: 'var(--text)',
  border: '1px solid var(--toolbar-border)',
  borderRadius: 4,
  padding: '3px 10px',
  fontSize: 11,
};
