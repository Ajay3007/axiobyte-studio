from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from axiobyte_studio.cli import main
from axiobyte_studio.core import StudioError
from axiobyte_studio.storyboard import (
    REQUIRED_SECTIONS,
    BeatMap,
    Episode,
    Picture,
    Severity,
    plan,
    require_ok,
    summarise_concepts,
)

REPO = Path(__file__).resolve().parents[2]
EPISODE = REPO / "episodes" / "s01e02-zero-copy"

PICTURE = """
## The One Picture
The bytes never move.

## The counter-picture
The copies, built first so they can stop.

## The payoff frame
No red anywhere on screen.

## What must never happen
- The buffer moves.
- Red appears after the turn.

```yaml
assertions:
  - id: OP-1
    statement: "The buffer never moves."
    actor: packet#1
    unchanged: [address]
    after: zerocopy.instead
```
"""


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


class TestPicture:
    def test_parses_all_four_sections(self):
        picture = Picture.parse(PICTURE)
        assert picture.thesis.startswith("The bytes never move")
        assert "copies" in picture.counter
        assert "No red" in picture.payoff
        assert len(picture.prohibitions) == 2

    def test_extracts_machine_checkable_assertions(self):
        picture = Picture.parse(PICTURE)
        assert picture.checkable == 1
        assertion = picture.assertions[0]
        assert assertion.actor == "packet#1"
        assert assertion.unchanged == ("address",)
        assert assertion.after == "zerocopy.instead"

    @pytest.mark.parametrize("section", REQUIRED_SECTIONS)
    def test_every_section_is_required(self, section):
        stripped = PICTURE.replace(f"## {section}", "## Something Else")
        with pytest.raises(StudioError) as exc:
            Picture.parse(stripped)
        assert section in str(exc.value)
        assert "competent and forgettable" in str(exc.value)

    def test_a_missing_file_names_the_scaffold(self, tmp_path):
        with pytest.raises(StudioError) as exc:
            Picture.load(tmp_path / "picture.md")
        assert "states its thesis before its storyboard" in str(exc.value)

    def test_the_fenced_block_is_not_treated_as_prose(self):
        # The assertions block must not leak into the prohibition list.
        assert all("assertions" not in p for p in Picture.parse(PICTURE).prohibitions)


class TestBeatMap:
    def test_beats_carry_their_act(self, episode: Episode):
        assert episode.beatmap is not None
        assert episode.beatmap.beat("zerocopy.instead").act == "zerocopy"

    def test_teaching_order_is_first_taught_and_deduplicated(self, episode: Episode):
        assert episode.concepts == ["copy_based", "zero_copy"]

    def test_cues_form_the_episode_cue_table(self, episode: Episode):
        assert episode.beatmap is not None
        assert episode.beatmap.cues["zerocopy.instead"] == "Instead@10"

    def test_duplicate_beat_ids_are_rejected(self):
        raw = {
            "acts": [
                {
                    "id": "a",
                    "beats": [{"id": "a.one", "cue": "x@0"}, {"id": "a.one", "cue": "y@0"}],
                }
            ]
        }
        with pytest.raises(StudioError) as exc:
            BeatMap.parse(raw)
        assert "share the id" in str(exc.value)

    def test_an_episode_with_no_acts_is_rejected(self):
        with pytest.raises(StudioError) as exc:
            BeatMap.parse({"acts": []})
        assert "no acts" in str(exc.value)


class TestEpisode:
    def test_loads_every_input(self, episode: Episode):
        assert episode.picture is not None
        assert episode.beatmap is not None
        assert episode.timeline is not None
        assert episode.duration > 0

    def test_targets_are_peers_and_carry_their_platform(self, episode: Episode):
        assert set(episode.targets) == {"16x9", "9x16"}
        assert episode.platform_for("9x16") == "reels"
        assert episode.platform_for("16x9") is None

    def test_a_directory_without_a_manifest_is_not_an_episode(self, tmp_path):
        with pytest.raises(StudioError) as exc:
            Episode.load(tmp_path)
        assert "is not an episode" in str(exc.value)


class TestPlanCascade:
    """Every step, verified to catch its own failure mode."""

    def test_the_worked_episode_passes(self, episode: Episode):
        result = plan(episode)
        assert result.ok, result.report()
        assert [name for name, ok in result.steps if not ok] == []

    def test_steps_run_in_the_documented_order(self, episode: Episode):
        names = [name.split()[0] for name, _ in plan(episode).steps]
        assert names == ["cues", "closure", "focus", "budget", "picture", "coverage", "order"]

    def test_require_ok_is_a_no_op_when_sound(self, episode: Episode):
        require_ok(plan(episode))

    def test_cues_catches_a_word_that_is_not_spoken(self, scratch: Path):
        beats = scratch / "storyboard" / "beats.yaml"
        beats.write_text(
            beats.read_text().replace('cue: "Instead@10"', 'cue: "hugepage@10"'),
            encoding="utf-8",
        )
        result = plan(Episode.load(scratch))
        assert not result.ok
        assert result.errors[0].step == "cues"

    def test_closure_catches_an_interaction_before_its_participants(self, scratch: Path):
        manifest = scratch / "episode.yaml"
        manifest.write_text(
            manifest.read_text().replace(
                "assumed: [packet, memory_buffer, pointer, mbuf, mempool, nic, cpu]",
                "assumed: [packet, nic, cpu]",
            ),
            encoding="utf-8",
        )
        result = plan(Episode.load(scratch))
        assert not result.ok
        messages = [f.message for f in result.errors]
        assert any("taught before its participant" in m for m in messages)

    def test_focus_catches_a_citation_that_does_not_resolve(self, scratch: Path):
        beats = scratch / "storyboard" / "beats.yaml"
        beats.write_text(
            beats.read_text().replace("objective: ZC-1", "objective: ZC-99"), encoding="utf-8"
        )
        result = plan(Episode.load(scratch))
        assert not result.ok
        assert "does not declare" in result.errors[0].message
        assert "ZC-1, ZC-2" in result.errors[0].fix

    def test_focus_catches_a_refutation_that_does_not_resolve(self, scratch: Path):
        beats = scratch / "storyboard" / "beats.yaml"
        beats.write_text(
            beats.read_text().replace("refutes: ZC-M2", "refutes: ZC-M99"), encoding="utf-8"
        )
        result = plan(Episode.load(scratch))
        assert not result.ok
        assert "claims to refute" in result.errors[0].message

    def test_picture_catches_an_assertion_anchored_to_no_beat(self, scratch: Path):
        picture = scratch / "picture.md"
        picture.write_text(
            picture.read_text().replace("after: zerocopy.instead", "after: zerocopy.nope"),
            encoding="utf-8",
        )
        result = plan(Episode.load(scratch))
        assert not result.ok
        assert "is not a beat" in result.errors[0].message

    def test_picture_warns_when_the_thesis_is_only_prose(self, scratch: Path):
        picture = scratch / "picture.md"
        text = picture.read_text()
        picture.write_text(text[: text.index("```yaml")], encoding="utf-8")
        result = plan(Episode.load(scratch))
        assert result.ok  # a warning, not a gate
        assert any("none machine-checked" in f.message for f in result.findings)

    def test_an_unknown_concept_is_reported_by_closure(self, scratch: Path):
        beats = scratch / "storyboard" / "beats.yaml"
        beats.write_text(
            beats.read_text().replace("concept: zero_copy", "concept: teleportation"),
            encoding="utf-8",
        )
        result = plan(Episode.load(scratch))
        assert not result.ok
        assert "not in the concept SDK" in result.errors[0].message

    def test_require_ok_lists_every_error(self, scratch: Path):
        beats = scratch / "storyboard" / "beats.yaml"
        beats.write_text(
            beats.read_text().replace("objective: ZC-1", "objective: ZC-99"), encoding="utf-8"
        )
        with pytest.raises(StudioError) as exc:
            require_ok(plan(Episode.load(scratch)))
        assert "nothing rendered" in str(exc.value)


class TestReporting:
    def test_the_report_states_the_thesis_and_the_verdict(self, episode: Episode):
        report = plan(episode).report()
        assert "thesis" in report
        assert "machine-checked" in report
        assert "ready to render" in report

    def test_concepts_are_summarised_by_kind(self, episode: Episode):
        summary = summarise_concepts(episode)
        assert "interaction" in summary
        assert "between pointer, memory_buffer" in summary

    def test_findings_render_with_their_fix(self):
        from axiobyte_studio.storyboard.plan import Finding

        rendered = str(Finding("cues", Severity.ERROR, "x", "broke", "fix it"))
        assert "✗ [cues]" in rendered
        assert "→ fix it" in rendered


class TestCli:
    def test_plan_exits_zero_on_a_sound_episode(self, capsys):
        if not EPISODE.exists():
            pytest.skip("the worked episode is not present")
        assert main(["plan", str(EPISODE)]) == 0
        assert "ready to render" in capsys.readouterr().out

    def test_plan_exits_nonzero_on_a_broken_one(self, scratch: Path, capsys):
        beats = scratch / "storyboard" / "beats.yaml"
        beats.write_text(
            beats.read_text().replace('cue: "Instead@10"', 'cue: "hugepage@10"'),
            encoding="utf-8",
        )
        assert main(["plan", str(scratch)]) == 1

    def test_concept_list_shows_participants(self, capsys):
        assert main(["concept", "list", "--kind", "interaction"]) == 0
        assert "⟷" in capsys.readouterr().out

    def test_concept_show_prints_the_removal_test(self, capsys):
        assert main(["concept", "show", "zero_copy"]) == 0
        out = capsys.readouterr().out
        assert "removal test" in out
        assert "without pointer" in out

    def test_concept_stats_reports_the_ratio(self, capsys):
        assert main(["concept", "stats"]) == 0
        assert "interaction ratio" in capsys.readouterr().out

    def test_targets_lists_the_chain_axis_per_format(self, capsys):
        assert main(["targets"]) == 0
        out = capsys.readouterr().out
        assert "chain runs horizontal" in out
        assert "chain runs vertical" in out

    def test_a_studio_error_becomes_exit_one(self, tmp_path, capsys):
        assert main(["plan", str(tmp_path)]) == 1
        assert "is not an episode" in capsys.readouterr().err
