"""Jedi-based name resolution and argument mapping."""
import ast
import os
import shutil
import sys
import sysconfig
from pathlib import Path
from typing import Optional

try:
    import jedi
except ImportError:
    jedi = None

from .models import FunctionNode, CallEdge, ArgMapping
from .ast_walker import (
    find_function_at_line, collect_calls, get_callee_position,
    build_node_from_def, compute_qualified_name, extract_params
)

BUILTIN_MODULES = frozenset({
    'builtins', '_collections_abc', '_abc', 'abc', 'typing', 'typing_extensions',
    'enum', 'dataclasses', 'functools', 'contextlib', 'collections.abc',
})

SKIP_BUILTIN_NAMES = frozenset({
    'print', 'len', 'range', 'int', 'str', 'float', 'bool', 'list', 'dict',
    'tuple', 'set', 'frozenset', 'type', 'object', 'super', 'isinstance',
    'issubclass', 'hasattr', 'getattr', 'setattr', 'delattr', 'callable',
    'iter', 'next', 'enumerate', 'zip', 'map', 'filter', 'sorted', 'reversed',
    'min', 'max', 'sum', 'abs', 'all', 'any', 'repr', 'id', 'hash', 'hex',
    'oct', 'bin', 'ord', 'chr', 'format', 'vars', 'dir', 'input',
    'ValueError', 'TypeError', 'KeyError', 'IndexError', 'AttributeError',
    'RuntimeError', 'StopIteration', 'NotImplementedError', 'FileNotFoundError',
    'OSError', 'IOError', 'Exception', 'BaseException', 'AssertionError',
    'ImportError', 'ModuleNotFoundError', 'NameError', 'ZeroDivisionError',
    'OverflowError', 'RecursionError', 'SystemError', 'UnicodeError',
})

_stdlib_paths = None

def _get_stdlib_paths():
    global _stdlib_paths
    if _stdlib_paths is None:
        paths = set()
        stdlib = sysconfig.get_paths().get('stdlib')
        if stdlib:
            paths.add(str(Path(stdlib).resolve()))
        platstdlib = sysconfig.get_paths().get('platstdlib')
        if platstdlib:
            paths.add(str(Path(platstdlib).resolve()))
        for p in sys.path:
            pp = Path(p).resolve()
            if 'lib/python' in str(pp) and 'site-packages' not in str(pp):
                paths.add(str(pp))
        _stdlib_paths = paths
    return _stdlib_paths


def _classify_module(module_name: str, module_path: Optional[str], project_root: str) -> str:
    """Classify a module as project/builtin/stdlib/third_party."""
    if not module_name and not module_path:
        return "builtin"

    if module_name in BUILTIN_MODULES or (module_name and module_name.startswith('builtins')):
        return "builtin"

    if module_path:
        resolved = str(Path(module_path).resolve())
        project_resolved = str(Path(project_root).resolve())
        if resolved.startswith(project_resolved):
            return "project"

        for sp in _get_stdlib_paths():
            if resolved.startswith(sp) and 'site-packages' not in resolved:
                return "stdlib"

        if 'site-packages' in resolved or 'dist-packages' in resolved:
            return "third_party"

        if 'typeshed' in resolved:
            return "stdlib"

    if module_name:
        top = module_name.split('.')[0]
        if top in sys.stdlib_module_names if hasattr(sys, 'stdlib_module_names') else False:
            return "stdlib"

    return "third_party"


def analyze(file: str, line: int, col: int, project_root: str,
            python_path: Optional[str] = None, max_depth: int = 10,
            filter_categories: Optional[list] = None) -> dict:
    """Analyze the call chain of a function at the given location.

    filter_categories: list of categories to INCLUDE. None = include all.
                       e.g. ["project", "third_party"] to hide builtin/stdlib.
    """
    if not jedi:
        raise RuntimeError("jedi is not installed")

    skip_categories = set()
    if filter_categories is not None:
        all_cats = {"project", "third_party", "stdlib", "builtin"}
        skip_categories = all_cats - set(filter_categories)

    project_kwargs = {"path": project_root}
    if python_path:
        # jedi expects an absolute path to the interpreter binary, not a bare
        # command name.  Resolve "python3" / "python" via shutil.which() so the
        # user doesn't need to configure an absolute path.
        resolved = python_path
        if not os.path.isabs(python_path):
            found = shutil.which(python_path)
            if found:
                resolved = found
            else:
                resolved = None  # skip setting environment_path
        if resolved:
            project_kwargs["environment_path"] = resolved
    try:
        project = jedi.Project(**project_kwargs)
    except TypeError:
        project = jedi.Project(path=project_root)

    source = Path(file).read_text(encoding='utf-8')
    tree = ast.parse(source)

    func_node = find_function_at_line(tree, line)
    if not func_node:
        raise ValueError(f"No function found at line {line} in {file}")

    root_qname = compute_qualified_name(func_node, tree, file, project_root)

    nodes = {}
    edges = []
    visited = set()

    def process(func_def, src, fpath, tree_, qname, depth):
        if qname in visited or depth > max_depth:
            return
        visited.add(qname)
        nodes[qname] = build_node_from_def(func_def, tree_, fpath, project_root, qname)

        script = jedi.Script(code=src, path=fpath, project=project)
        calls = collect_calls(func_def)

        for call in calls:
            callee_line, callee_col = get_callee_position(call)
            try:
                defs = script.goto(callee_line, callee_col)
                if not defs:
                    defs = script.infer(callee_line, callee_col)
                if not defs:
                    continue
            except Exception:
                continue

            d = defs[0]
            if not d.module_name and not d.module_path:
                continue

            callee_name = d.name or "unknown"
            if callee_name in SKIP_BUILTIN_NAMES:
                continue

            callee_full = d.full_name or callee_name
            module_str = d.module_name or ""
            callee_qname = f"{module_str}:{callee_full}" if module_str else f":{callee_full}"

            module_path_str = str(d.module_path) if d.module_path else None
            category = _classify_module(module_str, module_path_str, project_root)

            if category in skip_categories:
                continue

            is_project_code = (category == "project")

            if callee_qname not in nodes:
                nodes[callee_qname] = _build_leaf_node(d, callee_qname, is_project_code, category)

            callee_params = _get_callee_params(d)
            edge = _build_edge(qname, callee_qname, call, callee_params)
            edges.append(edge)

            if is_project_code and d.module_path and d.line:
                try:
                    callee_path = str(d.module_path)
                    callee_src = Path(callee_path).read_text(encoding='utf-8')
                    callee_tree = ast.parse(callee_src)
                    callee_func = find_function_at_line(callee_tree, d.line)
                    if callee_func:
                        inner_qname = compute_qualified_name(
                            callee_func, callee_tree, callee_path, project_root)
                        if inner_qname != callee_qname:
                            nodes[inner_qname] = nodes.pop(callee_qname)
                            nodes[inner_qname].id = inner_qname
                            nodes[inner_qname].qualified_name = inner_qname
                            edge.target = inner_qname
                            callee_qname = inner_qname
                        process(callee_func, callee_src, callee_path,
                                callee_tree, callee_qname, depth + 1)
                except Exception:
                    pass

    process(func_node, source, file, tree, root_qname, 0)
    return {
        "root": root_qname,
        "nodes": [n.to_dict() for n in nodes.values()],
        "edges": [e.to_dict() for e in edges],
    }


def expand_node(node_id: str, project_root: str,
                python_path: Optional[str] = None, max_depth: int = 3,
                filter_categories: Optional[list] = None) -> dict:
    """Expand a specific node (e.g., a third-party leaf the user clicks)."""
    parts = node_id.split(":", 1)
    if len(parts) != 2:
        raise ValueError(f"Invalid node_id: {node_id}")

    module_name, func_path = parts
    module_file = _module_to_file(module_name, project_root)
    if not module_file:
        return {"root": node_id, "nodes": [], "edges": []}

    dot_parts = func_path.split(".")
    func_name = dot_parts[-1]

    source = Path(module_file).read_text(encoding='utf-8')
    tree = ast.parse(source)

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.name == func_name:
                return analyze(module_file, node.lineno, node.col_offset,
                               project_root, python_path, max_depth, filter_categories)

    return {"root": node_id, "nodes": [], "edges": []}


def _build_leaf_node(d, qname: str, is_project: bool, category: str = "third_party") -> FunctionNode:
    """Build a leaf FunctionNode from a Jedi Name object."""
    class_name = None
    name = d.name or "unknown"
    full_name = d.full_name or name

    parts = full_name.rsplit(".", 1)
    if len(parts) == 2 and parts[0][0:1].isupper():
        class_name = parts[0].split(".")[-1]

    file_path = str(d.module_path) if d.module_path else None
    sig = _get_signature_string(d)
    params = _get_callee_params(d)

    return FunctionNode(
        id=qname,
        name=name,
        qualified_name=qname,
        class_name=class_name,
        file_path=file_path,
        start_line=d.line,
        end_line=None,
        is_project=is_project,
        category=category,
        signature=sig,
        params=params,
    )


def _get_signature_string(d) -> str:
    """Get function signature from Jedi definition."""
    try:
        sigs = d.get_signatures()
        if sigs:
            return f"({', '.join(p.name for p in sigs[0].params)})"
    except Exception:
        pass
    return "()"


def _get_callee_params(d) -> list:
    """Extract parameter info from a Jedi definition."""
    params = []
    try:
        sigs = d.get_signatures()
        if not sigs:
            return params
        for p in sigs[0].params:
            kind = "POSITIONAL_OR_KEYWORD"
            if p.kind:
                kind_name = str(p.kind.name) if hasattr(p.kind, 'name') else str(p.kind)
                kind = kind_name
            params.append({
                "name": p.name,
                "default_value": p.description.split("=", 1)[1] if "=" in (p.description or "") else None,
                "annotation": None,
                "kind": kind,
            })
    except Exception:
        pass
    return params


def _build_edge(caller_id: str, callee_id: str, call: ast.Call,
                callee_params: list) -> CallEdge:
    """Build a CallEdge with argument mappings."""
    mappings = []

    positional_params = [p for p in callee_params
                         if p.get("kind") in ("POSITIONAL_OR_KEYWORD", "POSITIONAL_ONLY")]
    skip_self = (positional_params and positional_params[0].get("name") == "self")
    param_offset = 1 if skip_self else 0

    for i, arg_node in enumerate(call.args):
        if isinstance(arg_node, ast.Starred):
            mappings.append(ArgMapping(
                param_name="*args",
                arg_expr=f"*{ast.unparse(arg_node.value)}",
                arg_type="star",
            ))
        else:
            pi = i + param_offset
            param = positional_params[pi] if pi < len(positional_params) else None
            mappings.append(ArgMapping(
                param_name=param["name"] if param else f"arg{i}",
                arg_expr=ast.unparse(arg_node),
                arg_type="positional",
            ))

    for kw in call.keywords:
        if kw.arg is None:
            mappings.append(ArgMapping(
                param_name="**kwargs",
                arg_expr=f"**{ast.unparse(kw.value)}",
                arg_type="doublestar",
            ))
        else:
            mappings.append(ArgMapping(
                param_name=kw.arg,
                arg_expr=ast.unparse(kw.value),
                arg_type="keyword",
            ))

    provided = {m.param_name for m in mappings}
    for p in callee_params:
        pname = p.get("name", "")
        if pname == "self":
            continue
        if pname not in provided and p.get("default_value"):
            mappings.append(ArgMapping(
                param_name=pname,
                arg_expr="(default)",
                arg_type="positional",
                default_value=p["default_value"],
            ))

    return CallEdge(
        id=f"{caller_id}->{callee_id}@{call.lineno}",
        source=caller_id,
        target=callee_id,
        call_line=call.lineno,
        call_col=call.col_offset,
        arg_mappings=[m.__dict__ for m in mappings],
    )


def _module_to_file(module_name: str, project_root: str) -> Optional[str]:
    """Convert a dotted module name to a file path within the project."""
    parts = module_name.replace(".", "/")
    root = Path(project_root)

    candidate = root / f"{parts}.py"
    if candidate.exists():
        return str(candidate)

    candidate = root / parts / "__init__.py"
    if candidate.exists():
        return str(candidate)

    return None
