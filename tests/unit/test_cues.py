from __future__ import annotations

import pytest

from axiobyte_studio.core import CueNotFoundError, TimelineError
from axiobyte_studio.timeline import Cue, CueTable, CueTableBuilder, Timeline


class TestCueParsing:
    def test_bare_word(self):
        assert Cue.parse("packet") == Cue(word="packet")

    def test_word_at_sentence(self):
        assert Cue.parse("packet@4") == Cue(word="packet", sentence=4)

    def test_mapping(self):
        cue = Cue.parse({"word": "packet", "sentence": 4, "offset": 0.2})
        assert (cue.word, cue.sentence, cue.offset) == ("packet", 4, 0.2)

    def test_malformed_shorthand_raises(self):
        with pytest.raises(TimelineError) as exc:
            Cue.parse("packet@notanumber")
        assert "word@<sentence index>" in str(exc.value)

    def test_wrong_type_raises(self):
        with pytest.raises(TimelineError):
            Cue.parse(42)


class TestResolution:
    def test_resolves_every_cue(self, timeline: Timeline):
        table = CueTable.resolve(
            {"hook.imagine": "Imagine@0", "nic.receives": "receives@1"}, timeline
        )
        assert len(table) == 2
        assert table["hook.imagine"] == pytest.approx(0.0)

    def test_offset_is_applied(self, timeline: Timeline):
        table = CueTable.resolve(
            {"a": Cue("Imagine", 0), "b": Cue("Imagine", 0, offset=0.25)}, timeline
        )
        assert table["b"] - table["a"] == pytest.approx(0.25)

    def test_resolved_cue_is_usable_as_a_number(self, timeline: Timeline):
        table = CueTable.resolve({"a": "Imagine@0"}, timeline)
        assert float(table.cues["a"]) == table["a"]

    def test_records_what_was_actually_spoken(self, timeline: Timeline):
        table = CueTable.resolve({"a": "IMAGINE@0"}, timeline)
        assert table.cues["a"].spoken == "Imagine"


class TestAggregateFailure:
    """A re-cut voiceover should be repairable in one pass, not one exception at a time."""

    def test_reports_every_broken_cue_at_once(self, timeline: Timeline):
        with pytest.raises(CueNotFoundError) as exc:
            CueTable.resolve(
                {
                    "ok": "Imagine@0",
                    "bad.one": "mempool@0",
                    "bad.two": "hugepage@1",
                    "bad.three": "numa@2",
                },
                timeline,
            )
        message = str(exc.value)
        assert "3 of 4 cues" in message
        for name in ("bad.one", "bad.two", "bad.three"):
            assert name in message
        assert "ok:" not in message

    def test_points_at_the_drift_tool(self, timeline: Timeline):
        with pytest.raises(CueNotFoundError) as exc:
            CueTable.resolve({"bad": "mempool@0"}, timeline)
        assert "abs timeline drift" in str(exc.value)


class TestLookupErrors:
    def test_unknown_cue_name_suggests_near_matches(self, timeline: Timeline):
        table = CueTable.resolve({"hook.imagine": "Imagine@0"}, timeline)
        with pytest.raises(CueNotFoundError) as exc:
            table["hook.imagin"]
        assert "did you mean" in str(exc.value)
        assert "hook.imagine" in str(exc.value)

    def test_contains(self, timeline: Timeline):
        table = CueTable.resolve({"a": "Imagine@0"}, timeline)
        assert "a" in table
        assert "b" not in table


class TestOrdering:
    def test_detects_cues_declared_out_of_spoken_order(self, timeline: Timeline):
        table = CueTable.resolve({"late": "reference@2", "early": "Imagine@0"}, timeline)
        pairs = table.out_of_order()
        assert [(a.name, b.name) for a, b in pairs] == [("late", "early")]

    def test_well_ordered_table_reports_nothing(self, timeline: Timeline):
        table = CueTable.resolve({"early": "Imagine@0", "late": "reference@2"}, timeline)
        assert table.out_of_order() == []

    def test_in_spoken_order(self, timeline: Timeline):
        table = CueTable.resolve({"late": "reference@2", "early": "Imagine@0"}, timeline)
        assert [c.name for c in table.in_spoken_order()] == ["early", "late"]


class TestBuilder:
    def test_builds_and_resolves(self, timeline: Timeline):
        builder = CueTableBuilder()
        builder.at("hook.imagine", "Imagine", 0)
        builder.at("nic.buffer", "buffer", 1)
        table = builder.build(timeline)
        assert len(table) == 2
