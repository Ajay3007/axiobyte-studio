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


class TestAtomicMeansDrawable:
    """ "Atomic" is a promise that the thing can be drawn. Holding it to that.

    Four atomic concepts once had no visual identity and no actor, so nothing
    could ever draw them — cache_line, thread, worker_core and nic_queue, which
    are precisely what episodes 3 to 5 need.
    """

    def test_every_atomic_concept_has_a_visual_identity(self):
        from axiobyte_studio.concepts import ConceptKind, registry
        from axiobyte_studio.design import visual_language

        atomic = {c.id for c in registry().of_kind(ConceptKind.ATOMIC)}
        missing = sorted(atomic - set(visual_language().concepts))
        assert not missing, f"atomic but undrawable: {missing}"

    def test_every_atomic_concept_has_an_actor(self):
        from axiobyte_studio.concepts import ConceptKind, registry

        atomic = {c.id for c in registry().of_kind(ConceptKind.ATOMIC)}
        assert not sorted(atomic - set(ACTORS))

    def test_every_actor_has_a_flat_renderer(self):
        assert not sorted(set(ACTORS) - set(RENDERERS))


class TestIsoFidelity:
    """Tier-1 3D: solid without a renderer, and contained like everything else."""

    TOLERANCE = 0.12

    def test_iso_concepts_are_all_drawable_actors(self):
        from axiobyte_studio.backends.manim import ISO_RENDERERS

        assert not sorted(set(ISO_RENDERERS) - set(ACTORS))

    @pytest.mark.parametrize("target_id", TARGETS)
    @pytest.mark.parametrize("concept", ["nic", "cpu", "worker_core", "cache_line"])
    def test_an_isometric_solid_stays_in_its_box(self, concept, target_id):
        # The first version sized against width alone and overflowed downward by
        # exactly the depth's contribution — into the neighbour's box.
        fmt = target(target_id)
        configure(fmt)
        box = Box(0.1, 0.15, 0.8, 0.35)
        group = draw(ACTORS[concept].spawn("1"), box, fmt, theme(), fidelity="iso")

        centre, (width, height) = center_of(box, fmt), size_of(box, fmt)
        assert group.get_left()[0] >= centre[0] - width / 2 - self.TOLERANCE
        assert group.get_right()[0] <= centre[0] + width / 2 + self.TOLERANCE
        assert group.get_top()[1] <= centre[1] + height / 2 + self.TOLERANCE
        assert group.get_bottom()[1] >= centre[1] - height / 2 - self.TOLERANCE

    def test_the_three_faces_are_shaded_differently(self):
        # What reads as solid is the ratio between the faces, not the projection.
        from axiobyte_studio.backends.manim import iso

        faces = iso.solid(iso.Solid(2.0, 1.0, 0.5), "#4DE6A0", "#090C13")
        fills = [f.get_fill_color().to_hex() for f in faces]
        assert len(set(fills)) == 3

    def test_faces_are_muted_rather_than_saturated(self):
        # A face blended fully to its hue is a slab of colour that shouts louder
        # than anything the shot is saying.
        from axiobyte_studio.backends.manim import iso

        assert iso.TOP < 0.5
        assert iso.TOP > iso.LEFT > iso.RIGHT

    def test_the_projection_is_isometric(self):
        from axiobyte_studio.backends.manim import iso

        origin = iso.project(0, 0, 0)
        assert origin == pytest.approx([0, 0, 0])
        # Equal x and y recede symmetrically and cancel horizontally.
        assert iso.project(1, 1, 0)[0] == pytest.approx(0.0)
        # z is straight up the screen.
        assert iso.project(0, 0, 1)[1] == pytest.approx(1.0)

    def test_a_concept_with_no_isometric_form_says_so(self):
        fmt = target("16x9")
        configure(fmt)
        with pytest.raises(ConceptError) as exc:
            draw(ACTORS["packet"].spawn("1"), Box(0.1, 0.1, 0.5, 0.3), fmt, theme(), "iso")
        assert "no isometric form" in str(exc.value)
        assert "a packet is a run of bytes, not a solid" in str(exc.value)

    def test_a_stack_needs_layers(self):
        from axiobyte_studio.backends.manim import iso
        from axiobyte_studio.core import DesignError

        with pytest.raises(DesignError, match="at least one layer"):
            iso.stack(Box(0.1, 0.1, 0.5, 0.5), target("16x9"), [], "#090C13")
