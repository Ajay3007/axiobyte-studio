"""Tier-1 3D — axonometric solids built from flat primitives.

The cheapest of the three 3D tiers (``ARCHITECTURE.md`` §8.0), and the one most
of the catalogue should use. There is no renderer here and no per-frame cost: a
box is three shaded polygons, so it composites with 2D diagrams perfectly, animates
with the ordinary verbs, and costs the same as a rectangle.

``ep02/nic_3d.png`` was reaching for exactly this and missing: flat-shaded, on a
white background, unusable. What makes an isometric solid read as solid is not the
projection — it is the **face shading**. Three faces of one object, lit
consistently, at three different values. Get that wrong and it reads as a
wireframe puzzle; get it right and it reads as a thing.

Light comes from the upper left, always. A catalogue where light direction wanders
between shots looks like a catalogue assembled by several people.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from manim import Polygon, VGroup, interpolate_color
from manim.utils.color import ManimColor

from axiobyte_studio.backends.manim.space import center_of, size_of
from axiobyte_studio.core.errors import DesignError
from axiobyte_studio.layout.frame import Box, Target

#: True isometric: the two horizontal axes at 30° from the screen horizontal.
_COS30 = math.cos(math.radians(30.0))
_SIN30 = math.sin(math.radians(30.0))

#: Relative brightness of each visible face, lit from the upper left. These three
#: numbers are what makes a solid read as solid; they never vary between shots.
#:
#: They are deliberately LOW. A face blended fully to its role hue is a large slab
#: of saturated colour, which on this canvas shouts louder than anything the shot
#: is trying to say — and the flat fidelity fills at 0.45 for exactly that reason.
#: What reads as solid is the RATIO between the three, not their absolute value.
TOP, LEFT, RIGHT = 0.40, 0.24, 0.14


@dataclass(frozen=True, slots=True)
class Solid:
    """A box in isometric space, in layout units.

    Attributes:
        width: Extent along the x axis, which recedes to the lower right.
        depth: Extent along the y axis, which recedes to the lower left.
        height: Extent along z, which is straight up the screen.
    """

    width: float
    depth: float
    height: float

    def __post_init__(self) -> None:
        """Refuse a solid with no volume."""
        if min(self.width, self.depth, self.height) < 0:
            raise DesignError(
                f"A solid cannot have a negative dimension: "
                f"{self.width} x {self.depth} x {self.height}",
                fix="Use a positive extent, or zero for a flat slab.",
            )


def project(x: float, y: float, z: float) -> np.ndarray:
    """Project an isometric point to the drawing plane.

    Args:
        x: Recedes to the lower right.
        y: Recedes to the lower left.
        z: Straight up.

    Returns:
        A Manim 3-vector, z always zero — this is a *drawing*, not a 3D scene.
    """
    return np.array(
        [(x - y) * _COS30, z - (x + y) * _SIN30, 0.0],
        dtype=float,
    )


def _shade(hue: str, ground: str, level: float) -> ManimColor:
    """One face's colour, blended toward the canvas to darken it."""
    return interpolate_color(ManimColor(ground), ManimColor(hue), level)


def solid(
    shape: Solid,
    hue: str,
    ground: str,
    *,
    origin: np.ndarray | None = None,
    edge: float = 1.6,
) -> VGroup:
    """Draw an isometric box as its three visible faces.

    Args:
        shape: The box's extents.
        hue: The role colour it is drawn in.
        ground: The canvas colour, blended toward for the darker faces.
        origin: Where its near-bottom corner sits. Defaults to the scene origin.
        edge: Stroke weight on the face boundaries.

    Returns:
        The three faces, ordered back to front.
    """
    base = np.zeros(3) if origin is None else np.asarray(origin, dtype=float)
    w, d, h = shape.width, shape.depth, shape.height

    def at(x: float, y: float, z: float) -> np.ndarray:
        point: np.ndarray = base + project(x, y, z)
        return point

    faces = VGroup()
    for corners, level in (
        # Right face first: it is furthest from the light and sits behind the
        # silhouette's leading edge.
        (((w, 0, 0), (w, d, 0), (w, d, h), (w, 0, h)), RIGHT),
        (((0, 0, 0), (w, 0, 0), (w, 0, h), (0, 0, h)), LEFT),
        (((0, 0, h), (w, 0, h), (w, d, h), (0, d, h)), TOP),
    ):
        faces.add(
            Polygon(
                *[at(*corner) for corner in corners],
                stroke_color=hue,
                stroke_width=edge,
                fill_color=_shade(hue, ground, level),
                fill_opacity=1.0,
            )
        )
    return faces


def fit(box: Box, target: Target, depth: float, thickness: float) -> Solid:
    """The largest solid of a given proportion that fits inside a box.

    The projection is not a scaling — it maps a ``w x d x h`` box to a drawing
    ``(w + d)·cos30`` wide and ``(w + d)·sin30 + h`` tall. Sizing against width
    alone, as the first version did, overflows downward by exactly the amount the
    depth contributes, and the overflow lands in the neighbour's box.

    Args:
        box: The region the solver allotted.
        target: The format being rendered.
        depth: Depth as a fraction of width.
        thickness: Height as a fraction of width.

    Returns:
        A solid that fits.
    """
    width, height = size_of(box, target)
    spread = 1.0 + depth
    unit = min(width / (spread * _COS30), height / (spread * _SIN30 + thickness))
    return Solid(width=unit, depth=unit * depth, height=unit * thickness)


def slab(
    box: Box,
    target: Target,
    hue: str,
    ground: str,
    *,
    thickness: float = 0.10,
    depth: float = 0.55,
) -> VGroup:
    """A board: wide, deep, and barely thick. The shape most hardware is.

    Args:
        box: Where it sits, in normalised frame coordinates.
        target: The format being rendered.
        hue: Its role colour.
        ground: The canvas colour.
        thickness: Height as a fraction of width.
        depth: Depth as a fraction of width.

    Returns:
        The board, centred in its box and contained by it.
    """
    group = solid(fit(box, target, depth, thickness), hue, ground)
    return group.move_to(center_of(box, target))


def stack(
    box: Box,
    target: Target,
    hues: list[str],
    ground: str,
    *,
    thickness: float = 0.10,
    gap: float = 0.06,
    depth: float = 0.55,
) -> VGroup:
    """Layers, stacked in z — a cache hierarchy, a protocol stack, page levels.

    Drawn bottom-up so nearer layers overlap the ones behind, which is what makes
    a stack read as stacked rather than as a list.

    Args:
        box: Where it sits.
        target: The format being rendered.
        hues: One role colour per layer, bottom first.
        ground: The canvas colour.
        thickness: Each layer's height, in layout units.
        gap: Space between layers.
        depth: Depth as a fraction of width.

    Returns:
        The stack, centred in its box.

    Raises:
        DesignError: No layers were given.
    """
    if not hues:
        raise DesignError(
            "A stack needs at least one layer",
            fix="Pass one role colour per layer, bottom first.",
        )
    # The stack is as tall as its layers plus the gaps between them, so shrink the
    # unit accordingly or the top layer leaves the box.
    layers = len(hues)
    total = thickness * layers + gap * (layers - 1)
    shape = fit(box, target, depth, total)
    step = shape.width * (thickness + gap)
    each = Solid(shape.width, shape.depth, shape.width * thickness)

    group = VGroup()
    for index, hue in enumerate(hues):
        group.add(solid(each, hue, ground, origin=project(0.0, 0.0, index * step)))
    return group.move_to(center_of(box, target))


def chip(
    board: VGroup,
    hue: str,
    ground: str,
    *,
    size: float = 0.30,
    height: float = 0.14,
    at: tuple[float, float] = (0.5, 0.5),
) -> VGroup:
    """A die sitting on a board.

    Args:
        board: The slab to place it on.
        hue: The die's role colour.
        ground: The canvas colour.
        size: The die's footprint, as a fraction of the board's width.
        height: How far it stands proud, in layout units.
        at: Where on the board, as fractions of its width and depth.

    Returns:
        The die, positioned on the board's top face.
    """
    top = board[-1]
    span = top.width
    unit = span * size / (2 * _COS30)
    die = solid(Solid(unit, unit, height), hue, ground)

    # The board's top face is a parallelogram; interpolate across it rather than
    # using its bounding box, or the die slides off at the corners.
    corners = top.get_vertices()
    near, right_edge, far = corners[0], corners[1], corners[3]
    position = near + (right_edge - near) * at[0] + (far - near) * at[1]
    return die.move_to(position + np.array([0.0, height * 0.5, 0.0]))
