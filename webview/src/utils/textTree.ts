import type { CallChainData, FunctionNode } from '../types/callChain';

interface ChildLink {
  target: string;
  call_line: number;
}

/**
 * Render the call chain as an indented text tree, following the same
 * depth + category filters used by the graph.
 *
 * Example:
 *   MyClass.process
 *     - validate
 *     - Loader.load
 *       - read_file
 */
export function buildCallTree(
  data: CallChainData,
  maxDepth: number,
  visibleCategories: Set<string>
): string {
  if (!data || !data.nodes.length) {
    return '';
  }

  const nodeMap = new Map<string, FunctionNode>();
  data.nodes.forEach((n) => nodeMap.set(n.id, n));

  // Children in execution order (sorted by call line).
  const childrenMap = new Map<string, ChildLink[]>();
  data.edges.forEach((e) => {
    const list = childrenMap.get(e.source) || [];
    list.push({ target: e.target, call_line: e.call_line });
    childrenMap.set(e.source, list);
  });
  childrenMap.forEach((list) => list.sort((a, b) => a.call_line - b.call_line));

  const label = (node: FunctionNode): string =>
    node.class_name ? `${node.class_name}.${node.name}` : node.name;

  const lines: string[] = [];

  const dfs = (id: string, depth: number, path: Set<string>) => {
    const node = nodeMap.get(id);
    if (!node) return;

    const indent = depth === 0 ? '' : '  '.repeat(depth - 1) + '  - ';
    const recursion = path.has(id);
    lines.push(`${indent}${label(node)}${recursion ? '  (↺ recursion)' : ''}`);

    if (recursion || depth >= maxDepth) {
      return;
    }

    const nextPath = new Set(path);
    nextPath.add(id);

    const children = childrenMap.get(id) || [];
    // De-duplicate repeated calls to the same target at this level while
    // preserving first-call order.
    const seen = new Set<string>();
    for (const child of children) {
      if (seen.has(child.target)) continue;
      seen.add(child.target);

      const childNode = nodeMap.get(child.target);
      if (!childNode) continue;
      if (!visibleCategories.has(childNode.category)) continue;

      dfs(child.target, depth + 1, nextPath);
    }
  };

  dfs(data.root, 0, new Set());
  return lines.join('\n');
}
