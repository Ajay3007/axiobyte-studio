"""The renderers a shot may name — data only, so every layer can check a choice.

ARCHITECTURE.md §8.0a: a renderer is chosen **per shot**, by the simplest one that
achieves it — Manim, then Three.js, then Blender only when its capabilities are
genuinely required. This module knows the ids and what each can do today; it
imports no backend, which is what lets the storyboard validate a choice without
reaching upward into ``backends/``.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Renderer:
    """One backend a shot can be rendered by.

    Attributes:
        id: The id a shot names, matching ``backends/<id>/``.
        rank: Its place on the selection ladder; lower is simpler and preferred.
        renders_shots: Whether the backend can render a shot's window to a clip
            today. Blender bakes plates but does not render shots yet.
        needs_reason: Whether a shot choosing it must say why. Blender does: it
            is the specialist backend, never the default route to 3D.
    """

    id: str
    rank: int
    renders_shots: bool
    needs_reason: bool = False


#: The selection ladder, in order of preference.
RENDERERS: dict[str, Renderer] = {
    "manim": Renderer("manim", rank=1, renders_shots=True),
    "three": Renderer("three", rank=2, renders_shots=True),
    "blender": Renderer("blender", rank=3, renders_shots=False, needs_reason=True),
}

#: What a shot renders with when neither it nor its episode says otherwise.
DEFAULT_RENDERER = "manim"
