"""The Manim backend — the primary renderer.

This is one of only two places in the Studio where ``manim`` may be imported; the
import contract in ``pyproject.toml`` enforces it, and that single rule is what
keeps everything above this layer portable.
"""

from __future__ import annotations

from axiobyte_studio.backends.manim import iso
from axiobyte_studio.backends.manim.easing import curves, rate_func
from axiobyte_studio.backends.manim.episode_scene import (
    build_episode_scenes,
    scene_class_name,
)
from axiobyte_studio.backends.manim.plates import PlateSequence
from axiobyte_studio.backends.manim.plates import frame as plate_frame
from axiobyte_studio.backends.manim.scene import StudioScene
from axiobyte_studio.backends.manim.shapes import ISO_RENDERERS, RENDERERS, draw
from axiobyte_studio.backends.manim.space import configure, frame_size, point, units

__all__ = [
    "ISO_RENDERERS",
    "RENDERERS",
    "PlateSequence",
    "StudioScene",
    "build_episode_scenes",
    "configure",
    "curves",
    "draw",
    "frame_size",
    "iso",
    "plate_frame",
    "point",
    "rate_func",
    "scene_class_name",
    "units",
]
