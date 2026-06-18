# Exposure Func

Visualize the internal call chain of any Python function or method as an
interactive flowchart, right inside VS Code.

Place your cursor on a function, trigger **Show Call Chain**, and a panel opens
showing — recursively — which functions it calls, with hover details for the
arguments passed at each call site.

## Features

- **One-click call chain** — CodeLens above every `def`/`async def`, or the
  editor right-click menu, or the command palette (`Exposure Func: Show Call
  Chain`).
- **Class-aware** — methods are labeled with their owning class.
- **Argument mapping on hover** — hover an edge to see how actual arguments map
  to the callee's parameters (positional, keyword, `*args`/`**kwargs`, defaults).
- **Project-scoped** — your project's code is expanded recursively; third-party
  libraries (torch, numpy, …), stdlib and builtins are shown as leaf nodes and
  can be filtered out.
- **Interactive graph** — draggable nodes, pan/zoom, collapsible parameters,
  depth slider, switchable layout direction (TB / LR / BT / RL), and light /
  dark / auto themes.
- **Text & image export** — copy the chain as an indented text tree, or export
  the graph as PNG / SVG.

## Requirements

- A **Python interpreter** available on your machine. The extension reads the
  interpreter configured by the official
  [Python extension](https://marketplace.visualstudio.com/items?itemName=ms-python.python),
  or you can set one explicitly (see Settings below).
- `jedi` is **bundled** with the extension — no manual install needed.

## Usage

1. Open a Python file.
2. Click the **Show Call Chain** CodeLens above a function, or right-click →
   **Show Call Chain**, or run the command from the palette.
3. Explore the graph: drag nodes, hover edges for argument details, use the
   toolbar to adjust depth / layout / theme / filters, and click a node to jump
   to its definition in the source.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `exposureFunc.pythonPath` | `""` | Path to the Python interpreter. Leave empty to auto-detect from the Python extension. |
| `exposureFunc.maxDepth` | `10` | Maximum recursion depth for analysis. |

## How it works

The extension runs a small Python static analyzer (AST + Jedi) as a subprocess,
communicating over JSON-RPC on stdin/stdout. It does **not** execute your code —
all analysis is static.

## Known limitations

Static analysis can't always resolve dynamic dispatch. Calls through dynamic
attributes, decorators that return new functions, metaclasses, or heavy runtime
metaprogramming may be missed or shown as unresolved leaf nodes.

## License

MIT
