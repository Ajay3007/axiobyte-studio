"""Actor silhouettes — the Manim implementation of the visual language.

Every shape here realises a ``silhouette`` declared in ``design/language.yaml``, and
every colour comes from a role rather than a value. A shape that invents its own
hue, or gives a concept a silhouette the registry did not declare, is a bug in this
file rather than a style choice.

The load-bearing one is ``byte_cells``: the packet's payload is drawn as individual
cells so that a copy has something to move and stillness has something to be still.
Drawn as one undivided block, the zero-copy argument has nothing to make.
"""

from __future__ import annotations

from typing import Any

from manim import (
    DOWN,
    LEFT,
    RIGHT,
    UP,
    Arrow,
    Line,
    RoundedRectangle,
    Text,
    VGroup,
)

from axiobyte_studio.actors.base import Actor
from axiobyte_studio.backends.manim.space import center_of, size_of, units
from axiobyte_studio.core.errors import ConceptError
from axiobyte_studio.design.theme import Theme, visual_language
from axiobyte_studio.layout.frame import Box, Target
from axiobyte_studio.typography.style import style

_CORNER = units(14)


def _title_inside(text: str, panel: RoundedRectangle, target: Target, colour: str) -> Text:
    """Place a component's title INSIDE its own box, against the top edge.

    Never ``next_to(panel, UP)``. A label placed outside the box escapes the region
    the layout solver allotted and lands in a neighbour's space — invisible when
    siblings are side by side, and an obvious collision the moment the same shot
    reflows to a vertical chain. Every part of an actor stays inside its box.
    """
    label = _label(text, target, "mono_s", colour)
    label.move_to(panel.get_top() + DOWN * (label.height / 2 + units(14)))
    return label


def _label(text: str, target: Target, rung: str, colour: str) -> Text:
    """One label at a ladder rung, in the face that rung declares."""
    text_style = style(rung, target)
    return Text(
        text,
        font=text_style.faces[-1],
        font_size=text_style.size_px,
        color=colour,
        weight="BOLD" if text_style.weight == "bold" else "NORMAL",
    )


def _panel(box: Box, target: Target, hue: str, surface: str | None) -> RoundedRectangle:
    """The frame every component shares."""
    width, height = size_of(box, target)
    panel = RoundedRectangle(
        width=width,
        height=height,
        corner_radius=_CORNER,
        stroke_color=hue,
        stroke_width=3,
        fill_color=surface or hue,
        fill_opacity=0.45 if surface else 0.12,
    )
    return panel.move_to(center_of(box, target))


def byte_cells(box: Box, target: Target, hue: str, count: int = 6) -> VGroup:
    """The payload, drawn as individual bytes.

    Args:
        box: Where the cells sit.
        target: The format being rendered.
        hue: The packet role's colour.
        count: How many cells to draw.

    Returns:
        The cells, arranged in a row.
    """
    width, height = size_of(box, target)
    # Capped so the payload leaves room for its own address label above it. A
    # packet's bytes and the address they live at must both be legible — the whole
    # zero-copy argument is that those two things stay bound together.
    cell_w = min(width / (count * 1.3), height * 0.40)
    cells = VGroup(
        *[
            RoundedRectangle(
                width=cell_w,
                height=cell_w * 1.5,
                corner_radius=units(5),
                stroke_color=hue,
                stroke_width=1.4,
                fill_color=hue,
                fill_opacity=0.85,
            )
            for _ in range(count)
        ]
    )
    cells.arrange(RIGHT, buff=cell_w * 0.22)
    return cells.move_to(center_of(box, target) + DOWN * height * 0.08)


def draw_packet(actor: Actor, box: Box, target: Target, theme: Theme) -> VGroup:
    """A packet: its bytes, and the address they live at."""
    hue = theme.role("packet").hue
    cells = byte_cells(box, target, hue)
    address = _label(str(actor.props.get("address", "")), target, "mono_s", hue)
    top = center_of(box, target) + UP * (size_of(box, target)[1] / 2)
    address.move_to(top + DOWN * (address.height / 2 + units(6)))
    return VGroup(cells, address)


def draw_memory_buffer(actor: Actor, box: Box, target: Target, theme: Theme) -> VGroup:
    """A buffer: a memory frame holding payload, or holding nothing yet."""
    role = theme.role("memory")
    panel = _panel(box, target, role.hue, role.surface)
    title = _title_inside("packet buffer", panel, target, role.hue)
    group = VGroup(panel, title)
    if actor.state == "filled":
        group.add(byte_cells(box, target, theme.role("packet").hue))
    return group


def draw_mempool(actor: Actor, box: Box, target: Target, theme: Theme) -> VGroup:
    """A pool of preallocated buffers. Must read as plural at a glance."""
    role = theme.role("memory")
    panel = _panel(box, target, role.hue, role.surface)
    width, height = size_of(box, target)
    slots = max(4, min(int(actor.props.get("slots", 8)), 12))
    slot_w = width / (slots * 1.25)
    cells = VGroup(
        *[
            RoundedRectangle(
                width=slot_w,
                height=height * 0.42,
                corner_radius=units(6),
                stroke_color=role.hue,
                stroke_width=1.6,
                fill_color=role.surface or role.hue,
                fill_opacity=0.6,
            )
            for _ in range(slots)
        ]
    ).arrange(RIGHT, buff=slot_w * 0.25)
    cells.move_to(center_of(box, target))
    return VGroup(panel, cells, _title_inside("mempool", panel, target, role.hue))


def draw_mbuf(actor: Actor, box: Box, target: Target, theme: Theme) -> VGroup:
    """The mbuf: metadata, and — crucially — ``buf_addr``.

    Everything above ``buf_addr`` is bookkeeping. ``buf_addr`` is the pointer
    itself, which is why it is the one field drawn in the pointer's own colour.
    """
    role = theme.role("mbuf")
    panel = _panel(box, target, role.hue, role.surface)
    _, height = size_of(box, target)
    fields = VGroup()
    rows = (
        ("data_len", str(actor.props.get("data_len", 1500)), role.hue),
        ("refcount", str(actor.props.get("refcount", 1)), role.hue),
        ("buf_addr", str(actor.props.get("buf_addr", "0x7f3a4c00")), theme.role("pointer").hue),
    )
    for name, value, colour in rows:
        row = VGroup(
            _label(name, target, "mono_s", theme.ink["secondary"]),
            _label(value, target, "mono_s", colour),
        ).arrange(RIGHT, buff=units(24))
        fields.add(row)
    fields.arrange(DOWN, buff=height * 0.09)
    fields.move_to(center_of(box, target) + DOWN * height * 0.06)
    return VGroup(panel, fields, _title_inside("mbuf", panel, target, role.hue))


def draw_pointer(actor: Actor, box: Box, target: Target, theme: Theme) -> VGroup:
    """A pointer: a thin arrow, and nothing else.

    Never curved. A pointer is an address, not a journey.
    """
    hue = theme.role("pointer").hue
    width, _ = size_of(box, target)
    centre = center_of(box, target)
    arrow = Arrow(
        start=centre + LEFT * width * 0.45,
        end=centre + RIGHT * width * 0.45,
        color=hue,
        stroke_width=6,
        buff=0,
        max_tip_length_to_length_ratio=0.12,
    )
    return VGroup(arrow)


def _board(box: Box, target: Target, theme: Theme, role_name: str, title: str) -> VGroup:
    """A hardware component: a board with a label. Tier-1 flat fidelity."""
    role = theme.role(role_name)
    panel = _panel(box, target, role.hue, role.surface)
    label = _label(title, target, "node", role.hue).move_to(center_of(box, target))
    return VGroup(panel, label)


def draw_nic(actor: Actor, box: Box, target: Target, theme: Theme) -> VGroup:
    """A NIC, with its receive queues drawn as a stack."""
    group = _board(box, target, theme, "nic", str(actor.props.get("label", "NIC")))
    role = theme.role("nic")
    _, height = size_of(box, target)
    queues = min(int(actor.props.get("rx_queues", 4)), 8)
    marks = VGroup(
        *[
            Line(
                start=LEFT * units(26),
                end=RIGHT * units(26),
                stroke_color=role.hue,
                stroke_width=2,
            )
            for _ in range(queues)
        ]
    ).arrange(DOWN, buff=height * 0.045)
    marks.move_to(group[0].get_center() + DOWN * height * 0.30)
    return VGroup(*group, marks)


def draw_cpu(actor: Actor, box: Box, target: Target, theme: Theme) -> VGroup:
    """A CPU die, with its cores."""
    return _board(box, target, theme, "cpu", f"CPU x{actor.props.get('cores', 4)}")


#: Concept to renderer. A concept with no entry cannot be drawn, by design.
RENDERERS: dict[str, Any] = {
    "packet": draw_packet,
    "memory_buffer": draw_memory_buffer,
    "mempool": draw_mempool,
    "mbuf": draw_mbuf,
    "pointer": draw_pointer,
    "nic": draw_nic,
    "cpu": draw_cpu,
}


def draw(actor: Actor, box: Box, target: Target, theme: Theme) -> VGroup:
    """Draw one actor into a box.

    Args:
        actor: The actor to draw.
        box: Where the layout solver placed it.
        target: The format being rendered.
        theme: The theme supplying values for its role.

    Returns:
        The drawn group, positioned and z-ordered.

    Raises:
        ConceptError: This backend has no renderer for that concept. Reported at
            plan time rather than mid-render.
    """
    try:
        renderer = RENDERERS[actor.concept]
    except KeyError:
        raise ConceptError(
            f"The Manim backend cannot draw a {actor.concept!r}",
            context={"can draw": ", ".join(sorted(RENDERERS))},
            fix=(
                f"Add a draw_{actor.concept}() to backends/manim/shapes.py and "
                "register it in RENDERERS."
            ),
        ) from None
    group: VGroup = renderer(actor, box, target, theme)
    visual = visual_language().concept(actor.concept)
    group.set_z_index(_Z_BANDS.get(visual.silhouette, 2))
    return group


#: Silhouette to z-band, from ``design/tokens/depth.yaml``. The packet sits above
#: the machine that carries it.
_Z_BANDS = {
    "byte_cells": 7,
    "framed_region": 2,
    "slot_grid": 2,
    "metadata_card": 9,
    "thin_arrow": 5,
    "board": 2,
    "die_with_cores": 2,
    "beam": 3,
}
