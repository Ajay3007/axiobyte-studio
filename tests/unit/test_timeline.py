from __future__ import annotations

import pytest

from axiobyte_studio.core import CueNotFoundError, TimelineError
from axiobyte_studio.timeline import Timeline, normalise


class TestNormalise:
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("Packet", "packet"),
            ("packet.", "packet"),
            ('"packet,"', "packet"),
            ("  NIC  ", "nic"),
            ("mBuff?", "mbuff"),
            ("zero—", "zero"),
            ("‘reference’", "reference"),  # noqa: RUF001 - typographic quotes are the case under test
        ],
    )
    def test_strips_case_and_punctuation(self, raw, expected):
        assert normalise(raw) == expected


class TestWordLookup:
    def test_returns_word_start(self, timeline: Timeline):
        assert timeline.word("Imagine", sentence=0) == pytest.approx(0.0)

    def test_is_case_and_punctuation_insensitive(self, timeline: Timeline):
        assert timeline.word("LIBRARY.", sentence=0) == timeline.word("library", sentence=0)

    def test_sentence_scopes_the_lookup(self, timeline: Timeline):
        # "packet" is spoken in both sentence 1 and sentence 2.
        assert timeline.word("packet", sentence=1) < timeline.word("packet", sentence=2)

    def test_unscoped_lookup_takes_the_first(self, timeline: Timeline):
        assert timeline.word("packet") == timeline.word("packet", sentence=1)

    def test_occurrence_selects_a_repeat(self, timeline: Timeline):
        first = timeline.word("the", occurrence=0)
        second = timeline.word("the", occurrence=1)
        assert second > first


class TestFailFast:
    """The ONE RULE: a cue can never silently point at nothing."""

    def test_missing_word_raises(self, timeline: Timeline):
        with pytest.raises(CueNotFoundError):
            timeline.word("mempool", sentence=0)

    def test_error_reports_where_the_word_actually_is(self, timeline: Timeline):
        with pytest.raises(CueNotFoundError) as exc:
            timeline.word("packet", sentence=0)
        assert "spoken in sentence" in str(exc.value)
        assert "sentence=1" in str(exc.value)

    def test_error_suggests_near_matches_for_a_typo(self, timeline: Timeline):
        with pytest.raises(CueNotFoundError) as exc:
            timeline.word("referenc")
        assert "did you mean" in str(exc.value)
        assert "reference" in str(exc.value)

    def test_error_reports_occurrence_range(self, timeline: Timeline):
        with pytest.raises(CueNotFoundError) as exc:
            timeline.word("library", occurrence=7)
        assert "occurrence must be" in str(exc.value)

    def test_missing_file_names_the_fix(self, tmp_path):
        with pytest.raises(TimelineError) as exc:
            Timeline.load(tmp_path / "nope.json")
        assert "abs timeline transcribe" in str(exc.value)

    def test_malformed_json_names_the_file(self, tmp_path):
        path = tmp_path / "timeline.json"
        path.write_text("{not json", encoding="utf-8")
        with pytest.raises(TimelineError) as exc:
            Timeline.load(path)
        assert "not valid JSON" in str(exc.value)

    def test_missing_section_is_reported(self, raw_timeline):
        del raw_timeline["sentences"]
        with pytest.raises(TimelineError) as exc:
            Timeline.from_dict(raw_timeline)
        assert "'sentences'" in str(exc.value)


class TestWindows:
    def test_words_in_returns_only_that_window(self, timeline: Timeline):
        window = timeline.words_in(0.0, 1.0)
        assert [w.text for w in window] == ["Imagine", "you", "are"]

    def test_words_in_is_half_open(self, timeline: Timeline):
        start = timeline.word("you")
        assert timeline.words_in(start, start) == []
        assert timeline.words_in(start, start + 0.01)[0].text == "you"

    def test_sentence_lookup(self, timeline: Timeline):
        assert timeline.sentence(1).text.startswith("The NIC")

    def test_out_of_range_sentence_raises(self, timeline: Timeline):
        with pytest.raises(CueNotFoundError):
            timeline.sentence(99)


@pytest.mark.reference
class TestAgainstEpisode02:
    """The reference episode is the specification. These assert the port is faithful."""

    def test_loads_the_real_timeline(self, ep02_timeline: Timeline):
        assert len(ep02_timeline) == 579
        assert len(ep02_timeline.sentences) == 47
        assert ep02_timeline.duration == pytest.approx(217.809)

    @pytest.mark.parametrize(
        ("word", "sentence", "expected"),
        [
            # Values taken from the cue table comments in ep02_video_16x9.py, which
            # were themselves resolved from this timeline. If the port drifts, these
            # break — which is exactly the point.
            ("Imagine", 0, 0.031),
            ("library", 0, 1.55),
            ("book", 0, 4.21),
            ("truck", 1, 6.36),
            ("inefficient", 2, 12.90),
            ("networking", 4, 18.37),
            ("copied", 4, 25.36),
            ("NIC", 5, 28.88),
        ],
    )
    def test_reference_cues_resolve_to_documented_times(
        self, ep02_timeline: Timeline, word, sentence, expected
    ):
        assert ep02_timeline.word(word, sentence=sentence) == pytest.approx(expected, abs=0.01)

    def test_case_is_ignored_but_interior_apostrophes_are_not(self, ep02_timeline: Timeline):
        # ep02 writes W("That's", 3). Case must not matter...
        assert ep02_timeline.word("That's", sentence=3) == pytest.approx(14.64, abs=0.01)
        assert ep02_timeline.word("that's", sentence=3) == pytest.approx(14.64, abs=0.01)

        # ...but an interior apostrophe carries meaning: "we're" is not "were",
        # "she'll" is not "shell". Stripping it would let a cue bind to the wrong
        # word, so it is preserved — and the error suggests the right spelling.
        with pytest.raises(CueNotFoundError) as exc:
            ep02_timeline.word("thats", sentence=3)
        assert "that's" in str(exc.value)
