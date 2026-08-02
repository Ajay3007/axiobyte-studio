"""Coordinate conversion — normalised frame space to Manim's world.

Three conventions differ and all three are converted here, once, so nothing else
in the backend has to think about it:

============  ==============================  ==============================
              Studio layout                   Manim
============  ==============================  ==============================
origin        top-left                        centre
y axis        downward                        upward
extent        0..1 of the frame               frame_width x frame_height
============  ==============================  ==============================

The reference episodes' ``P(px, py)`` helper does exactly this conversion inline
in every episode. Here it happens at the boundary, which is why a shot can be
authored without knowing that Manim exists.
"""

from __future__ import annotations

import numpy as np
from manim import config

from axiobyte_studio.layout.frame import Box, Target

#: Design pixels per Manim unit. 100 in both reference cuts, which is what makes
#: design pixels a universal unit rather than a per-format one.
PIXELS_PER_UNIT = 100.0


def configure(target: Target) -> None:
    """Point Manim's global canvas at a target profile.

    Manim's ``config`` is process-global, so this must run before a scene is
    constructed. A render job renders one target at a time for exactly this reason.

    Args:
        target: The format to render.
    """
    config.pixel_width = target.canvas_w
    config.pixel_height = target.canvas_h
    config.frame_width = target.canvas_w / PIXELS_PER_UNIT
    config.frame_height = target.canvas_h / PIXELS_PER_UNIT


def frame_size(target: Target) -> tuple[float, float]:
    """The frame's extent in Manim units.

    Args:
        target: The format to measure.

    Returns:
        ``(width, height)`` in Manim units.
    """
    return (target.canvas_w / PIXELS_PER_UNIT, target.canvas_h / PIXELS_PER_UNIT)


def point(x: float, y: float, target: Target) -> np.ndarray:
    """Convert a normalised frame point to Manim coordinates.

    Args:
        x: Horizontal position, 0 at the left edge, 1 at the right.
        y: Vertical position, 0 at the **top** edge, 1 at the bottom.
        target: The format supplying the frame extent.

    Returns:
        A Manim 3-vector.
    """
    width, height = frame_size(target)
    return np.array([(x - 0.5) * width, (0.5 - y) * height, 0.0])


def center_of(box: Box, target: Target) -> np.ndarray:
    """The Manim coordinates of a box's centre.

    Args:
        box: A box in normalised frame coordinates.
        target: The format supplying the frame extent.

    Returns:
        A Manim 3-vector.
    """
    cx, cy = box.center
    return point(cx, cy, target)


def size_of(box: Box, target: Target) -> tuple[float, float]:
    """A box's extent in Manim units.

    Args:
        box: A box in normalised frame coordinates.
        target: The format supplying the frame extent.

    Returns:
        ``(width, height)`` in Manim units.
    """
    width, height = frame_size(target)
    return (box.w * width, box.h * height)


def units(pixels: float) -> float:
    """Convert design pixels to Manim units.

    Args:
        pixels: A length in design pixels.

    Returns:
        The same length in Manim units.
    """
    return pixels / PIXELS_PER_UNIT
