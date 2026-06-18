# Changelog

## 0.1.3

- Fix "python3/bin/python seems to be missing" error on machines where no
  absolute Python path is configured. Bare command names (e.g. `python3`) are
  now resolved via `shutil.which()` before being passed to Jedi.

## 0.1.2

- Cache analysis results in an in-memory LRU so revisiting a function renders
  instantly; the cache is invalidated when its file is saved.
- Add a History panel listing recently viewed functions for quick switching.
- Add a toolbar button to move the call chain view into a separate window, and
  restore its content after the move.

## 0.1.1

- Add extension icon.

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
