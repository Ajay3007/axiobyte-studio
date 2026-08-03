"""The Blender backend — Tier-2 baking, offline.

The Studio side never imports ``bpy``: it builds a spec, runs Blender headless
against a script, and records what came out. Blender is therefore a *build-time*
dependency. Episodes that only use already-baked plates render without it, which
is the point of baking.
"""

from __future__ import annotations

from axiobyte_studio.backends.blender.bake import (
    MOVES,
    Plate,
    PlateSpec,
    bake,
    blender_binary,
)

__all__ = ["MOVES", "Plate", "PlateSpec", "bake", "blender_binary"]
