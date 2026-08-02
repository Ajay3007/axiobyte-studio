from __future__ import annotations

import pytest

from axiobyte_studio.core import DesignError
from axiobyte_studio.layout import target
from axiobyte_studio.typography import ladder, style


class TestLadder:
    def test_carries_the_reference_sizes(self):
        wide = target("16x9")
        assert style("keyword", wide).size_px == 38
        assert style("display", wide).size_px == 66
        assert style("caption", wide).size_px == 30
        assert style("node", wide).size_px == 33
        assert style("mono_s", wide).size_px == 18

    def test_sizes_are_identical_in_every_format(self):
        # The correction the reference forced: ep02_video.py (1080x1920) and
        # ep02_video_16x9.py (1920x1080) declare the SAME constants. Because
        # 1 unit = 100 px in both, a per-target multiplier would double-count.
        for rung in ladder().rungs:
            sizes = {style(rung, target(t)).size_px for t in ("16x9", "9x16", "1x1")}
            assert len(sizes) == 1, f"{rung} differs between formats"

    def test_wrap_width_is_what_differs(self):
        assert style("keyword", target("16x9")).max_width == pytest.approx(0.73)
        assert style("keyword", target("9x16")).max_width == pytest.approx(0.61)

    def test_rungs_are_ordered_largest_first(self):
        rungs = ladder().rungs
        sizes = [style(r, target("16x9")).size_px for r in rungs]
        assert sizes == sorted(sizes, reverse=True)

    def test_mono_rungs_use_the_mono_face(self):
        assert style("mono_s", target("16x9")).mono
        assert not style("keyword", target("16x9")).mono
        assert "Mono" in style("mono_s", target("16x9")).faces[0]

    def test_unknown_rung_lists_the_ladder(self):
        with pytest.raises(DesignError) as exc:
            style("gigantic", target("16x9"))
        assert "design/tokens/type.yaml" in str(exc.value)
        assert "keyword" in str(exc.value)


class TestMeasurement:
    def test_a_short_line_fits_everywhere(self):
        for name in ("16x9", "9x16", "1x1"):
            assert style("keyword", target(name)).fits("ZERO COPY", target(name))

    def test_the_same_line_can_fit_wide_and_not_tall(self):
        line = "A packet is best thought of as a pointer to bytes"
        assert style("caption", target("16x9")).fits(line, target("16x9"))
        assert not style("caption", target("9x16")).fits(line, target("9x16"))

    def test_wrap_produces_lines_that_fit(self):
        tall = target("9x16")
        text_style = style("caption", tall)
        lines = text_style.wrap(
            "A packet is best thought of not as bytes but as a pointer to those bytes",
            tall,
        )
        assert len(lines) > 1
        assert all(text_style.fits(line, tall) for line in lines)

    def test_wrap_preserves_every_word(self):
        tall = target("9x16")
        text = "the bytes never move only the pointer travels between stages"
        assert " ".join(style("caption", tall).wrap(text, tall)) == text

    def test_wrap_of_empty_text_is_empty(self):
        assert style("caption", target("16x9")).wrap("   ", target("16x9")) == []

    def test_mono_measures_wider_than_sans_at_the_same_size(self):
        wide = target("16x9")
        mono, sans = style("mono_s", wide), style("node_sub", wide)
        assert mono.advance > sans.advance
