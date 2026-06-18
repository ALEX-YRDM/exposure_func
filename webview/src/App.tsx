import React, { useState, useCallback } from 'react';
import { CallChainGraph } from './components/CallChainGraph';
import { useVSCode } from './hooks/useVSCode';
import type { CallChainData, ExtensionMessage } from './types/callChain';

export function App() {
  const [data, setData] = useState<CallChainData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    }
  });

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

  if (loading) {
    return (
      <div style={centerStyle}>
        <div className="spinner" />
        <p style={{ marginTop: 16, color: '#888' }}>Analyzing call chain...</p>
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
        <p style={{ color: '#888' }}>
          Place your cursor on a Python function and click "Show Call Chain" to visualize its call graph.
        </p>
      </div>
    );
  }

  return (
    <CallChainGraph
      data={data}
      onNavigate={handleNavigate}
      onExpandLeaf={handleExpandLeaf}
    />
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
