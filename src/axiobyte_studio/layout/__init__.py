"""The Layout System — format-agnostic by construction.

A shot states relations; a target profile supplies the axis. There is no master
aspect ratio: 16:9, 9:16 and 1:1 are peers, and adding a format is a profile file
rather than an episode change.
"""

from __future__ import annotations

from axiobyte_studio.layout.frame import (
    FULL_FRAME,
    Box,
    Insets,
    Target,
    available_targets,
    target,
)
from axiobyte_studio.layout.lint import Finding, Severity, check, check_all, errors, report
from axiobyte_studio.layout.relations import (
    Anchor,
    Chain,
    Cluster,
    Ensemble,
    Focus,
    OverBudget,
    Pair,
    Relation,
    Stack,
)
from axiobyte_studio.layout.solve import Phase, SolvedLayout, solve, solve_all

__all__ = [
    "FULL_FRAME",
    "Anchor",
    "Box",
    "Chain",
    "Cluster",
    "Ensemble",
    "Finding",
    "Focus",
    "Insets",
    "OverBudget",
    "Pair",
    "Phase",
    "Relation",
    "Severity",
    "SolvedLayout",
    "Stack",
    "Target",
    "available_targets",
    "check",
    "check_all",
    "errors",
    "report",
    "solve",
    "solve_all",
    "target",
]
