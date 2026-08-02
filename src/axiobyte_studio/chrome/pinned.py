"""Pinned chrome — the furniture that rides the frame, not the scene.

The reference episodes solved this well and it is worth restating why: the chapter
keyword and the caption are attached to ``camera.frame`` via updaters, so a push-in
neither crops them nor scales them into a second copy of themselves. Chrome belongs
to the *viewer*, not to the world being filmed.

This module owns only *where* chrome sits, per format and per platform. What it
looks like is the backend's business, which is why nothing here imports a renderer.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from axiobyte_studio.core.errors import DesignError
from axiobyte_studio.layout.frame import Box, Target
from axiobyte_studio.typography.style import style


class Edge(StrEnum):
    """Which edge a pinned element rides."""

    TOP = "top"
    BOTTOM = "bottom"
    CENTER = "center"


@dataclass(frozen=True, slots=True)
class ChromeSlot:
    """One piece of pinned furniture, placed for a target.

    Attributes:
        name: Which chrome element this is.
        box: Where it sits, in normalised frame coordinates.
        edge: Which edge it rides, which is what an updater needs to know.
        rung: The type ladder rung it renders at.
        max_width: Longest line, as a fraction of frame width.
    """

    name: str
    box: Box
    edge: Edge
    rung: str
    max_width: float


#: Breathing room between a pinned element and the edge it rides, as a fraction of
#: frame height. The reference uses `pad=0.95` layout units — 95 design pixels.
_PAD_PX = 95.0


def _require_platform(target: Target, platform: str | None) -> None:
    """Fail early, and by name, when a target does not know a platform."""
    if platform is not None and platform not in target.platform_safe:
        raise DesignError(
            f"Target {target.id!r} declares no platform-safe zone for {platform!r}",
            context={"declares": ", ".join(sorted(target.platform_safe)) or "none"},
            fix=f"Add `{platform}:` under `platform_safe:` in design/targets/{target.id}.yaml.",
        )


def _band(target: Target, rung: str, edge: Edge, platform: str | None = None) -> Box:
    """A band sized to hold one line of type, inside the platform-aware safe box.

    Placing chrome against ``content_box(platform)`` rather than the frame's own
    safe area is what makes it clear platform UI on **both** axes. A caption that
    only lifts above the Reels action bar still runs under the buttons stacked
    down the right-hand edge.
    """
    _require_platform(target, platform)
    text_style = style(rung, target)
    height = (text_style.size_px * 1.6) / target.canvas_h
    pad = _PAD_PX / target.canvas_h
    safe = target.content_box(platform)
    if edge is Edge.TOP:
        y = safe.y + pad
    elif edge is Edge.BOTTOM:
        y = safe.bottom - pad - height
    else:
        y = 0.5 - height / 2
    return Box(x=safe.x, y=y, w=safe.w, h=height)


def _slot(name: str, target: Target, rung: str, edge: Edge, platform: str | None) -> ChromeSlot:
    """Build a chrome slot whose wrap width respects the space it actually has."""
    box = _band(target, rung, edge, platform)
    return ChromeSlot(
        name=name,
        box=box,
        edge=edge,
        rung=rung,
        max_width=min(target.text_max_width, box.w),
    )


def keyword_bar(target: Target, platform: str | None = None) -> ChromeSlot:
    """The chapter keyword, pinned to the top.

    One keyword at a time, never popped on — it is the viewer's sense of place in
    the argument, so it changes by transition rather than appearing and vanishing.

    Args:
        target: The format to place for.
        platform: Platform whose UI must be cleared.

    Returns:
        Its placement.

    Raises:
        DesignError: The target declares no such platform.
    """
    return _slot("keyword", target, "keyword", Edge.TOP, platform)


def caption_bar(target: Target, platform: str | None = None) -> ChromeSlot:
    """The narration caption, pinned to the bottom.

    In a wide frame this is a lower third. In a vertical one it must clear the
    platform's own interface, which is occlusion rather than taste: a caption under
    the Reels action bar is a caption nobody reads.

    Args:
        target: The format to place for.
        platform: Platform whose UI must be cleared, e.g. ``"reels"``.

    Returns:
        Its placement.

    Raises:
        DesignError: The target declares no such platform.
    """
    return _slot("caption", target, "caption", Edge.BOTTOM, platform)


def title_card(target: Target, platform: str | None = None) -> ChromeSlot:
    """An act title, centred over a scrim.

    Args:
        target: The format to place for.
        platform: Platform whose UI must be cleared.

    Returns:
        Its placement.

    Raises:
        DesignError: The target declares no such platform.
    """
    return _slot("title", target, "display", Edge.CENTER, platform)


def stage_box(target: Target, platform: str | None = None) -> Box:
    """The region left for the scene once chrome has taken its share.

    This is what a shot's relations are actually solved into. Solving against the
    full content box instead is how a diagram ends up under a caption.

    Args:
        target: The format to place for.
        platform: Platform whose UI must be cleared.

    Returns:
        The usable stage, in normalised frame coordinates.
    """
    content = target.content_box(platform)
    top = keyword_bar(target, platform).box
    bottom = caption_bar(target, platform).box
    gap = _PAD_PX / target.canvas_h * 0.5
    y = top.bottom + gap
    return Box(x=content.x, y=y, w=content.w, h=max(0.0, bottom.y - gap - y))


def all_slots(target: Target, platform: str | None = None) -> dict[str, ChromeSlot]:
    """Every pinned element, placed for one target.

    Args:
        target: The format to place for.
        platform: Platform whose UI must be cleared.

    Returns:
        Chrome slots, keyed by name.
    """
    return {
        "keyword": keyword_bar(target, platform),
        "caption": caption_bar(target, platform),
    }
