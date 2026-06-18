import React, { useRef, useState } from 'react';

interface TextTreeModalProps {
  text: string;
  onClose: () => void;
  onCopy: (text: string) => void;
}

export function TextTreeModal({ text, onClose, onCopy }: TextTreeModalProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    // Select the text so the user also gets a visual cue / manual fallback.
    textareaRef.current?.select();
    onCopy(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(720px, 90vw)',
          height: 'min(640px, 85vh)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--toolbar-bg, #252526)',
          border: '1px solid var(--toolbar-border, #333)',
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            borderBottom: '1px solid var(--toolbar-border, #333)',
            color: 'var(--text, #e0e0e0)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <span>Call Chain (text)</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button onClick={handleCopy} style={buttonStyle}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <button onClick={onClose} style={buttonStyle}>
              Close
            </button>
          </div>
        </div>
        <textarea
          ref={textareaRef}
          readOnly
          value={text}
          onFocus={(e) => e.currentTarget.select()}
          style={{
            flex: 1,
            resize: 'none',
            border: 'none',
            outline: 'none',
            padding: '12px',
            background: 'var(--bg, #1e1e1e)',
            color: 'var(--text, #e0e0e0)',
            fontFamily: 'var(--vscode-editor-font-family, monospace)',
            fontSize: 12,
            lineHeight: 1.5,
            whiteSpace: 'pre',
            overflow: 'auto',
          }}
        />
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  background: 'var(--select-bg, #3c3c3c)',
  color: 'var(--text, #e0e0e0)',
  border: '1px solid var(--toolbar-border, #555)',
  borderRadius: 4,
  padding: '3px 10px',
  fontSize: 11,
  cursor: 'pointer',
};
