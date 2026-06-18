import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { CallChainGraph } from './components/CallChainGraph';
import { TextTreeModal } from './components/TextTreeModal';
import { HistoryPanel } from './components/HistoryPanel';
import { buildCallTree } from './utils/textTree';
import { useVSCode } from './hooks/useVSCode';
import type { CallChainData, ExtensionMessage, NodeCategory, HistoryEntry } from './types/callChain';

type Theme = 'dark' | 'light' | 'auto';
type CategoryFilter = 'project' | 'with_third_party' | 'all';
export type LayoutDirection = 'TB' | 'LR' | 'BT' | 'RL';
export type ExportFormat = 'png' | 'svg';
export type ExportFn = (format: ExportFormat) => void;

const CATEGORY_PRESETS: Record<CategoryFilter, NodeCategory[]> = {
  project: ['project'],
  with_third_party: ['project', 'third_party'],
  all: ['project', 'third_party', 'stdlib', 'builtin'],
};

export function App() {
  const [data, setData] = useState<CallChainData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maxDepth, setMaxDepth] = useState(3);
  const [theme, setTheme] = useState<Theme>('auto');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('with_third_party');
  const [direction, setDirection] = useState<LayoutDirection>('TB');
  const [showText, setShowText] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const exportRef = useRef<ExportFn | null>(null);

  const visibleCategories = useMemo(
    () => new Set<string>(CATEGORY_PRESETS[categoryFilter]),
    [categoryFilter]
  );

  const { postMessage } = useVSCode((msg: ExtensionMessage) => {
    switch (msg.type) {
      case 'update':
        setData(msg.data);
        setLoading(false);
        setError(null);
        break;
      case 'loading':
        setLoading(true);
        setError(null);
        break;
      case 'error':
        setError(msg.message);
        setLoading(false);
        break;
      case 'history':
        setHistory(msg.history);
        break;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);

  const handleNavigate = useCallback(
    (file: string, line: number) => {
      postMessage({ type: 'navigateTo', file, line });
    },
    [postMessage]
  );

  const handleExpandLeaf = useCallback(
    (nodeId: string) => {
      postMessage({ type: 'expandNode', nodeId });
    },
    [postMessage]
  );

  const handleExportImage = useCallback(
    (format: ExportFormat, dataUrl: string) => {
      postMessage({ type: 'exportImage', format, dataUrl });
    },
    [postMessage]
  );

  const handleExportError = useCallback(
    (message: string) => {
      postMessage({ type: 'exportError', message });
    },
    [postMessage]
  );

  const handleCopyText = useCallback(
    (text: string) => {
      postMessage({ type: 'copyToClipboard', text });
    },
    [postMessage]
  );

  const handleLoadHistory = useCallback(
    (entry: HistoryEntry) => {
      postMessage({ type: 'loadFromHistory', file: entry.file, line: entry.line, col: entry.col });
    },
    [postMessage]
  );

  const handlePopOut = useCallback(() => {
    postMessage({ type: 'popOut' });
  }, [postMessage]);

  const treeText = useMemo(
    () => (data ? buildCallTree(data, maxDepth, visibleCategories) : ''),
    [data, maxDepth, visibleCategories]
  );

  if (loading) {
    return (
      <div style={centerStyle}>
        <div className="spinner" />
        <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>Analyzing call chain...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={centerStyle}>
        <p style={{ color: '#f44747' }}>Error: {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={centerStyle}>
        <p style={{ color: 'var(--text-muted)' }}>
          Place your cursor on a Python function and click "Show Call Chain" to visualize its call graph.
        </p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Toolbar
        maxDepth={maxDepth}
        onMaxDepthChange={setMaxDepth}
        theme={theme}
        onThemeChange={setTheme}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        direction={direction}
        onDirectionChange={setDirection}
        onExport={(fmt) => exportRef.current?.(fmt)}
        onShowText={() => setShowText(true)}
        onPopOut={handlePopOut}
        history={history}
        onLoadHistory={handleLoadHistory}
        nodeCount={data.nodes.length}
        edgeCount={data.edges.length}
      />
      <div style={{ flex: 1, minHeight: 0 }}>
        <CallChainGraph
          data={data}
          maxDepth={maxDepth}
          visibleCategories={visibleCategories}
          direction={direction}
          exportRef={exportRef}
          onNavigate={handleNavigate}
          onExpandLeaf={handleExpandLeaf}
          onExportImage={handleExportImage}
          onExportError={handleExportError}
        />
      </div>
      {showText && (
        <TextTreeModal
          text={treeText}
          onClose={() => setShowText(false)}
          onCopy={handleCopyText}
        />
      )}
    </div>
  );
}

interface ToolbarProps {
  maxDepth: number;
  onMaxDepthChange: (v: number) => void;
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  categoryFilter: CategoryFilter;
  onCategoryFilterChange: (f: CategoryFilter) => void;
  direction: LayoutDirection;
  onDirectionChange: (d: LayoutDirection) => void;
  onExport: (format: ExportFormat) => void;
  onShowText: () => void;
  onPopOut: () => void;
  history: HistoryEntry[];
  onLoadHistory: (entry: HistoryEntry) => void;
  nodeCount: number;
  edgeCount: number;
}

function Toolbar({
  maxDepth,
  onMaxDepthChange,
  theme,
  onThemeChange,
  categoryFilter,
  onCategoryFilterChange,
  direction,
  onDirectionChange,
  onExport,
  onShowText,
  onPopOut,
  history,
  onLoadHistory,
  nodeCount,
  edgeCount,
}: ToolbarProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '6px 12px',
      background: 'var(--toolbar-bg)',
      borderBottom: '1px solid var(--toolbar-border)',
      fontSize: 12,
      color: 'var(--text)',
      flexShrink: 0,
    }}>
      <HistoryPanel
        history={history}
        currentKey={history[0]?.key ?? null}
        onSelect={onLoadHistory}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label>Depth:</label>
        <input
          type="range"
          min={1}
          max={10}
          value={maxDepth}
          onChange={(e) => onMaxDepthChange(Number(e.target.value))}
          style={{ width: 80, cursor: 'pointer' }}
        />
        <span style={{ minWidth: 16, textAlign: 'center' }}>{maxDepth}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label>Show:</label>
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryFilterChange(e.target.value as CategoryFilter)}
          style={selectStyle}
        >
          <option value="project">Project only</option>
          <option value="with_third_party">Project + Third-party</option>
          <option value="all">All (incl. stdlib/builtin)</option>
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label>Layout:</label>
        <select
          value={direction}
          onChange={(e) => onDirectionChange(e.target.value as LayoutDirection)}
          style={selectStyle}
        >
          <option value="TB">Top → Bottom</option>
          <option value="LR">Left → Right</option>
          <option value="BT">Bottom → Top</option>
          <option value="RL">Right → Left</option>
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label>Theme:</label>
        <select
          value={theme}
          onChange={(e) => onThemeChange(e.target.value as Theme)}
          style={selectStyle}
        >
          <option value="auto">Auto (VSCode)</option>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button onClick={onPopOut} style={buttonStyle} title="Move this view into a separate window">
          ↗ Window
        </button>
        <button onClick={onShowText} style={buttonStyle} title="View call chain as copyable text">
          Text
        </button>
        <button onClick={() => onExport('png')} style={buttonStyle} title="Export as PNG">
          Export PNG
        </button>
        <button onClick={() => onExport('svg')} style={buttonStyle} title="Export as SVG">
          SVG
        </button>
      </div>

      <div style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 11 }}>
        {nodeCount} nodes · {edgeCount} edges
      </div>
    </div>
  );
}

const centerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  padding: 40,
};

const selectStyle: React.CSSProperties = {
  background: 'var(--select-bg)',
  color: 'var(--text)',
  border: '1px solid var(--toolbar-border)',
  borderRadius: 4,
  padding: '2px 6px',
  fontSize: 11,
};

const buttonStyle: React.CSSProperties = {
  background: 'var(--select-bg)',
  color: 'var(--text)',
  border: '1px solid var(--toolbar-border)',
  borderRadius: 4,
  padding: '3px 8px',
  fontSize: 11,
  cursor: 'pointer',
};
