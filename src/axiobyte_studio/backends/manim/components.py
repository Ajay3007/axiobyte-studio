"""Composable pieces the reference episodes re-author every time.

``glow``, ``pill``, ``tag``, ``link``, ``cost_meter``, ``scrim``, ``title_card``,
``dim`` — roughly 200 lines that live *inside* each episode file today and get
copied to the next one. Here they are engine code: versioned, tested, and identical
in every episode and every format.

Two carry meaning rather than decoration:

* ``link`` draws a pointer between two **anchors**, so ``mbuf.buf_addr →
  packet.first_byte`` survives a re-layout, a format change and a backend swap.
* ``cost_meter`` renders an action's cost, and refuses to print an absolute number
  unless the cost carries provenance.
"""

from __future__ import annotations

from typing import Any

import numpy as np
from manim import (
    DOWN,
    LEFT,
    UP,
    Arrow,
    Rectangle,
    RoundedRectangle,
    Text,
    VGroup,
)

from axiobyte_studio.actions.base import Action, Confidence
from axiobyte_studio.backends.manim.space import center_of, frame_size, size_of, units
from axiobyte_studio.design.theme import Theme
from axiobyte_studio.layout.frame import Box, Target
from axiobyte_studio.typography.style import style


def text(content: str, target: Target, rung: str, colour: str, weight: str | None = None) -> Text:
    """One text run at a ladder rung.

    Args:
        content: The text.
        target: The format being rendered.
        rung: Which rung of the type ladder.
        colour: Its colour, already resolved from a role.
        weight: Override the rung's weight.

    Returns:
        The text mobject.
    """
    text_style = style(rung, target)
    resolved = weight or text_style.weight
    return Text(
        content,
        font=text_style.faces[-1],
        font_size=text_style.size_px,
        color=colour,
        weight="BOLD" if resolved == "bold" else "NORMAL",
    )


def glow(
    shape: Any, colour: str, layers: int = 5, spread: float = 0.24, max_opacity: float = 0.13
) -> VGroup:
    """A soft halo, built from concentric copies of a shape.

    Args:
        shape: The mobject to glow around.
        colour: The halo colour, from the subject's own role.
        layers: How many copies to stack.
        spread: How far the outermost copy extends, in Manim units.
        max_opacity: Opacity of the innermost layer.

    Returns:
        The halo, to be added *behind* its subject.
    """
    halo = VGroup()
    for index in range(layers):
        step = (index + 1) / layers
        copy = shape.copy()
        copy.set_stroke(
            color=colour, width=1 + step * spread * 40, opacity=max_opacity * (1 - step)
        )
        copy.set_fill(opacity=0)
        halo.add(copy)
    halo.set_z_index(0)
    return halo


def pill(
    content: str, target: Target, colour: str, surface: str | None = None, rung: str = "node"
) -> VGroup:
    """A rounded label — a stamp, a verdict, a state.

    Args:
        content: The label.
        target: The format being rendered.
        colour: Its role colour.
        surface: Fill colour, when the role has one.
        rung: Type ladder rung.

    Returns:
        The pill.
    """
    label = text(content, target, rung, colour)
    body = RoundedRectangle(
        width=label.width + units(52),
        height=label.height + units(30),
        corner_radius=(label.height + units(30)) / 2,
        stroke_color=colour,
        stroke_width=2.5,
        fill_color=surface or colour,
        fill_opacity=0.5 if surface else 0.12,
    )
    return VGroup(body, label.move_to(body.get_center()))


def tag(content: str, target: Target, colour: str) -> Text:
    """A small annotation, with no container.

    Args:
        content: The annotation.
        target: The format being rendered.
        colour: Its role colour.

    Returns:
        The tag.
    """
    return text(content, target, "tag", colour)


def link(source: Any, destination: Any, colour: str, stroke: float = 6.0) -> Arrow:
    """A pointer from one anchor to another.

    Straight, always. A pointer is an address, not a journey — a curved link would
    read as travel, which is the opposite of what a reference means.

    Args:
        source: The mobject the pointer leaves.
        destination: The mobject it addresses.
        colour: The pointer role's colour.
        stroke: Line weight.

    Returns:
        The arrow.
    """
    # Anchor on whichever edges actually face each other. Assuming the source sits
    # left of the destination makes the arrow wrap back across the frame the moment
    # it does not — which reads as a pointer travelling *through* whatever lies
    # between, and travel is the one thing a pointer must never look like.
    sx, sy, _ = source.get_center()
    dx, dy, _ = destination.get_center()
    if abs(dx - sx) >= abs(dy - sy):
        start = source.get_right() if dx > sx else source.get_left()
        end = destination.get_left() if dx > sx else destination.get_right()
    else:
        start = source.get_bottom() if dy < sy else source.get_top()
        end = destination.get_top() if dy < sy else destination.get_bottom()
    return Arrow(
        start=start,
        end=end,
        color=colour,
        stroke_width=stroke,
        buff=units(8),
        max_tip_length_to_length_ratio=0.10,
    )


def scrim(target: Target, theme: Theme, opacity: float = 0.9) -> Rectangle:
    """A full-frame dimming layer, for a title card to sit over.

    Args:
        target: The format being rendered.
        theme: The theme supplying the canvas colour.
        opacity: How much it hides.

    Returns:
        The scrim, at the scrim z-band.
    """
    width, height = frame_size(target)
    layer = Rectangle(
        width=width * 1.1,
        height=height * 1.1,
        stroke_width=0,
        fill_color=theme.ground["bg"],
        fill_opacity=opacity,
    )
    layer.set_z_index(20)
    return layer


def title_card(
    heading: str, target: Target, theme: Theme, colour: str, subtitle: str = ""
) -> VGroup:
    """An act title over a scrim.

    Args:
        heading: The act title.
        target: The format being rendered.
        theme: The theme supplying canvas and ink.
        colour: The role colour for the heading.
        subtitle: An optional line beneath.

    Returns:
        The scrim and the type, z-ordered above everything else.
    """
    lines = VGroup(text(heading, target, "display", colour, weight="bold"))
    if subtitle:
        lines.add(text(subtitle, target, "caption", theme.ink["secondary"]))
    lines.arrange(DOWN, buff=units(22))
    lines.set_z_index(21)
    return VGroup(scrim(target, theme), lines)


def cost_meter(
    action: Action, box: Box, target: Target, theme: Theme, fraction: float = 0.85
) -> VGroup:
    """A bar showing what an action costs.

    Refuses to print an absolute figure unless the cost is ``EXACT`` and cites a
    source. A wrong number in a systems video is remembered and quoted back, so the
    default is a relative reading — which also survives hardware generations.

    Args:
        action: The action whose cost to show.
        box: Where the meter sits.
        target: The format being rendered.
        theme: The theme supplying role values.
        fraction: How full the bar is.

    Returns:
        The meter.
    """
    role = theme.role("copy" if action.name == "copy" else "idle")
    width, height = size_of(box, target)
    bar_h = min(height * 0.34, units(44))
    track = RoundedRectangle(
        width=width,
        height=bar_h,
        corner_radius=bar_h / 2,
        stroke_color=theme.ground["border"],
        stroke_width=2,
        fill_color=theme.ground["surface"],
        fill_opacity=1.0,
    )
    fill = RoundedRectangle(
        width=max(width * fraction, bar_h),
        height=bar_h,
        corner_radius=bar_h / 2,
        stroke_width=0,
        fill_color=role.hue,
        fill_opacity=0.85,
    )
    fill.align_to(track, LEFT)

    caption = action.name if not action.cost.displayable else _exact(action)
    label = text(caption, target, "mono_s", role.hue)
    group = VGroup(track, fill, label)
    label.next_to(track, UP, buff=units(10))
    group.move_to(center_of(box, target))
    return group


def _exact(action: Action) -> str:
    """Render a cost figure, only ever for an EXACT cost."""
    if action.cost.confidence is not Confidence.EXACT:
        return action.name
    parts = [action.name]
    if action.cost.cycles is not None:
        parts.append(f"{action.cost.cycles:g} cyc")
    if action.cost.nanoseconds is not None:
        parts.append(f"{action.cost.nanoseconds:g} ns")
    return "  ".join(parts)


def dim(*mobjects: Any, factor: float = 0.20) -> list[Any]:
    """Push things into the background so one thing can be primary.

    Args:
        *mobjects: What to recede.
        factor: Remaining opacity.

    Returns:
        The animations to play.
    """
    return [mob.animate.set_opacity(factor) for mob in mobjects]


def undim(*mobjects: Any) -> list[Any]:
    """Restore what :func:`dim` pushed back.

    Args:
        *mobjects: What to restore.

    Returns:
        The animations to play.
    """
    return [mob.animate.set_opacity(1.0) for mob in mobjects]


def cross(centre: np.ndarray, colour: str, size: float = 0.7) -> VGroup:
    """A struck-out mark — the staged *absence* of an action.

    Every action declares a ``negation``; this is how the common ones look. The
    absence of a thing has to be drawn, or "and this does not happen" is only ever
    narration.

    Args:
        centre: Where it sits, in Manim coordinates.
        colour: Its role colour.
        size: Arm length, in Manim units.

    Returns:
        The cross.
    """
    half = size / 2
    strokes = VGroup(
        *[
            Arrow(
                start=centre + np.array([-half * sx, -half, 0.0]),
                end=centre + np.array([half * sx, half, 0.0]),
                color=colour,
                stroke_width=7,
                buff=0,
                max_tip_length_to_length_ratio=0.0,
            )
            for sx in (1, -1)
        ]
    )
    strokes.set_z_index(9)
    return strokes
