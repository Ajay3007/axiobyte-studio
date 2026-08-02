from __future__ import annotations

import pytest

from axiobyte_studio.core import DesignError
from axiobyte_studio.layout import (
    Box,
    Chain,
    Cluster,
    Ensemble,
    Insets,
    OverBudget,
    Pair,
    Severity,
    Stack,
    available_targets,
    check,
    check_all,
    errors,
    solve,
    solve_all,
    target,
)

ALL_TARGETS = ["16x9", "9x16", "1x1"]


class TestBox:
    def test_edges_and_centre(self):
        box = Box(0.2, 0.1, 0.4, 0.6)
        assert box.right == pytest.approx(0.6)
        assert box.bottom == pytest.approx(0.7)
        assert box.center == pytest.approx((0.4, 0.4))

    def test_inset(self):
        inner = Box(0, 0, 1, 1).inset(Insets(top=0.1, bottom=0.1, left=0.2, right=0.2))
        assert (inner.x, inner.y, inner.w, inner.h) == pytest.approx((0.2, 0.1, 0.6, 0.8))

    def test_divide_is_evenly_spaced(self):
        parts = Box(0, 0, 1, 1).divide(4, "horizontal", gap=0.0)
        assert [p.w for p in parts] == pytest.approx([0.25] * 4)
        assert parts[0].x == pytest.approx(0.0)
        assert parts[-1].right == pytest.approx(1.0)

    def test_divide_respects_gap(self):
        parts = Box(0, 0, 1, 1).divide(3, "horizontal", gap=0.1)
        assert parts[1].x - parts[0].right == pytest.approx(0.1)

    def test_weighted_divide(self):
        parts = Box(0, 0, 1, 1).weighted_divide([1, 3], "vertical", gap=0.0)
        assert parts[0].h == pytest.approx(0.25)
        assert parts[1].h == pytest.approx(0.75)

    def test_overlap_and_containment(self):
        a, b = Box(0, 0, 0.5, 0.5), Box(0.4, 0.4, 0.5, 0.5)
        assert a.overlaps(b)
        assert not a.overlaps(Box(0.6, 0.6, 0.2, 0.2))
        assert Box(0, 0, 1, 1).contains(a)

    def test_invalid_divide_raises(self):
        with pytest.raises(DesignError):
            Box(0, 0, 1, 1).divide(0, "horizontal", 0.0)
        with pytest.raises(DesignError) as exc:
            Box(0, 0, 1, 1).divide(2, "diagonal", 0.0)
        assert "'horizontal' or 'vertical'" in str(exc.value)


class TestTargets:
    def test_all_three_ship(self):
        assert set(available_targets()) >= {"16x9", "9x16", "1x1"}

    def test_canvases_match_the_reference_episodes(self):
        assert (target("16x9").canvas_w, target("16x9").canvas_h) == (1920, 1080)
        assert (target("9x16").canvas_w, target("9x16").canvas_h) == (1080, 1920)

    def test_unit_is_100px_everywhere(self):
        # ep02 uses `1 unit == 100 px` in both cuts, which is what makes design
        # pixels a universal unit rather than a per-format one.
        assert {target(t).unit_px for t in ALL_TARGETS} == {100}

    def test_orientation(self):
        assert target("9x16").is_portrait
        assert not target("16x9").is_portrait

    def test_wide_frames_hold_more(self):
        assert target("16x9").density_budget > target("9x16").density_budget

    def test_unknown_target_lists_what_exists(self):
        with pytest.raises(DesignError) as exc:
            target("21x9")
        assert "available" in str(exc.value)
        assert "a new format is a profile" in str(exc.value)

    def test_missing_axis_names_the_file(self):
        with pytest.raises(DesignError) as exc:
            target("16x9").axis_for("helix")
        assert "design/targets/16x9.yaml" in str(exc.value)


class TestPlatformSafety:
    def test_vertical_targets_declare_platform_chrome(self):
        assert "reels" in target("9x16").platform_safe
        assert "shorts" in target("9x16").platform_safe

    def test_content_box_shrinks_for_a_platform(self):
        plain = target("9x16").content_box()
        reels = target("9x16").content_box("reels")
        assert reels.bottom < plain.bottom
        assert reels.right < plain.right

    def test_landscape_has_no_platform_chrome(self):
        assert target("16x9").platform_safe == {}

    def test_unknown_platform_raises(self):
        with pytest.raises(DesignError) as exc:
            target("9x16").content_box("myspace")
        assert "platform_safe" in str(exc.value)


class TestChainIsFormatBlind:
    """The claim the whole Layout System exists to make good on."""

    CHAIN = Chain(id="copy_path", items=("nic", "buf_a", "buf_b", "app"))

    def test_one_chain_solves_in_every_target(self):
        layouts = solve_all(self.CHAIN, ALL_TARGETS)
        assert set(layouts) == set(ALL_TARGETS)
        for layout in layouts.values():
            assert set(layout.boxes) == {"nic", "buf_a", "buf_b", "app"}

    def test_landscape_runs_left_to_right(self):
        boxes = solve(self.CHAIN, target("16x9")).boxes
        xs = [boxes[n].x for n in ("nic", "buf_a", "buf_b", "app")]
        assert xs == sorted(xs)
        assert len({round(boxes[n].y, 6) for n in boxes}) == 1  # same row

    def test_portrait_runs_top_to_bottom(self):
        boxes = solve(self.CHAIN, target("9x16")).boxes
        ys = [boxes[n].y for n in ("nic", "buf_a", "buf_b", "app")]
        assert ys == sorted(ys)
        assert len({round(boxes[n].x, 6) for n in boxes}) == 1  # same column

    def test_order_is_preserved_in_both(self):
        wide = solve(self.CHAIN, target("16x9")).boxes
        tall = solve(self.CHAIN, target("9x16")).boxes
        assert sorted(wide, key=lambda k: wide[k].x) == sorted(tall, key=lambda k: tall[k].y)

    def test_a_new_format_needs_no_shot_change(self):
        # The real test of format-genericness: 1:1 was never considered when this
        # chain was written, and it costs nothing.
        layout = solve(self.CHAIN, target("1x1"))
        assert not errors(check(layout))


class TestRelations:
    def test_pair_is_side_by_side_in_wide_and_stacked_in_tall(self):
        pair = Pair(id="compare", a="traditional", b="zerocopy")
        wide = solve(pair, target("16x9")).boxes
        assert wide["traditional"].x < wide["zerocopy"].x
        tall = solve(pair, target("9x16")).boxes
        assert tall["traditional"].y < tall["zerocopy"].y

    def test_cluster_grid_is_wider_in_landscape(self):
        cluster = Cluster(id="pool", items=("a", "b", "c", "d"))
        wide = solve(cluster, target("16x9")).boxes
        tall = solve(cluster, target("9x16")).boxes
        # A wide frame gets fewer, longer rows; a tall one gets more, shorter ones.
        assert len({round(b.y, 4) for b in wide.values()}) <= len(
            {round(b.y, 4) for b in tall.values()}
        )

    def test_ensemble_generates_indexed_slots(self):
        warp = Ensemble(id="warp", unit="lane", count=4)
        boxes = solve(warp, target("16x9")).boxes
        assert set(boxes) == {"lane[0]", "lane[1]", "lane[2]", "lane[3]"}

    def test_ensemble_members_sit_tighter_than_a_chain(self):
        # An ensemble reads as one object; a chain's separation is the point.
        names = ("a", "b", "c")
        chain = solve(Chain(id="c", items=names), target("16x9")).boxes
        ens = solve(Ensemble(id="e", unit="u", count=3), target("16x9")).boxes
        chain_gap = chain["b"].x - chain["a"].right
        ens_gap = ens["u[1]"].x - ens["u[0]"].right
        assert ens_gap < chain_gap

    def test_stack_composes_relations_and_honours_weight(self):
        stack = Stack(
            id="shot",
            children=(
                Chain(id="pipeline", items=("nic", "mem"), weight=3.0),
                Pair(id="meters", a="cost", b="saving", weight=1.0),
            ),
        )
        boxes = solve(stack, target("16x9")).boxes
        assert set(boxes) == {"nic", "mem", "cost", "saving"}
        assert boxes["nic"].h > boxes["cost"].h  # weight 3 vs 1

    def test_empty_stack_raises(self):
        with pytest.raises(DesignError) as exc:
            solve(Stack(id="empty", children=()), target("16x9"))
        assert "places nothing" in str(exc.value)


class TestDensityBudget:
    """The honest limit of reflow: a tall frame holds fewer things."""

    LONG = tuple(f"stage{i}" for i in range(6))

    def test_over_budget_without_a_strategy_is_an_error(self):
        chain = Chain(id="long", items=self.LONG)  # 6 > 9x16's budget of 4
        with pytest.raises(DesignError) as exc:
            solve(chain, target("9x16"))
        assert "shows 4 legibly" in str(exc.value)
        assert "OverBudget.SPLIT" in str(exc.value)

    def test_the_same_chain_is_fine_in_a_wide_frame(self):
        assert solve(Chain(id="long", items=self.LONG), target("16x9")).phases

    def test_split_produces_sequential_reveals(self):
        chain = Chain(id="long", items=self.LONG, strategy=OverBudget.SPLIT)
        layout = solve(chain, target("9x16"))
        assert layout.is_split
        assert len(layout.phases) == 2
        assert len(layout.phases[0].boxes) == 4
        assert len(layout.phases[1].boxes) == 2
        assert set(layout.slots) == set(self.LONG)

    def test_split_is_reported_not_silent(self):
        chain = Chain(id="long", items=self.LONG, strategy=OverBudget.SPLIT)
        notes = solve(chain, target("9x16")).notes
        assert any("split 6 elements into 2 reveals" in n for n in notes)

    def test_crop_keeps_the_first_items(self):
        cluster = Cluster(id="pool", items=tuple(f"s{i}" for i in range(10)))
        layout = solve(cluster, target("9x16"))
        assert not layout.is_split
        assert layout.slots == ["s0", "s1", "s2"]
        assert any("cropped 10" in n for n in layout.notes)

    def test_concept_budget_can_lower_the_frame_budget(self):
        chain = Chain(id="c", items=("a", "b", "c", "d", "e"), strategy=OverBudget.SPLIT)
        layout = solve(chain, target("16x9"), cognitive_budget=2)
        assert len(layout.phases) == 3
        assert any("overrides the frame's 7" in n for n in layout.notes)

    def test_concept_budget_never_raises_the_frame_budget(self):
        chain = Chain(id="c", items=tuple(f"s{i}" for i in range(6)))
        with pytest.raises(DesignError):
            solve(chain, target("9x16"), cognitive_budget=99)


class TestLint:
    def test_a_sound_layout_is_clean_in_every_target(self):
        chain = Chain(id="p", items=("nic", "mem", "cpu"))
        assert check_all(solve_all(chain, ALL_TARGETS)) == []

    def test_tiny_elements_are_an_error(self):
        # The budget is applied PER relation, so many small relations each pass it
        # and collectively overflow. The legibility floor is the backstop for that
        # gap, and this is the case it exists for.
        crowded = Stack(
            id="crowded",
            children=tuple(Chain(id=f"r{i}", items=(f"s{i}",)) for i in range(12)),
        )
        found = errors(check(solve(crowded, target("9x16"))))
        assert found
        assert "legibility floor" in found[0].message

    def test_platform_chrome_collision_is_caught(self):
        # Solving without a platform lets content run under the Reels UI; lint
        # catches it before a viewer does.
        chain = Chain(id="p", items=("a", "b"))
        layout = solve(chain, target("9x16"))
        object.__setattr__(layout, "platform", "reels")
        found = [f for f in check(layout) if "interface" in f.message]
        assert found
        assert "platform='reels'" in found[0].fix

    def test_solving_with_the_platform_avoids_the_collision(self):
        chain = Chain(id="p", items=("a", "b"))
        layout = solve(chain, target("9x16"), platform="reels")
        assert not [f for f in check(layout) if "interface" in f.message]

    def test_findings_are_error_first(self):
        crowded = Stack(
            id="crowded",
            children=tuple(Chain(id=f"r{i}", items=(f"s{i}",)) for i in range(12)),
        )
        found = check(solve(crowded, target("9x16")))
        severities = [f.severity for f in found]
        assert severities == sorted(severities, key=lambda s: s is not Severity.ERROR)

    def test_report_is_readable(self):
        from axiobyte_studio.layout import report

        assert report([]) == "layout: clean in every target"
        crowded = Stack(
            id="crowded",
            children=tuple(Chain(id=f"r{i}", items=(f"s{i}",)) for i in range(12)),
        )
        text = report(check(solve(crowded, target("9x16"))))
        assert "errors" in text and "Fix:" in text


class TestPixelConversion:
    def test_converts_to_the_target_canvas(self):
        box = Box(0.5, 0.25, 0.25, 0.5)
        assert box.to_pixels(target("16x9")) == pytest.approx((960.0, 270.0, 480.0, 540.0))
        assert box.to_pixels(target("9x16")) == pytest.approx((540.0, 480.0, 270.0, 960.0))
