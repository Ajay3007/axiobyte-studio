from __future__ import annotations

from xml.etree import ElementTree

import pytest

from axiobyte_studio.backends.svg import render, write_contact_sheet
from axiobyte_studio.chrome import Edge, all_slots, caption_bar, keyword_bar, stage_box
from axiobyte_studio.core import DesignError
from axiobyte_studio.layout import Chain, OverBudget, Pair, Stack, solve, solve_all, target

SHOT = Stack(
    id="shot_0120",
    children=(
        Chain(id="pipeline", items=("nic", "mempool", "tx"), weight=3.0),
        Pair(id="verdict", a="bytes_moved", b="pointer_moved", weight=1.0),
    ),
)
ROLES = {
    "nic": "nic",
    "mempool": "memory",
    "tx": "nic",
    "bytes_moved": "copy",
    "pointer_moved": "pointer",
}


class TestChromePlacement:
    def test_keyword_rides_the_top_and_caption_the_bottom(self):
        wide = target("16x9")
        assert keyword_bar(wide).edge is Edge.TOP
        assert caption_bar(wide).edge is Edge.BOTTOM
        assert keyword_bar(wide).box.y < caption_bar(wide).box.y

    def test_chrome_stays_inside_the_safe_area(self):
        for name in ("16x9", "9x16", "1x1"):
            t = target(name)
            for slot in all_slots(t).values():
                assert t.content_box().contains(slot.box), f"{slot.name} escapes in {name}"

    def test_caption_lifts_clear_of_platform_chrome(self):
        tall = target("9x16")
        plain = caption_bar(tall).box
        reels = caption_bar(tall, "reels").box
        assert reels.bottom < plain.bottom

    def test_caption_clears_every_occluded_region(self):
        tall = target("9x16")
        caption = caption_bar(tall, "reels").box
        for occluded in tall.occluded("reels"):
            assert not caption.overlaps(occluded)

    def test_unknown_platform_names_the_file(self):
        with pytest.raises(DesignError) as exc:
            caption_bar(target("9x16"), "myspace")
        assert "design/targets/9x16.yaml" in str(exc.value)


class TestStageBox:
    def test_stage_sits_between_the_chrome_bands(self):
        for name in ("16x9", "9x16", "1x1"):
            t = target(name)
            stage = stage_box(t)
            assert stage.y > keyword_bar(t).box.bottom
            assert stage.bottom < caption_bar(t).box.y

    def test_stage_shrinks_when_a_platform_is_declared(self):
        tall = target("9x16")
        assert stage_box(tall, "reels").h < stage_box(tall).h

    def test_stage_is_a_usable_fraction_of_every_frame(self):
        # If chrome ate the frame, the whole thing would be unusable — worth
        # asserting rather than discovering in a render.
        for name in ("16x9", "9x16", "1x1"):
            assert stage_box(target(name)).h > 0.4


class TestSvgPreview:
    def test_renders_valid_xml(self):
        svg = render(solve(SHOT, target("16x9")), title="shot_0120", roles=ROLES)
        root = ElementTree.fromstring(svg)
        assert root.tag.endswith("svg")

    def test_canvas_matches_the_target(self):
        for name, size in (("16x9", ("1920", "1080")), ("9x16", ("1080", "1920"))):
            svg = render(solve(SHOT, target(name)))
            root = ElementTree.fromstring(svg)
            assert (root.get("width"), root.get("height")) == size

    def test_every_slot_appears(self):
        svg = render(solve(SHOT, target("16x9")), roles=ROLES)
        for slot in ("nic", "mempool", "tx", "bytes_moved", "pointer_moved"):
            assert f">{slot}<" in svg

    def test_roles_resolve_to_theme_colours(self):
        svg = render(solve(SHOT, target("16x9")), roles=ROLES)
        assert "#4DE6A0" in svg  # nic, green
        assert "#B79CF0" in svg  # memory, purple
        assert "#F5D14F" in svg  # pointer, yellow

    def test_is_self_contained(self):
        # No external stylesheet, font file, or image reference — a preview that
        # needs a network is a preview that breaks in CI. The xmlns declaration is
        # an identifier rather than a fetch, so it is excluded before checking.
        svg = render(solve(SHOT, target("16x9")))
        body = svg.replace('xmlns="http://www.w3.org/2000/svg"', "")
        for forbidden in ("http://", "https://", "<image", "xlink:href", "@import"):
            assert forbidden not in body

    def test_platform_occlusion_is_drawn(self):
        plain = render(solve(SHOT, target("9x16")))
        reels = render(solve(SHOT, target("9x16"), platform="reels"))
        assert "reels" in reels
        assert reels.count("<rect") > plain.count("<rect")

    def test_split_layouts_label_the_reveal(self):
        chain = Chain(
            id="long",
            items=tuple(f"s{i}" for i in range(6)),
            strategy=OverBudget.SPLIT,
        )
        layout = solve(chain, target("9x16"))
        assert "reveal 1/2" in render(layout, phase=0)
        assert "reveal 2/2" in render(layout, phase=1)


class TestContactSheet:
    def test_writes_one_file_per_target_and_reveal(self, tmp_path):
        shot = Stack(
            id="s",
            children=(
                Chain(
                    id="pipeline",
                    items=tuple(f"s{i}" for i in range(5)),
                    strategy=OverBudget.SPLIT,
                ),
            ),
        )
        layouts = solve_all(shot, ["16x9", "9x16", "1x1"])
        written = write_contact_sheet(layouts, tmp_path, name="s")
        names = sorted(p.name for p in written)
        assert names == [
            "s.16x9.svg",
            "s.1x1.svg",
            "s.9x16-1.svg",
            "s.9x16-2.svg",
        ]
        assert all(p.read_text(encoding="utf-8").startswith("<svg") for p in written)

    def test_creates_the_directory(self, tmp_path):
        out = tmp_path / "nested" / "previews"
        write_contact_sheet(solve_all(SHOT, ["16x9"]), out, name="s")
        assert out.is_dir()
