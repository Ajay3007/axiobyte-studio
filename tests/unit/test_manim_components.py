"""Contract tests for the reusable components.

These are the ~200 lines the reference episodes re-author per episode. Now that
they are engine code, they get the tests an episode file never had.
"""

from __future__ import annotations

import numpy as np
import pytest

pytest.importorskip("manim", reason="the Manim backend needs manim installed")

from manim import Square

from axiobyte_studio.actions import COPY, DMA_WRITE, Action, Confidence, Cost
from axiobyte_studio.backends.manim.components import (
    cost_meter,
    cross,
    dim,
    glow,
    link,
    pill,
    scrim,
    tag,
    text,
    title_card,
    undim,
)
from axiobyte_studio.backends.manim.space import configure
from axiobyte_studio.design import theme
from axiobyte_studio.layout import Box, target

WIDE = target("16x9")


@pytest.fixture(autouse=True)
def _canvas():
    configure(WIDE)


class TestTypeComponents:
    def test_text_uses_the_ladder(self):
        small = text("x", WIDE, "mono_s", "#FFFFFF")
        large = text("x", WIDE, "display", "#FFFFFF")
        assert large.height > small.height

    def test_pill_contains_its_label(self):
        stamp = pill("ZERO COPY", WIDE, theme().role("mbuf").hue)
        body, label = stamp[0], stamp[1]
        assert body.width > label.width
        assert body.height > label.height

    def test_tag_has_no_container(self):
        assert tag("a reference", WIDE, theme().role("pointer").hue).height > 0

    def test_title_card_carries_its_own_scrim(self):
        card = title_card("A DIFFERENT WAY", WIDE, theme(), theme().role("mbuf").hue, "sub")
        assert len(card) == 2
        assert card[0].z_index < card[1].z_index

    def test_scrim_covers_the_whole_frame(self):
        layer = scrim(WIDE, theme())
        assert layer.width >= 19.2
        assert layer.height >= 10.8


class TestLink:
    """A pointer is an address, not a journey — it must never look like travel."""

    def test_anchors_on_facing_edges_when_source_is_left(self):
        a = Square(side_length=1).move_to(np.array([-4.0, 0.0, 0.0]))
        b = Square(side_length=1).move_to(np.array([4.0, 0.0, 0.0]))
        arrow = link(a, b, "#F5D14F")
        assert arrow.get_start()[0] > a.get_center()[0]  # leaves a's right
        assert arrow.get_end()[0] < b.get_center()[0]  # arrives at b's left

    def test_anchors_on_facing_edges_when_source_is_right(self):
        # The bug this test exists for: assuming left-to-right made the arrow wrap
        # back across the frame, cutting through whatever lay between.
        a = Square(side_length=1).move_to(np.array([4.0, 0.0, 0.0]))
        b = Square(side_length=1).move_to(np.array([-4.0, 0.0, 0.0]))
        arrow = link(a, b, "#F5D14F")
        assert arrow.get_start()[0] < a.get_center()[0]  # leaves a's LEFT
        assert arrow.get_end()[0] > b.get_center()[0]  # arrives at b's right

    def test_uses_vertical_edges_when_the_offset_is_mostly_vertical(self):
        a = Square(side_length=1).move_to(np.array([0.0, 4.0, 0.0]))
        b = Square(side_length=1).move_to(np.array([0.0, -4.0, 0.0]))
        arrow = link(a, b, "#F5D14F")
        assert arrow.get_start()[1] < a.get_center()[1]  # leaves a's bottom
        assert arrow.get_end()[1] > b.get_center()[1]  # arrives at b's top

    def test_is_straight(self):
        a = Square(side_length=1).move_to(np.array([-3.0, 0.0, 0.0]))
        b = Square(side_length=1).move_to(np.array([3.0, 0.0, 0.0]))
        arrow = link(a, b, "#F5D14F")
        assert arrow.get_start()[1] == pytest.approx(arrow.get_end()[1], abs=0.01)


class TestCostMeter:
    def test_refuses_to_print_an_unproven_number(self):
        # COPY's cost is ORDER confidence: relative claims only.
        meter = cost_meter(COPY, Box(0.1, 0.1, 0.5, 0.2), WIDE, theme())
        label = meter[2]
        assert "cyc" not in label.text
        assert "copy" in label.text

    def test_prints_a_measured_number(self):
        measured = Action(
            name="memcpy",
            subjects=("packet",),
            motion="copy.duplicate_translate",
            cost=Cost(cycles=1800, confidence=Confidence.EXACT, source="measured on Skylake"),
            negation="no copy",
        )
        meter = cost_meter(measured, Box(0.1, 0.1, 0.5, 0.2), WIDE, theme())
        # Manim strips whitespace out of Text.text, so check the parts.
        rendered = meter[2].text
        assert "1800" in rendered and "cyc" in rendered

    def test_copy_is_the_only_action_that_gets_the_copy_hue(self):
        red = theme().role("copy").hue
        copy_meter = cost_meter(COPY, Box(0.1, 0.1, 0.5, 0.2), WIDE, theme())
        dma_meter = cost_meter(DMA_WRITE, Box(0.1, 0.1, 0.5, 0.2), WIDE, theme())
        assert copy_meter[1].get_fill_color().to_hex().upper() == red.upper()
        assert dma_meter[1].get_fill_color().to_hex().upper() != red.upper()


class TestEffects:
    def test_glow_sits_behind_its_subject(self):
        shape = Square(side_length=2)
        halo = glow(shape, "#4AA8FF")
        assert halo.z_index == 0
        assert len(halo) == 5

    def test_glow_layers_fade_outward(self):
        halo = glow(Square(side_length=2), "#4AA8FF")
        opacities = [m.get_stroke_opacity() for m in halo]
        assert opacities == sorted(opacities, reverse=True)

    def test_dim_and_undim_produce_animations(self):
        a, b = Square(), Square()
        assert len(dim(a, b)) == 2
        assert len(undim(a, b)) == 2

    def test_cross_marks_an_absence(self):
        mark = cross(np.array([0.0, 0.0, 0.0]), theme().role("copy").hue)
        assert len(mark) == 2
        assert mark.z_index > 0
