"""The Manim backend — the primary renderer.

This is one of only two places in the Studio where ``manim`` may be imported; the
import contract in ``pyproject.toml`` enforces it, and that single rule is what
keeps everything above this layer portable.
"""

from __future__ import annotations

from axiobyte_studio.backends.manim.easing import curves, rate_func
from axiobyte_studio.backends.manim.scene import StudioScene
from axiobyte_studio.backends.manim.shapes import RENDERERS, draw
from axiobyte_studio.backends.manim.space import configure, frame_size, point, units

__all__ = [
    "RENDERERS",
    "StudioScene",
    "configure",
    "curves",
    "draw",
    "frame_size",
    "point",
    "rate_func",
    "units",
]
