"""The Manim mempool actor draws the mempool's element model: every element an mbuf and its buffer.

POOL-1: a mempool is a set of identical elements; each element is an mbuf together with the
buffer it describes — the mbuf holds metadata and ``buf_addr``, the buffer holds the packet bytes.
The actor draws that split for every element, names both halves, and draws nothing else: no
state, no address, no numbering, no packet.
"""

from __future__ import annotations

import re
from typing import Any

import pytest

from axiobyte_studio.actors import MEMPOOL

#: Runtime words the pool must never show: allocation, ownership and slot state are not drawn.
STATES = re.compile(r"\b(free|in[ _-]?use|posted|consumed|allocated|ready|done|owned)\b", re.I)


def _draw(slots: int | None = None, target_id: str = "16x9", box: Any = None) -> Any:
    pytest.importorskip("manim", reason="the Manim backend needs manim installed")
    from axiobyte_studio.backends.manim import draw
    from axiobyte_studio.backends.manim.space import configure
    from axiobyte_studio.design import theme
    from axiobyte_studio.layout import Box, target

    fmt = target(target_id)
    configure(fmt)
    actor = MEMPOOL.spawn("1") if slots is None else MEMPOOL.spawn("1", slots=slots)
    return draw(actor, box or Box(0.1, 0.12, 0.8, 0.7), fmt, theme())


def _theme() -> Any:
    from axiobyte_studio.design import theme

    return theme()


def _texts(group: Any) -> list[str]:
    from manim import Text

    return [m.original_text for m in group.get_family() if isinstance(m, Text)]


def _hex(colour: Any) -> str:
    return str(colour.to_hex()).upper()


def test_the_actor_keeps_its_api_and_draws():
    # E02 casts it as MEMPOOL.spawn("1", slots=8); its anchors and props are unchanged.
    assert MEMPOOL.concept == "mempool"
    assert MEMPOOL.anchors == ("first_slot", "last_slot")
    assert MEMPOOL.default_props == {"slots": 16}
    panel, elements, _legend, title = _draw(slots=8)
    from axiobyte_studio.backends.manim.shapes import RENDERERS

    assert "mempool" in RENDERERS
    assert panel.width > 0 and len(elements) == 8 and _texts(title) == ["mempool"]


@pytest.mark.parametrize(("slots", "drawn"), [(None, 12), (8, 8), (16, 12), (2, 4)])
def test_it_draws_a_plural_set_of_identical_elements(slots, drawn):
    _, elements, _, _ = _draw(slots=slots)
    assert len(elements) == drawn  # never fewer than four: a pool must read as plural
    shapes = {(round(e.width, 4), round(e.height, 4), len(e)) for e in elements}
    assert len(shapes) == 1  # every element identical


def test_every_element_is_an_mbuf_half_and_a_buffer_half():
    active = _theme()
    _, elements, _, _ = _draw(slots=8)
    for element in elements:
        mbuf_half, buffer_half = element
        mbuf_rect, buffer_rect = mbuf_half[0], buffer_half[0]
        assert _hex(mbuf_rect.get_stroke_color()) == active.role("mbuf").hue.upper()
        assert _hex(buffer_rect.get_stroke_color()) == active.role("memory").hue.upper()
        # Two separate things, side by side: the metadata the smaller, the buffer the larger.
        assert mbuf_rect.get_right()[0] < buffer_rect.get_left()[0]
        assert mbuf_rect.width < buffer_rect.width


def test_the_halves_are_named_buffer_as_packet_bytes_and_mbuf_with_buf_addr():
    active = _theme()
    _, elements, legend, _ = _draw()
    legend_texts = _texts(legend)
    assert "buffer · packet bytes" in legend_texts
    assert {"mbuf", "buf_addr"} <= set(legend_texts)
    from manim import Text

    by_text = {m.original_text: m for m in legend.get_family() if isinstance(m, Text)}

    # buf_addr is the pointer: drawn in the pointer's colour, as the mbuf actor draws it.
    def ink(text: Any) -> set[str]:
        return {_hex(glyph.get_fill_color()) for glyph in text.family_members_with_points()}

    assert ink(by_text["buf_addr"]) == {active.role("pointer").hue.upper()}
    assert ink(by_text["buffer · packet bytes"]) == {active.role("memory").hue.upper()}
    assert ink(by_text["mbuf"]) == {active.role("mbuf").hue.upper()}
    # Where an element has room, each half carries its own name.
    for mbuf_half, buffer_half in elements:
        assert _texts(mbuf_half) in ([], ["MBUF"])
        assert _texts(buffer_half) in ([], ["BUFFER"])
    assert all(_texts(m) == ["MBUF"] for m, _ in elements)


def test_no_packet_bytes_are_drawn_inside_the_pool_and_none_inside_an_mbuf():
    # The buffer is where the bytes go, not the bytes: no packet hue anywhere in the pool.
    active = _theme()
    group = _draw(slots=8)
    colours = set()
    for mob in group.family_members_with_points():
        colours |= {_hex(mob.get_stroke_color()), _hex(mob.get_fill_color())}
    assert active.role("packet").hue.upper() not in colours
    for mbuf_half, _ in group[1]:
        assert "packet bytes" not in _texts(mbuf_half)


def test_it_shows_no_runtime_state_no_address_and_no_numbering():
    for target_id in ("16x9", "9x16", "1x1"):
        texts = _texts(_draw(target_id=target_id))
        assert not [t for t in texts if STATES.search(t)], texts
        assert not [t for t in texts if "0x" in t], texts  # no buffer address value
        assert not [t for t in texts if re.search(r"\d", t)], texts  # no element-0, mbuf-0, slot-0


def test_the_drawing_is_deterministic():
    def fingerprint(group: Any) -> list[tuple[float, ...]]:
        return [
            tuple(round(float(v), 6) for v in m.points.flatten())
            for m in group.family_members_with_points()
        ]

    assert fingerprint(_draw(slots=8)) == fingerprint(_draw(slots=8))


@pytest.mark.parametrize("target_id", ["16x9", "9x16"])
def test_it_stays_readable_in_s01e02s_boxes(target_id):
    # The boxes s01e02's zero-copy shot solves the pool into: a third of a 16:9 row, and a
    # full-width but short band in 9:16. Elements and legend stay inside the panel, apart.
    from axiobyte_studio.layout import Box

    box = Box(0.362, 0.238, 0.276, 0.291) if target_id == "16x9" else Box(0.05, 0.269, 0.81, 0.103)
    panel, elements, legend, title = _draw(slots=8, target_id=target_id, box=box)
    for part in (elements, legend, title):
        assert (
            part.get_left()[0] >= panel.get_left()[0]
            and part.get_right()[0] <= panel.get_right()[0]
        )
        assert (
            part.get_bottom()[1] >= panel.get_bottom()[1]
            and part.get_top()[1] <= panel.get_top()[1]
        )
    assert elements.get_bottom()[1] > legend.get_top()[1]
    assert elements.get_top()[1] < title.get_bottom()[1]
