export interface ParamInfo {
  name: string;
  default_value: string | null;
  annotation: string | null;
  kind: 'POSITIONAL_OR_KEYWORD' | 'KEYWORD_ONLY' | 'VAR_POSITIONAL' | 'VAR_KEYWORD' | string;
}

export type NodeCategory = 'project' | 'third_party' | 'stdlib' | 'builtin';

export interface FunctionNode {
  id: string;
  name: string;
  qualified_name: string;
  class_name: string | null;
  file_path: string | null;
  start_line: number | null;
  end_line: number | null;
  is_project: boolean;
  category: NodeCategory;
  signature: string;
  params: ParamInfo[];
}

export interface ArgMapping {
  param_name: string;
  arg_expr: string;
  arg_type: 'positional' | 'keyword' | 'star' | 'doublestar';
  default_value: string | null;
}

export interface CallEdge {
  id: string;
  source: string;
  target: string;
  call_line: number;
  call_col: number;
  arg_mappings: ArgMapping[];
}

export interface CallChainData {
  root: string;
  nodes: FunctionNode[];
  edges: CallEdge[];
}

export interface HistoryEntry {
  key: string;
  file: string;
  line: number;
  col: number;
  label: string;
}

export type ExtensionMessage =
  | { type: 'update'; data: CallChainData }
  | { type: 'loading' }
  | { type: 'error'; message: string }
  | { type: 'history'; history: HistoryEntry[] };

export type WebviewMessage =
  | { type: 'navigateTo'; file: string; line: number }
  | { type: 'expandNode'; nodeId: string }
  | { type: 'exportImage'; format: 'png' | 'svg'; dataUrl: string }
  | { type: 'exportError'; message: string }
  | { type: 'copyToClipboard'; text: string }
  | { type: 'loadFromHistory'; file: string; line: number; col: number }
  | { type: 'popOut' }
  | { type: 'ready' };
