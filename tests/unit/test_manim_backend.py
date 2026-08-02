"""Contract tests for the Manim backend.

The load-bearing one is :class:`TestShapesStayInTheirBox`. A shape that draws
outside the region the solver allotted breaks the layout system's guarantee: lint
verifies the *boxes* do not collide, so if the drawing escapes its box, lint is
verifying nothing. It is also invisible in a wide frame — siblings have horizontal
room — and an obvious collision the moment the same shot reflows to vertical.
"""

from __future__ import annotations

import pytest

pytest.importorskip("manim", reason="the Manim backend needs manim installed")

from axiobyte_studio.actors import LIBRARY as ACTORS
from axiobyte_studio.backends.manim import RENDERERS, curves, draw, rate_func
from axiobyte_studio.backends.manim.space import (
    center_of,
    configure,
    frame_size,
    point,
    size_of,
)
from axiobyte_studio.core import ConceptError
from axiobyte_studio.design import theme
from axiobyte_studio.layout import Box, target
from axiobyte_studio.motion import motion, motion_language

TARGETS = ["16x9", "9x16", "1x1"]


class TestSpace:
    def test_origin_maps_to_the_top_left(self):
        wide = target("16x9")
        configure(wide)
        width, height = frame_size(wide)
        top_left = point(0.0, 0.0, wide)
        assert top_left[0] == pytest.approx(-width / 2)
        assert top_left[1] == pytest.approx(height / 2)  # y is flipped

    def test_centre_maps_to_the_origin(self):
        wide = target("16x9")
        assert point(0.5, 0.5, wide) == pytest.approx([0.0, 0.0, 0.0])

    def test_frame_matches_the_reference_unit_scale(self):
        # 1 unit == 100 design pixels, in every format.
        assert frame_size(target("16x9")) == pytest.approx((19.2, 10.8))
        assert frame_size(target("9x16")) == pytest.approx((10.8, 19.2))

    def test_box_size_converts(self):
        assert size_of(Box(0, 0, 0.5, 0.5), target("16x9")) == pytest.approx((9.6, 5.4))


class TestCoverage:
    def test_every_actor_can_be_drawn(self):
        assert not set(ACTORS) - set(RENDERERS)

    def test_every_motion_curve_maps_to_a_rate_function(self):
        for name in motion_language().names:
            assert rate_func(motion(name)) is not None

    def test_curve_vocabulary_is_reported(self):
        assert "elastic_out" in curves()

    def test_missing_renderer_names_the_file(self, monkeypatch):
        from axiobyte_studio.backends.manim import shapes

        monkeypatch.delitem(shapes.RENDERERS, "packet")
        from axiobyte_studio.actors.base import Actor

        with pytest.raises(ConceptError) as exc:
            shapes.draw(Actor("packet", "1"), Box(0.1, 0.1, 0.3, 0.3), target("16x9"), theme())
        assert "backends/manim/shapes.py" in str(exc.value)


class TestShapesStayInTheirBox:
    """Every part of an actor stays inside the region the solver gave it."""

    #: A little slack for stroke width, which straddles the path.
    TOLERANCE = 0.12

    @pytest.mark.parametrize("target_id", TARGETS)
    @pytest.mark.parametrize("concept", sorted(RENDERERS))
    def test_drawing_fits_its_box(self, concept, target_id):
        fmt = target(target_id)
        configure(fmt)
        box = Box(0.1, 0.15, 0.8, 0.35)
        actor = ACTORS[concept].spawn("1")
        group = draw(actor, box, fmt, theme())

        centre = center_of(box, fmt)
        width, height = size_of(box, fmt)
        left, right = centre[0] - width / 2, centre[0] + width / 2
        top, bottom = centre[1] + height / 2, centre[1] - height / 2

        assert group.get_left()[0] >= left - self.TOLERANCE, f"{concept} escapes left"
        assert group.get_right()[0] <= right + self.TOLERANCE, f"{concept} escapes right"
        assert group.get_top()[1] <= top + self.TOLERANCE, f"{concept} escapes above"
        assert group.get_bottom()[1] >= bottom - self.TOLERANCE, f"{concept} escapes below"

    @pytest.mark.parametrize("concept", sorted(RENDERERS))
    def test_drawing_is_not_empty(self, concept):
        fmt = target("16x9")
        configure(fmt)
        group = draw(ACTORS[concept].spawn("1"), Box(0.1, 0.15, 0.8, 0.35), fmt, theme())
        assert group.width > 0 and group.height > 0


def _colours(group) -> set[str]:
    """Every stroke and fill colour in a drawn group, upper-cased."""
    found = set()
    for mob in group.family_members_with_points():
        found.add(mob.get_stroke_color().to_hex().upper())
        found.add(mob.get_fill_color().to_hex().upper())
    return found


class TestVisualLanguageIsHonoured:
    def test_shapes_use_role_colours(self):
        fmt = target("16x9")
        configure(fmt)
        active = theme()
        group = draw(ACTORS["nic"].spawn("1"), Box(0.1, 0.1, 0.4, 0.4), fmt, active)
        assert active.role("nic").hue.upper() in _colours(group)

    def test_the_packet_is_drawn_as_separable_cells(self):
        # Not one undivided block: a copy must have something to move, and
        # stillness must have something to be still.
        fmt = target("16x9")
        configure(fmt)
        group = draw(ACTORS["packet"].spawn("1"), Box(0.1, 0.1, 0.6, 0.3), fmt, theme())
        cells = group[0]
        assert len(cells) >= 4

    def test_the_mbuf_shows_buf_addr_in_the_pointer_colour(self):
        # buf_addr IS the pointer; everything above it is bookkeeping.
        fmt = target("16x9")
        configure(fmt)
        active = theme()
        group = draw(ACTORS["mbuf"].spawn("1"), Box(0.1, 0.1, 0.5, 0.5), fmt, active)
        assert active.role("pointer").hue.upper() in _colours(group)
