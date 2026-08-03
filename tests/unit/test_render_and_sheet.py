"""The render gate, and the board you approve before animating.

The gate is the point: :func:`render_episode` runs the plan cascade itself, so
there is no path to a frame that skipped validation.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from xml.etree import ElementTree

import pytest

from axiobyte_studio.core import StudioError
from axiobyte_studio.render import RenderJob, render_episode, scene_module, scene_name
from axiobyte_studio.storyboard import Episode, contact_sheet, plan

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
    shutil.copytree(EPISODE, target)
    return target


class TestTheGate:
    """Nothing renders until the plan passes. Not as advice — as control flow."""

    def test_a_sound_episode_produces_one_job_per_target(self, episode: Episode):
        result = render_episode(episode, dry_run=True)
        assert [job.target for job in result.jobs] == list(episode.targets)

    def test_a_broken_cue_table_blocks_every_target(self, scratch: Path):
        beats = scratch / "storyboard" / "beats.yaml"
        beats.write_text(
            beats.read_text().replace('cue: "Instead@10"', 'cue: "hugepage@10"'),
            encoding="utf-8",
        )
        with pytest.raises(StudioError) as exc:
            render_episode(Episode.load(scratch), dry_run=True)
        assert "nothing rendered" in str(exc.value)

    def test_an_unteachable_order_blocks_rendering(self, scratch: Path):
        manifest = scratch / "episode.yaml"
        manifest.write_text(
            manifest.read_text().replace(
                "assumed: [packet, memory_buffer, pointer, mbuf, mempool, nic, cpu]",
                "assumed: [packet]",
            ),
            encoding="utf-8",
        )
        with pytest.raises(StudioError) as exc:
            render_episode(Episode.load(scratch), dry_run=True)
        assert "nothing rendered" in str(exc.value)

    def test_an_episode_with_no_shots_module_is_refused(self, scratch: Path):
        shutil.rmtree(scratch / "shots")
        with pytest.raises(StudioError) as exc:
            render_episode(Episode.load(scratch), dry_run=True)
        assert "no shots module" in str(exc.value)

    def test_an_unknown_quality_is_refused_before_planning(self, episode: Episode):
        with pytest.raises(StudioError) as exc:
            render_episode(episode, quality="cinematic", dry_run=True)
        assert "Draft first" in str(exc.value)

    def test_targets_can_be_narrowed(self, episode: Episode):
        result = render_episode(episode, targets=["16x9"], dry_run=True)
        assert [job.target for job in result.jobs] == ["16x9"]


class TestJobs:
    def test_scene_names_follow_the_convention(self):
        assert scene_name("16x9") == "Episode16x9"
        assert scene_name("9x16") == "Episode9x16"

    def test_the_module_is_the_episode_s_own(self, episode: Episode):
        assert scene_module(episode).name == "episode.py"

    def test_a_still_job_asks_for_one_frame(self):
        job = RenderJob(target="16x9", scene="Episode16x9", module=Path("x.py"), still=True)
        argv = job.command(Path("out"), fps=30)
        assert "-s" in argv and "--format=png" in argv
        assert "--fps" not in argv

    def test_a_video_job_carries_the_frame_rate(self):
        job = RenderJob(target="16x9", scene="Episode16x9", module=Path("x.py"))
        argv = job.command(Path("out"), fps=60)
        assert argv[argv.index("--fps") + 1] == "60"

    def test_it_uses_the_manim_from_this_environment(self):
        # Falling back to PATH first would pick up a system install that may not
        # share this environment at all.
        job = RenderJob(target="16x9", scene="S", module=Path("x.py"))
        assert (
            ".venv" in job.command(Path("out"), 30)[0] or "manim" in job.command(Path("out"), 30)[0]
        )

    def test_quality_maps_to_a_manim_flag(self):
        for quality, flag in (("draft", "-ql"), ("high", "-qh")):
            job = RenderJob(target="16x9", scene="S", module=Path("x.py"), quality=quality)
            assert flag in job.command(Path("out"), 30)


class TestContactSheet:
    def test_renders_valid_xml(self, episode: Episode):
        root = ElementTree.fromstring(contact_sheet.render(episode))
        assert root.tag.endswith("svg")

    def test_shows_every_beat(self, episode: Episode):
        svg = contact_sheet.render(episode)
        assert episode.beatmap is not None
        for beat in episode.beatmap.beats:
            assert beat.id in svg

    def test_leads_with_the_thesis(self, episode: Episode):
        svg = contact_sheet.render(episode)
        assert episode.picture is not None
        assert episode.picture.thesis.splitlines()[0][:30] in svg

    def test_shows_real_times_when_cues_are_resolved(self, episode: Episode):
        resolved = plan(episode).cues
        svg = contact_sheet.render(episode, resolved)
        assert "46.27s" in svg  # zerocopy.instead
        assert "—" not in svg.split("</text>")[3]

    def test_leaves_times_blank_rather_than_guessing(self, episode: Episode):
        assert "—" in contact_sheet.render(episode, None)

    def test_names_each_concept_and_its_kind(self, episode: Episode):
        svg = contact_sheet.render(episode)
        assert "zero_copy" in svg
        assert "interaction" in svg

    def test_is_self_contained(self, episode: Episode):
        svg = contact_sheet.render(episode).replace('xmlns="http://www.w3.org/2000/svg"', "")
        for forbidden in ("http://", "https://", "<image"):
            assert forbidden not in svg

    def test_writes_next_to_the_storyboard(self, scratch: Path):
        written = contact_sheet.write(Episode.load(scratch))
        assert written.name == "board.svg"
        assert written.parent.name == "storyboard"
        assert written.read_text(encoding="utf-8").startswith("<svg")


class TestStagingVerification:
    """The check that actually bites.

    Plan's coverage step verifies the *storyboard* is complete. It cannot verify the
    *code* is, because it must not import a renderer. A derived shot list covers
    every beat by construction, so without this a whole act can be planned, cued and
    silently never drawn — which is exactly what s01e02 did.
    """

    def test_the_worked_episode_stages_every_shot(self, episode: Episode):
        from axiobyte_studio.render import verify_staging

        assert verify_staging(episode) == []

    def _drop_an_act(self, scratch: Path) -> None:
        """Stage only the second act, while the storyboard still declares both.

        This is the realistic shape of the bug: the beat map has two acts, the
        module draws one, and everything else passes.
        """
        module = scratch / "shots" / "episode.py"
        text = module.read_text()
        text = text.replace("acts=(stage_traditional, stage_zerocopy),", "acts=(stage_zerocopy,),")
        text = text.replace("def stage_traditional(", "def _retired_traditional(")
        module.write_text(text, encoding="utf-8")

    def test_a_missing_staging_function_is_reported(self, scratch: Path):
        from axiobyte_studio.render import verify_staging

        self._drop_an_act(scratch)
        assert verify_staging(Episode.load(scratch)) == ["stage_traditional"]

    def test_a_missing_staging_function_blocks_the_render(self, scratch: Path):
        self._drop_an_act(scratch)
        with pytest.raises(StudioError) as exc:
            render_episode(Episode.load(scratch), dry_run=True)
        assert "no staging" in str(exc.value)
        assert "cued and never drawn" in str(exc.value)

    def test_an_act_named_in_the_scene_list_but_undefined_fails_at_import(self, scratch: Path):
        # Generating scenes from the act tuple made this stricter than it was: a
        # renamed act no longer merely goes undrawn, it stops the module loading.
        module = scratch / "shots" / "episode.py"
        module.write_text(
            module.read_text().replace("def stage_traditional(", "def _retired("),
            encoding="utf-8",
        )
        with pytest.raises(StudioError) as exc:
            render_episode(Episode.load(scratch), dry_run=True)
        assert "could not be imported" in str(exc.value)
        assert "stage_traditional" in str(exc.value)

    def test_an_unimportable_module_names_the_error(self, scratch: Path):
        module = scratch / "shots" / "episode.py"
        module.write_text("import nonexistent_module_xyz\n", encoding="utf-8")
        with pytest.raises(StudioError) as exc:
            render_episode(Episode.load(scratch), dry_run=True)
        assert "could not be imported" in str(exc.value)


class TestShotList:
    def test_one_shot_per_act_is_derived_by_default(self, episode: Episode):
        assert episode.shotlist is not None
        assert episode.shotlist.derived
        assert [s.act for s in episode.shotlist.shots] == ["traditional", "zerocopy"]

    def test_shot_ids_step_by_ten(self, episode: Episode):
        assert episode.shotlist is not None
        assert episode.shotlist.shots[0].id.startswith("shot_0010")
        assert episode.shotlist.shots[1].id.startswith("shot_0020")

    def test_a_derived_list_covers_every_beat(self, episode: Episode):
        assert episode.shotlist is not None and episode.beatmap is not None
        assert episode.shotlist.uncovered(episode.beatmap) == []

    def test_a_declared_list_can_leave_a_beat_uncovered(self, scratch: Path):
        (scratch / "storyboard" / "shots.yaml").write_text(
            "shots:\n  - id: shot_0010_zerocopy\n    act: zerocopy\n"
            "    covers: [zerocopy.instead]\n",
            encoding="utf-8",
        )
        loaded = Episode.load(scratch)
        assert loaded.shotlist is not None and loaded.beatmap is not None
        assert not loaded.shotlist.derived
        assert "traditional.networking" in loaded.shotlist.uncovered(loaded.beatmap)

    def test_plan_rejects_an_uncovered_teaching_beat(self, scratch: Path):
        (scratch / "storyboard" / "shots.yaml").write_text(
            "shots:\n  - id: shot_0010_zerocopy\n    act: zerocopy\n"
            "    covers: [zerocopy.instead]\n",
            encoding="utf-8",
        )
        result = plan(Episode.load(scratch))
        assert not result.ok
        assert any("no shot stages it" in f.message for f in result.errors)

    def test_plan_rejects_a_shot_covering_an_unknown_beat(self, scratch: Path):
        (scratch / "storyboard" / "shots.yaml").write_text(
            "shots:\n  - id: shot_0010_all\n    act: zerocopy\n"
            "    covers: [traditional.networking, traditional.copied, zerocopy.instead,\n"
            "             zerocopy.reference, zerocopy.mbuf, zerocopy.ghost]\n",
            encoding="utf-8",
        )
        result = plan(Episode.load(scratch))
        assert not result.ok
        assert any("not a declared beat" in f.message for f in result.errors)

    def test_shot_for_finds_the_staging(self, episode: Episode):
        assert episode.shotlist is not None
        shot = episode.shotlist.shot_for("zerocopy.mbuf")
        assert shot is not None
        assert shot.stage_function == "stage_zerocopy"
