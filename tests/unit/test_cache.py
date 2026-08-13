"""The render cache — don't render what has not changed.

Conservative by design: when in doubt the fingerprint changes and the render
happens. A needless render costs minutes; a wrongly reused one costs trust.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from axiobyte_studio.render import cache
from axiobyte_studio.storyboard import Episode

REPO = Path(__file__).resolve().parents[2]
EPISODE = REPO / "episodes" / "s01e02-zero-copy"


@pytest.fixture
def episode() -> Episode:
    if not EPISODE.exists():
        pytest.skip("the worked episode is not present")
    return Episode.load(EPISODE)


@pytest.fixture
def scratch(tmp_path: Path) -> Path:
    if not EPISODE.exists():
        pytest.skip("the worked episode is not present")
    target = tmp_path / EPISODE.name
    # Never copy `out/`: renders are derived artifacts, and a test that inherits
    # them is a test whose starting state depends on what was rendered last.
    shutil.copytree(EPISODE, target, ignore=shutil.ignore_patterns("out"))
    return target


def _print(ep: Episode, target: str = "16x9", **kwargs):
    options = {"quality": "draft", "still": False, **kwargs}
    return cache.fingerprint(ep, target, **options)


class TestFingerprint:
    def test_it_is_stable_across_runs(self, episode: Episode):
        assert _print(episode).digest == _print(episode).digest

    def test_it_records_what_went_into_it(self, episode: Episode):
        result = _print(episode)
        assert set(result.inputs) >= {"authored", "engine", "voiceover", "target", "tools"}
        assert "axiobyte-studio" in result.tools

    @pytest.mark.parametrize(
        ("kwargs", "why"),
        [
            ({"target": "9x16"}, "a different format is a different frame"),
            ({"quality": "high"}, "quality changes the pixels"),
            ({"still": True}, "a still is not a video"),
        ],
    )
    def test_render_options_change_it(self, episode: Episode, kwargs, why):
        assert _print(episode).digest != _print(episode, **kwargs).digest, why

    def test_an_authored_edit_changes_it(self, scratch: Path):
        before = _print(Episode.load(scratch)).digest
        module = scratch / "shots" / "episode.py"
        module.write_text(module.read_text() + "\n# a comment\n", encoding="utf-8")
        assert _print(Episode.load(scratch)).digest != before

    def test_a_beat_edit_changes_it(self, scratch: Path):
        before = _print(Episode.load(scratch)).digest
        beats = scratch / "storyboard" / "beats.yaml"
        beats.write_text(beats.read_text().replace('intent: "', 'intent: "x '), encoding="utf-8")
        assert _print(Episode.load(scratch)).digest != before

    def test_a_recut_voiceover_changes_it_even_with_no_authored_edit(self, scratch: Path):
        # The voiceover decides every beat's time, so a re-cut must re-render even
        # when not one authored line moved.
        #
        # Re-cut in place rather than repointing the manifest at a file elsewhere:
        # that is what a re-cut actually is, and it keeps the test independent of
        # how the manifest spells the path.
        before = _print(Episode.load(scratch)).digest

        words = scratch / "timeline" / "words.json"
        recut = json.loads(words.read_text(encoding="utf-8"))
        for word in recut["words"]:
            word["start"] = round(word["start"] + 0.4, 3)
        words.write_text(json.dumps(recut), encoding="utf-8")

        assert _print(Episode.load(scratch)).digest != before

    def test_the_tool_versions_are_part_of_the_identity(self, episode: Episode):
        # A Manim upgrade can change antialiasing and font metrics. Without this,
        # the first render after an upgrade silently mixes old and new frames.
        assert "manim" in _print(episode).tools


class TestLookupAndRecord:
    def test_nothing_recorded_is_a_miss(self, tmp_path):
        assert cache.lookup(tmp_path, "16x9") is None

    def test_a_recorded_render_round_trips(self, episode: Episode, tmp_path):
        produced = tmp_path / "Episode16x9.png"
        produced.write_bytes(b"frame")
        result = _print(episode)
        cache.record(
            tmp_path, "16x9", result, [produced], episode_id=episode.id, scene="Episode16x9"
        )
        entry = cache.lookup(tmp_path, "16x9")
        assert entry is not None
        assert entry.digest == result.digest
        assert entry.intact

    def test_a_render_whose_output_vanished_is_not_intact(self, episode: Episode, tmp_path):
        # Reporting a hit here would be the worst failure this module could have:
        # a render that says it succeeded and produced nothing.
        produced = tmp_path / "gone.png"
        produced.write_bytes(b"frame")
        cache.record(tmp_path, "16x9", _print(episode), [produced], episode_id="e", scene="S")
        produced.unlink()
        entry = cache.lookup(tmp_path, "16x9")
        assert entry is not None
        assert not entry.intact

    def test_a_corrupt_manifest_is_a_miss_not_a_crash(self, tmp_path):
        path = cache.manifest_path(tmp_path, "16x9")
        path.parent.mkdir(parents=True)
        path.write_text("{not json", encoding="utf-8")
        assert cache.lookup(tmp_path, "16x9") is None

    def test_the_manifest_is_the_reproducibility_record(self, episode: Episode, tmp_path):
        produced = tmp_path / "a.png"
        produced.write_bytes(b"x")
        path = cache.record(
            tmp_path, "16x9", _print(episode), [produced], episode_id="e", scene="S"
        )
        raw = json.loads(path.read_text(encoding="utf-8"))
        assert raw["tools"]["axiobyte-studio"]
        assert raw["inputs"]["authored"]
        assert raw["rendered_at"]


class TestExplain:
    def test_it_names_why_a_render_could_not_be_reused(self, episode: Episode, tmp_path):
        current = _print(episode)
        assert cache.explain(None, current) == "no previous render"

        produced = tmp_path / "a.png"
        produced.write_bytes(b"x")
        cache.record(tmp_path, "16x9", current, [produced], episode_id="e", scene="S")
        entry = cache.lookup(tmp_path, "16x9")
        assert entry is not None
        assert cache.explain(entry, current) == "unchanged"

        produced.unlink()
        stale = cache.lookup(tmp_path, "16x9")
        assert stale is not None
        assert cache.explain(stale, current) == "previous output is missing"

    def test_a_changed_input_is_named_as_such(self, episode: Episode, tmp_path):
        produced = tmp_path / "a.png"
        produced.write_bytes(b"x")
        cache.record(tmp_path, "16x9", _print(episode), [produced], episode_id="e", scene="S")
        entry = cache.lookup(tmp_path, "16x9")
        assert entry is not None
        assert cache.explain(entry, _print(episode, target="9x16")) == "inputs changed"
