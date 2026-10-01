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
from axiobyte_studio.backends.manim import iso
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


def draw_cache_line(actor: Actor, box: Box, target: Target, theme: Theme) -> VGroup:
    """A cache line: 64 bytes, drawn as cells.

    Never one undivided block. False sharing is only visible if two variables can
    be seen landing on the SAME line, which needs the line to have parts.
    """
    role = theme.role("memory")
    panel = _panel(box, target, role.hue, role.surface)
    cells = byte_cells(box, target, role.hue, count=8)
    title = _title_inside("64B line", panel, target, role.hue)
    return VGroup(panel, cells, title)


def draw_thread(actor: Actor, box: Box, target: Target, theme: Theme) -> VGroup:
    """A thread: one lane, never shared with another thread."""
    role = theme.role("cpu")
    panel = _panel(box, target, role.hue, role.surface)
    label = _label(str(actor.props.get("label", "thread")), target, "row", role.hue)
    label.move_to(center_of(box, target))
    return VGroup(panel, label)


def draw_worker_core(actor: Actor, box: Box, target: Target, theme: Theme) -> VGroup:
    """A core dedicated to one job, so its cache stays warm."""
    return _board(box, target, theme, "cpu", str(actor.props.get("label", "core")))


def draw_nic_queue(actor: Actor, box: Box, target: Target, theme: Theme) -> VGroup:
    """A ring of descriptors the card fills and software drains."""
    role = theme.role("nic")
    panel = _panel(box, target, role.hue, role.surface)
    cells = byte_cells(box, target, role.hue, count=min(int(actor.props.get("slots", 8)), 10))
    return VGroup(panel, cells, _title_inside("rx queue", panel, target, role.hue))


def _board(box: Box, target: Target, theme: Theme, role_name: str, title: str) -> VGroup:
    """A hardware component: a board with a label. Tier-1 flat fidelity."""
    role = theme.role(role_name)
    panel = _panel(box, target, role.hue, role.surface)
    label = _label(title, target, "node", role.hue).move_to(center_of(box, target))
    return VGroup(panel, label)


def draw_nic_iso(actor: Actor, box: Box, target: Target, theme: Theme) -> VGroup:
    """A NIC as an isometric board with a controller die on it.

    Tier-1 3D: three shaded faces, no renderer, no per-frame cost. Same role
    colour, same box, same verbs as the flat fidelity — a shot asks for a NIC and
    the fidelity decides how solid it looks.
    """
    role = theme.role("nic")
    ground = theme.ground["bg"]
    inner = Box(box.x, box.y, box.w, box.h * 0.78)
    board = iso.slab(inner, target, role.hue, ground, thickness=0.10, depth=0.55)
    die = iso.chip(board, theme.role("cpu").hue, ground, size=0.26, at=(0.62, 0.38))
    label = _label(str(actor.props.get("label", "NIC")), target, "node", role.hue)
    bottom = center_of(box, target) + DOWN * (size_of(box, target)[1] / 2)
    label.move_to(bottom + UP * (label.height / 2 + units(6)))
    return VGroup(board, die, label)


def draw_cpu_iso(actor: Actor, box: Box, target: Target, theme: Theme) -> VGroup:
    """A CPU as an isometric package with a die on top."""
    role = theme.role("cpu")
    ground = theme.ground["bg"]
    inner = Box(box.x, box.y, box.w, box.h * 0.78)
    package = iso.slab(inner, target, role.hue, ground, thickness=0.13, depth=0.62)
    die = iso.chip(package, theme.role("mbuf").hue, ground, size=0.40, at=(0.5, 0.5))
    label = _label(f"CPU x{actor.props.get('cores', 4)}", target, "node", role.hue)
    bottom = center_of(box, target) + DOWN * (size_of(box, target)[1] / 2)
    label.move_to(bottom + UP * (label.height / 2 + units(6)))
    return VGroup(package, die, label)


def draw_cache_line_iso(actor: Actor, box: Box, target: Target, theme: Theme) -> VGroup:
    """A cache hierarchy as stacked slabs — the shape a hierarchy actually is."""
    ground = theme.ground["bg"]
    hues = [theme.role(r).hue for r in ("memory", "memory", "mbuf")]
    return iso.stack(box, target, hues, ground)


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


def draw_phy(actor: Actor, box: Box, target: Target, theme: Theme) -> VGroup:
    """The physical-layer chip: where the analog line meets digital bits."""
    return _board(box, target, theme, "nic", str(actor.props.get("label", "PHY")))


def draw_magnetics(actor: Actor, box: Box, target: Target, theme: Theme) -> VGroup:
    """The isolation transformers behind a port."""
    return _board(box, target, theme, "nic", str(actor.props.get("label", "magnetics")))


def draw_pcie(actor: Actor, box: Box, target: Target, theme: Theme) -> VGroup:
    """The card's only road to the host, labelled with its width."""
    label = str(actor.props.get("label", "PCIe"))
    return _board(box, target, theme, "nic", f"{label} x{actor.props.get('lanes', 8)}")


def draw_descriptor_ring(actor: Actor, box: Box, target: Target, theme: Theme) -> VGroup:
    """Slots in host memory, each pointing at a free buffer for the NIC to fill."""
    role = theme.role("memory")
    panel = _panel(box, target, role.hue, role.surface)
    cells = byte_cells(box, target, role.hue, count=min(int(actor.props.get("slots", 8)), 10))
    return VGroup(panel, cells, _title_inside("descriptor ring", panel, target, role.hue))


def draw_host_memory(actor: Actor, box: Box, target: Target, theme: Theme) -> VGroup:
    """Host memory: one address space, with a descriptor ring and packet buffers allocated in it.

    A logical view, drawn as a strip of regions along the address axis — never as the NIC's, and
    never as a chip. The ring and the buffers sit among other memory, because that is where they
    are: allocations in ordinary DRAM.
    """
    role = theme.role("memory")
    idle = theme.role("idle")
    panel = _panel(box, target, role.hue, role.surface)
    title = _title_inside(str(actor.props.get("label", "host memory")), panel, target, role.hue)
    width, height = size_of(box, target)
    strip_h = height * 0.42
    inner_w = width * 0.9
    # Other memory · descriptor ring · packet buffers · free, low address to high.
    shares = (0.26, 0.2, 0.36, 0.18)
    gap = inner_w * 0.02
    segments = VGroup()
    for share, hue in zip(shares, (idle.hue, role.hue, role.hue, idle.hue), strict=True):
        segments.add(
            RoundedRectangle(
                width=inner_w * share - gap,
                height=strip_h,
                corner_radius=units(6),
                stroke_color=hue,
                stroke_width=2,
                fill_color=hue,
                fill_opacity=0.12,
            )
        )
    segments.arrange(RIGHT, buff=gap)
    segments.move_to(center_of(box, target) + DOWN * height * 0.12)
    ring, buffers = segments[1], segments[2]
    slots = VGroup(
        *[
            RoundedRectangle(
                width=ring.width * 0.7,
                height=strip_h * 0.12,
                corner_radius=units(3),
                stroke_color=role.hue,
                stroke_width=1.2,
                fill_color=role.hue,
                fill_opacity=0.5,
            )
            for _ in range(5)
        ]
    ).arrange(DOWN, buff=strip_h * 0.05)
    slots.move_to(ring.get_center())
    frames = VGroup(
        *[
            RoundedRectangle(
                width=buffers.width * 0.26,
                height=strip_h * 0.6,
                corner_radius=units(4),
                stroke_color=role.hue,
                stroke_width=1.4,
                fill_opacity=0,
            )
            for _ in range(3)
        ]
    ).arrange(RIGHT, buff=buffers.width * 0.06)
    frames.move_to(buffers.get_center())
    names = VGroup()
    for segment, text, hue in zip(
        segments,
        ("other memory", "descriptor ring", "packet buffers", "free"),
        (theme.ink["secondary"], role.hue, role.hue, theme.ink["secondary"]),
        strict=True,
    ):
        name = _label(text, target, "mono_s", hue)
        if name.width > segment.width * 0.94:
            name.scale_to_fit_width(segment.width * 0.94)
        name.next_to(segment, DOWN, buff=units(10))
        names.add(name)
    return VGroup(panel, title, segments, slots, frames, names)


#: Concept to isometric renderer. A concept absent here has no Tier-1 3D form,
#: which is the common case: a packet is a run of bytes, not a solid.
ISO_RENDERERS: dict[str, Any] = {
    "nic": draw_nic_iso,
    "cpu": draw_cpu_iso,
    "worker_core": draw_cpu_iso,
    "cache_line": draw_cache_line_iso,
}

#: Concept to renderer. A concept with no entry cannot be drawn, by design.
RENDERERS: dict[str, Any] = {
    "cache_line": draw_cache_line,
    "nic_queue": draw_nic_queue,
    "packet": draw_packet,
    "thread": draw_thread,
    "worker_core": draw_worker_core,
    "memory_buffer": draw_memory_buffer,
    "mempool": draw_mempool,
    "mbuf": draw_mbuf,
    "pointer": draw_pointer,
    "nic": draw_nic,
    "cpu": draw_cpu,
    "phy": draw_phy,
    "magnetics": draw_magnetics,
    "pcie": draw_pcie,
    "descriptor_ring": draw_descriptor_ring,
    "host_memory": draw_host_memory,
}


def draw(
    actor: Actor,
    box: Box,
    target: Target,
    theme: Theme,
    fidelity: str = "flat",
) -> VGroup:
    """Draw one actor into a box, at a chosen fidelity.

    Fidelity is a rendering decision, not a semantic one. The same actor, the same
    role, the same verbs — only how solid it looks changes. A shot asks for a NIC;
    whether it is a flat panel or an isometric board is the shot's framing choice,
    and switching costs nothing because the box and the role are unchanged.

    Args:
        actor: The actor to draw.
        box: Where the layout solver placed it.
        target: The format being rendered.
        theme: The theme supplying values for its role.
        fidelity: ``"flat"`` or ``"iso"``. See ``ARCHITECTURE.md`` §8.0.

    Returns:
        The drawn group, positioned and z-ordered.

    Raises:
        ConceptError: This backend has no renderer for that concept at that
            fidelity. Reported by name rather than silently falling back — a
            silent downgrade is how a hero shot ships flat.
    """
    if fidelity == "iso":
        try:
            renderer = ISO_RENDERERS[actor.concept]
        except KeyError:
            raise ConceptError(
                f"{actor.concept!r} has no isometric form",
                context={"iso concepts": ", ".join(sorted(ISO_RENDERERS))},
                fix=(
                    f"Draw it flat, or add a draw_{actor.concept}_iso() to "
                    "backends/manim/shapes.py. Most concepts should stay flat — a "
                    "packet is a run of bytes, not a solid."
                ),
            ) from None
        group_iso: VGroup = renderer(actor, box, target, theme)
        group_iso.set_z_index(_Z_BANDS.get(visual_language().concept(actor.concept).silhouette, 2))
        return group_iso

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
    "line_cells": 7,
    "lane": 2,
    "framed_region": 2,
    "slot_grid": 2,
    "metadata_card": 9,
    "thin_arrow": 5,
    "board": 2,
    "die_with_cores": 2,
    "beam": 3,
}
