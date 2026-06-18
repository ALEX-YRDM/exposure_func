"""Data models for the call chain analyzer."""
from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class ParamInfo:
    name: str
    default_value: Optional[str] = None
    annotation: Optional[str] = None
    kind: str = "POSITIONAL_OR_KEYWORD"


@dataclass
class FunctionNode:
    id: str
    name: str
    qualified_name: str
    class_name: Optional[str] = None
    file_path: Optional[str] = None
    start_line: Optional[int] = None
    end_line: Optional[int] = None
    is_project: bool = True
    signature: str = "()"
    params: list = field(default_factory=list)

    def to_dict(self):
        d = asdict(self)
        return d


@dataclass
class ArgMapping:
    param_name: str
    arg_expr: str
    arg_type: str = "positional"
    default_value: Optional[str] = None


@dataclass
class CallEdge:
    id: str
    source: str
    target: str
    call_line: int
    call_col: int
    arg_mappings: list = field(default_factory=list)

    def to_dict(self):
        d = asdict(self)
        return d
