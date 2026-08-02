"""Frame geometry and target profiles.

Everything here is expressed in **normalised frame coordinates**: ``(0, 0)`` is the
top-left of the frame, ``(1, 1)`` the bottom-right, matching the top-left origin the
reference episodes use. Nothing in the layout system deals in pixels until the very
last step, which is what lets one solved layout serve any format.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from functools import cache
from pathlib import Path
from typing import Any

import yaml

from axiobyte_studio.core.errors import DesignError

_TARGETS_DIR = Path(__file__).resolve().parents[1] / "design" / "targets"


@dataclass(frozen=True, slots=True)
class Insets:
    """Margins as fractions of the frame, one per edge."""

    top: float = 0.0
    bottom: float = 0.0
    left: float = 0.0
    right: float = 0.0

    def merged(self, other: Insets) -> Insets:
        """Combine with another set, taking the larger inset on every edge.

        Args:
            other: The insets to combine with.

        Returns:
            The union — what stays clear of both.
        """
        return Insets(
            top=max(self.top, other.top),
            bottom=max(self.bottom, other.bottom),
            left=max(self.left, other.left),
            right=max(self.right, other.right),
        )


@dataclass(frozen=True, slots=True)
class Box:
    """A rectangle in normalised frame coordinates, top-left origin."""

    x: float
    y: float
    w: float
    h: float

    @property
    def right(self) -> float:
        """Right edge."""
        return self.x + self.w

    @property
    def bottom(self) -> float:
        """Bottom edge."""
        return self.y + self.h

    @property
    def center(self) -> tuple[float, float]:
        """Centre point, as ``(x, y)``."""
        return (self.x + self.w / 2, self.y + self.h / 2)

    def inset(self, insets: Insets) -> Box:
        """Shrink by the given margins.

        Args:
            insets: Margins to remove from each edge.

        Returns:
            The reduced box.
        """
        return Box(
            x=self.x + insets.left,
            y=self.y + insets.top,
            w=self.w - insets.left - insets.right,
            h=self.h - insets.top - insets.bottom,
        )

    def overlaps(self, other: Box, tolerance: float = 1e-6) -> bool:
        """Whether two boxes share any area.

        Args:
            other: The box to test against.
            tolerance: Slack allowed before an edge touch counts as an overlap.

        Returns:
            ``True`` if the boxes intersect by more than ``tolerance``.
        """
        return (
            self.x < other.right - tolerance
            and other.x < self.right - tolerance
            and self.y < other.bottom - tolerance
            and other.y < self.bottom - tolerance
        )

    def contains(self, other: Box, tolerance: float = 1e-6) -> bool:
        """Whether this box fully encloses another.

        Args:
            other: The box to test.
            tolerance: Slack allowed on each edge.

        Returns:
            ``True`` if ``other`` lies within this box.
        """
        return (
            other.x >= self.x - tolerance
            and other.y >= self.y - tolerance
            and other.right <= self.right + tolerance
            and other.bottom <= self.bottom + tolerance
        )

    def divide(self, count: int, axis: str, gap: float) -> list[Box]:
        """Split into equal parts along an axis, separated by a gap.

        Args:
            count: How many parts.
            axis: ``"horizontal"`` or ``"vertical"``.
            gap: Space between parts, as a fraction of this box's extent
                along ``axis``.

        Returns:
            The parts, in order.

        Raises:
            DesignError: ``count`` is not positive, or ``axis`` is unknown.
        """
        if count <= 0:
            raise DesignError(f"Cannot divide a box into {count} parts")
        if axis not in ("horizontal", "vertical"):
            raise DesignError(
                f"Unknown layout axis {axis!r}",
                fix="Use 'horizontal' or 'vertical'.",
            )
        extent = self.w if axis == "horizontal" else self.h
        total_gap = gap * extent * (count - 1)
        size = (extent - total_gap) / count
        step = size + gap * extent
        if axis == "horizontal":
            return [Box(self.x + i * step, self.y, size, self.h) for i in range(count)]
        return [Box(self.x, self.y + i * step, self.w, size) for i in range(count)]

    def weighted_divide(self, weights: list[float], axis: str, gap: float) -> list[Box]:
        """Split into parts sized by weight.

        Args:
            weights: Relative sizes; need not sum to anything in particular.
            axis: ``"horizontal"`` or ``"vertical"``.
            gap: Space between parts, as a fraction of the extent.

        Returns:
            The parts, in order.

        Raises:
            DesignError: ``weights`` is empty or sums to zero.
        """
        if not weights or sum(weights) <= 0:
            raise DesignError("weighted_divide needs at least one positive weight")
        extent = self.w if axis == "horizontal" else self.h
        total_gap = gap * extent * (len(weights) - 1)
        usable = extent - total_gap
        total = sum(weights)
        boxes: list[Box] = []
        offset = 0.0
        for weight in weights:
            size = usable * (weight / total)
            if axis == "horizontal":
                boxes.append(Box(self.x + offset, self.y, size, self.h))
            else:
                boxes.append(Box(self.x, self.y + offset, self.w, size))
            offset += size + gap * extent
        return boxes

    def to_pixels(self, target: Target) -> tuple[float, float, float, float]:
        """Convert to design pixels for a target.

        Args:
            target: The target profile supplying the canvas size.

        Returns:
            ``(x, y, w, h)`` in design pixels, top-left origin.
        """
        return (
            self.x * target.canvas_w,
            self.y * target.canvas_h,
            self.w * target.canvas_w,
            self.h * target.canvas_h,
        )


FULL_FRAME = Box(0.0, 0.0, 1.0, 1.0)


@dataclass(frozen=True, slots=True)
class Target:
    """A format profile: everything that differs between aspect ratios.

    Target profiles are Studio infrastructure, written once and used by every
    episode. A shot never sees one — the solver does.

    Attributes:
        id: Profile id, e.g. ``"9x16"``.
        title: Human name.
        canvas_w: Canvas width in design pixels.
        canvas_h: Canvas height in design pixels.
        unit_px: Design pixels per layout unit. 100 in every reference episode.
        axis: Which way each relation runs in this frame.
        safe: Margins that keep content clear of the frame edge.
        platform_safe: Per-platform occlusion, e.g. Reels UI over the bottom.
        density_budget: Most top-level elements this frame holds legibly.
        text_max_width: Longest line, as a fraction of frame width.
        gap: Default spacing between siblings.
        min_element: Smallest legible element, as a fraction of frame width.
        chrome: Where the pinned furniture sits.
    """

    id: str
    title: str
    canvas_w: int
    canvas_h: int
    unit_px: int
    axis: dict[str, str]
    safe: Insets
    platform_safe: dict[str, Insets]
    density_budget: int
    text_max_width: float
    gap: float
    min_element: float
    chrome: dict[str, str]

    @property
    def aspect(self) -> float:
        """Width divided by height."""
        return self.canvas_w / self.canvas_h

    @property
    def is_portrait(self) -> bool:
        """Whether the frame is taller than it is wide."""
        return self.canvas_h > self.canvas_w

    def axis_for(self, relation: str) -> str:
        """Which way a relation runs in this frame.

        Args:
            relation: Relation kind, e.g. ``"chain"``.

        Returns:
            The axis or arrangement name for that relation.

        Raises:
            DesignError: The profile has no axis for that relation.
        """
        try:
            return self.axis[relation]
        except KeyError:
            raise DesignError(
                f"Target {self.id!r} declares no axis for relation {relation!r}",
                context={"declares": ", ".join(sorted(self.axis))},
                fix=f"Add `{relation}:` under `axis:` in design/targets/{self.id}.yaml.",
            ) from None

    @classmethod
    def load(cls, name: str) -> Target:
        """Load a target profile by id.

        Args:
            name: Profile id, matching a file in ``design/targets/``.

        Returns:
            The loaded profile.

        Raises:
            DesignError: No profile by that name exists.
        """
        path = _TARGETS_DIR / f"{name}.yaml"
        if not path.exists():
            available = sorted(p.stem for p in _TARGETS_DIR.glob("*.yaml"))
            raise DesignError(
                f"No target profile named {name!r}",
                context={"available": ", ".join(available)},
                fix=(
                    f"Use one of the above, or add design/targets/{name}.yaml — "
                    "a new format is a profile, never an episode change."
                ),
            )
        raw: dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8"))
        canvas = raw["canvas"]
        return cls(
            id=str(raw.get("id", name)),
            title=str(raw.get("title", name)),
            canvas_w=int(canvas["w"]),
            canvas_h=int(canvas["h"]),
            unit_px=int(canvas.get("unit_px", 100)),
            axis=dict(raw.get("axis", {})),
            safe=Insets(**raw.get("safe", {})),
            platform_safe={
                key: Insets(**value) for key, value in raw.get("platform_safe", {}).items()
            },
            density_budget=int(raw.get("density_budget", 6)),
            text_max_width=float(raw.get("text_max_width", 0.7)),
            gap=float(raw.get("gap", 0.04)),
            min_element=float(raw.get("min_element", 0.06)),
            chrome=dict(raw.get("chrome", {})),
        )

    def content_box(self, platform: str | None = None) -> Box:
        """The region a shot may actually use.

        Args:
            platform: Which platform's UI to stay clear of, e.g. ``"reels"``.
                When ``None``, only the frame's own safe margins apply.

        Returns:
            The usable box, in normalised coordinates.

        Raises:
            DesignError: The profile knows no such platform.
        """
        insets = self.safe
        if platform is not None:
            if platform not in self.platform_safe:
                known = ", ".join(sorted(self.platform_safe)) or "none"
                raise DesignError(
                    f"Target {self.id!r} declares no platform-safe zone for {platform!r}",
                    context={"declares": known},
                    fix=f"Add `{platform}:` under `platform_safe:` in "
                    f"design/targets/{self.id}.yaml.",
                )
            insets = insets.merged(self.platform_safe[platform])
        return FULL_FRAME.inset(insets)

    def occluded(self, platform: str) -> list[Box]:
        """The regions a platform's own UI covers.

        Used by lint to report a collision rather than let a label ship under a
        Reels caption.

        Args:
            platform: Platform key.

        Returns:
            Boxes that the platform's chrome sits over.

        Raises:
            DesignError: The profile knows no such platform.
        """
        if platform not in self.platform_safe:
            raise DesignError(f"Target {self.id!r} has no platform {platform!r}")
        insets = self.platform_safe[platform]
        boxes = []
        if insets.bottom:
            boxes.append(Box(0.0, 1.0 - insets.bottom, 1.0, insets.bottom))
        if insets.right:
            boxes.append(Box(1.0 - insets.right, 0.0, insets.right, 1.0))
        if insets.top:
            boxes.append(Box(0.0, 0.0, 1.0, insets.top))
        if insets.left:
            boxes.append(Box(0.0, 0.0, insets.left, 1.0))
        return boxes

    def with_density(self, budget: int) -> Target:
        """A copy with a lower density budget.

        The engine takes the lower of the frame's legibility ceiling and a concept's
        cognitive budget — one number, justified twice.

        Args:
            budget: The competing budget.

        Returns:
            This target, or a copy capped at ``budget``.
        """
        return self if budget >= self.density_budget else replace(self, density_budget=budget)


@cache
def target(name: str) -> Target:
    """A process-wide cached target profile.

    Args:
        name: Profile id.

    Returns:
        The loaded profile.
    """
    return Target.load(name)


def available_targets() -> list[str]:
    """Every target profile the Studio ships, by id."""
    return sorted(p.stem for p in _TARGETS_DIR.glob("*.yaml"))
