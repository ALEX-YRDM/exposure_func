"""AST walking utilities for collecting function definitions and call sites."""
import ast
from typing import Optional
from pathlib import Path

from .models import FunctionNode, ParamInfo


def find_function_at_line(tree: ast.Module, line: int) -> Optional[ast.FunctionDef]:
    """Find the innermost FunctionDef/AsyncFunctionDef containing the given line."""
    best = None
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.lineno <= line <= node.end_lineno:
                if best is None or node.lineno >= best.lineno:
                    best = node
    return best


def get_enclosing_class(tree: ast.Module, func_node: ast.FunctionDef) -> Optional[str]:
    """Find if the function is a method inside a class."""
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            for item in node.body:
                if item is func_node:
                    return node.name
                if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)) and item is func_node:
                    return node.name
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            for item in ast.walk(node):
                if item is func_node:
                    return node.name
    return None


def compute_qualified_name(func_node: ast.FunctionDef, tree: ast.Module,
                           file_path: str, project_root: str) -> str:
    """Compute a unique qualified name for a function."""
    rel_path = Path(file_path).relative_to(project_root)
    module_name = str(rel_path.with_suffix('')).replace('/', '.').replace('\\', '.')

    class_name = get_enclosing_class(tree, func_node)
    if class_name:
        return f"{module_name}:{class_name}.{func_node.name}"
    return f"{module_name}:{func_node.name}"


def collect_calls(func_node: ast.FunctionDef) -> list:
    """Collect all ast.Call nodes within a function body (not nested functions)."""
    calls = []

    class CallCollector(ast.NodeVisitor):
        def visit_Call(self, node):
            calls.append(node)
            self.generic_visit(node)

        def visit_FunctionDef(self, node):
            pass

        def visit_AsyncFunctionDef(self, node):
            pass

    for stmt in func_node.body:
        CallCollector().visit(stmt)
    return calls


def get_callee_position(call: ast.Call) -> tuple:
    """Extract the line/col of the callee expression for Jedi goto."""
    func = call.func
    if isinstance(func, ast.Attribute):
        return func.end_lineno or func.lineno, func.end_col_offset - len(func.attr)
    elif isinstance(func, ast.Name):
        return func.lineno, func.col_offset
    return func.lineno, func.col_offset


def build_node_from_def(func_node: ast.FunctionDef, tree: ast.Module,
                        file_path: str, project_root: str, qname: str) -> FunctionNode:
    """Build a FunctionNode from an AST FunctionDef."""
    class_name = get_enclosing_class(tree, func_node)
    params = extract_params(func_node)
    sig = format_signature(func_node)

    return FunctionNode(
        id=qname,
        name=func_node.name,
        qualified_name=qname,
        class_name=class_name,
        file_path=file_path,
        start_line=func_node.lineno,
        end_line=func_node.end_lineno,
        is_project=True,
        signature=sig,
        params=[p.__dict__ for p in params],
    )


def extract_params(func_node: ast.FunctionDef) -> list:
    """Extract parameter info from a function definition."""
    params = []
    args = func_node.args
    defaults_offset = len(args.args) - len(args.defaults)

    for i, arg in enumerate(args.args):
        default_val = None
        di = i - defaults_offset
        if di >= 0 and di < len(args.defaults):
            default_val = ast.unparse(args.defaults[di])
        annotation = ast.unparse(arg.annotation) if arg.annotation else None
        params.append(ParamInfo(
            name=arg.arg, default_value=default_val,
            annotation=annotation, kind="POSITIONAL_OR_KEYWORD"
        ))

    for i, arg in enumerate(args.kwonlyargs):
        default_val = None
        if i < len(args.kw_defaults) and args.kw_defaults[i]:
            default_val = ast.unparse(args.kw_defaults[i])
        annotation = ast.unparse(arg.annotation) if arg.annotation else None
        params.append(ParamInfo(
            name=arg.arg, default_value=default_val,
            annotation=annotation, kind="KEYWORD_ONLY"
        ))

    if args.vararg:
        params.append(ParamInfo(
            name=f"*{args.vararg.arg}", kind="VAR_POSITIONAL"
        ))
    if args.kwarg:
        params.append(ParamInfo(
            name=f"**{args.kwarg.arg}", kind="VAR_KEYWORD"
        ))

    return params


def format_signature(func_node: ast.FunctionDef) -> str:
    """Format a human-readable signature string."""
    try:
        params = []
        args = func_node.args
        defaults_offset = len(args.args) - len(args.defaults)

        for i, arg in enumerate(args.args):
            p = arg.arg
            if arg.annotation:
                p += f": {ast.unparse(arg.annotation)}"
            di = i - defaults_offset
            if di >= 0 and di < len(args.defaults):
                p += f"={ast.unparse(args.defaults[di])}"
            params.append(p)

        if args.vararg:
            params.append(f"*{args.vararg.arg}")
        for i, arg in enumerate(args.kwonlyargs):
            p = arg.arg
            if i < len(args.kw_defaults) and args.kw_defaults[i]:
                p += f"={ast.unparse(args.kw_defaults[i])}"
            params.append(p)
        if args.kwarg:
            params.append(f"**{args.kwarg.arg}")

        return f"({', '.join(params)})"
    except Exception:
        return "()"
