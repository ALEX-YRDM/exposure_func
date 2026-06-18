# Changelog

## 0.1.0

Initial release.

- One-click call chain visualization for Python functions and methods via
  CodeLens, editor context menu, and command palette.
- Static analysis backend (AST + Jedi) running as a JSON-RPC subprocess; jedi
  is bundled with the extension.
- Interactive React Flow graph: draggable nodes, pan/zoom, collapsible
  parameters, hover argument-to-parameter mapping, jump-to-definition.
- Toolbar controls: depth slider, category filter (project / third-party /
  stdlib / builtin), layout direction (TB / LR / BT / RL), and light / dark /
  auto themes.
- Copyable indented text-tree view of the call chain.
- Export the graph as PNG or SVG.
