"""Drift — what a re-cut voiceover did to an episode's beats.

The Studio's errors have been promising `abs timeline drift` since the Timeline
Engine was written. These hold the command to that promise.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from axiobyte_studio.cli import main
from axiobyte_studio.timeline import Timeline, compare

REPO = Path(__file__).resolve().parents[2]
EPISODE = REPO / "episodes" / "s01e02-zero-copy"

CUES = {
    "a.imagine": "Imagine@0",
    "a.library": "library@0",
    "b.nic": "NIC@5",
}


def _shifted(raw: dict, seconds: float) -> dict:
    """The same recording, delivered a little later."""
    moved = json.loads(json.dumps(raw))
    for word in moved["words"]:
        word["start"] = round(word["start"] + seconds, 3)
        word["end"] = round(word["end"] + seconds, 3)
    moved["meta"]["duration"] = round(moved["meta"]["duration"] + seconds, 3)
    return moved


@pytest.fixture
def raw() -> dict:
    path = (
        Path("/Users/dukhi8ma/Documents/dev/projects/Ajay3007.github.io")
        / "_learning/manim-scripts/axiobyte-system/ep02/timeline.json"
    )
    if not path.exists():
        pytest.skip("the reference voiceover is not present")
    return json.loads(path.read_text(encoding="utf-8"))


class TestDrift:
    def test_an_identical_recording_holds_everything(self, raw):
        timeline = Timeline.from_dict(raw)
        drift = compare(CUES, timeline, timeline)
        assert drift.ok
        assert len(drift.held) == len(CUES)
        assert drift.largest_move == 0.0

    def test_a_uniform_shift_moves_every_cue(self, raw):
        old = Timeline.from_dict(raw)
        new = Timeline.from_dict(_shifted(raw, 0.4))
        drift = compare(CUES, old, new)
        assert drift.ok  # nothing lost — anchoring did its job
        assert len(drift.moved) == len(CUES)
        assert drift.largest_move == pytest.approx(0.4, abs=0.01)
        assert all(c.delta == pytest.approx(0.4, abs=0.01) for c in drift.moved)

    def test_a_shift_below_tolerance_counts_as_held(self, raw):
        old = Timeline.from_dict(raw)
        new = Timeline.from_dict(_shifted(raw, 0.02))
        assert len(compare(CUES, old, new, tolerance=0.05).held) == len(CUES)

    def test_a_word_that_vanished_is_lost(self, raw):
        old = Timeline.from_dict(raw)
        recut = json.loads(json.dumps(raw))
        for word in recut["words"]:
            if word["word"].strip(".,") == "NIC":
                word["word"] = "card"
        drift = compare(CUES, old, Timeline.from_dict(recut))
        assert not drift.ok
        assert [c.name for c in drift.lost] == ["b.nic"]
        assert "no longer spoken" in drift.lost[0].detail

    def test_a_word_that_moved_sentence_says_where_it_went(self, raw):
        old = Timeline.from_dict(raw)
        recut = json.loads(json.dumps(raw))
        for word in recut["words"]:
            if word["word"].strip(".,") == "NIC" and word["sentence_index"] == 5:
                word["sentence_index"] = 6
        drift = compare(CUES, old, Timeline.from_dict(recut))
        assert not drift.ok
        assert "now in 6" in drift.lost[0].detail

    def test_a_cue_that_only_resolves_now_is_gained_not_held(self, raw):
        # Reported as `held` before this test existed, which was simply wrong.
        recut = json.loads(json.dumps(raw))
        for word in recut["words"]:
            if word["word"].strip(".,") == "NIC":
                word["word"] = "card"
        drift = compare(CUES, Timeline.from_dict(recut), Timeline.from_dict(raw))
        assert [c.name for c in drift.gained] == ["b.nic"]
        assert drift.ok

    def test_the_report_leads_with_the_recording_length(self, raw):
        old = Timeline.from_dict(raw)
        report = compare(CUES, old, Timeline.from_dict(_shifted(raw, 0.4))).report()
        assert "217.81s → 218.21s (+0.40s)" in report

    def test_the_report_hides_held_cues_unless_asked(self, raw):
        timeline = Timeline.from_dict(raw)
        drift = compare(CUES, timeline, timeline)
        assert "every cue held" in drift.report()
        assert "a.imagine" in drift.report(verbose=True)

    def test_lost_cues_get_the_only_advice_that_matters(self, raw):
        old = Timeline.from_dict(raw)
        recut = json.loads(json.dumps(raw))
        for word in recut["words"]:
            if word["word"].strip(".,") == "NIC":
                word["word"] = "card"
        report = compare(CUES, old, Timeline.from_dict(recut)).report()
        assert "only ones that need a decision" in report


class TestDriftCli:
    def test_it_reports_a_shifted_recording(self, raw, tmp_path, capsys):
        if not EPISODE.exists():
            pytest.skip("the worked episode is not present")
        previous = tmp_path / "old.json"
        previous.write_text(json.dumps(_shifted(raw, -0.4)), encoding="utf-8")
        assert main(["timeline", "drift", str(EPISODE), "--since", str(previous)]) == 0
        out = capsys.readouterr().out
        assert "moved" in out
        assert "+0.40s" in out

    def test_it_exits_nonzero_when_a_cue_is_lost(self, raw, tmp_path):
        if not EPISODE.exists():
            pytest.skip("the worked episode is not present")
        recut = json.loads(json.dumps(raw))
        for word in recut["words"]:
            if word["word"].strip(".,") == "Instead":
                word["word"] = "Rather"
        previous = tmp_path / "old.json"
        previous.write_text(json.dumps(recut), encoding="utf-8")
        # The episode's current recording still has the word, so nothing is lost.
        assert main(["timeline", "drift", str(EPISODE), "--since", str(previous)]) == 0
