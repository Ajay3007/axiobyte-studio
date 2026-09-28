"""Renderer selection per shot, shot windows, the Three.js adapter and the composer.

ARCHITECTURE.md §8.0a: a renderer is chosen per shot, never per episode, and the
composer joins clips from any mix of backends. These tests pin the parts of that
which need no renderer installed — the Python CI has neither Node nor Chrome, so
anything that would call them is given a stand-in rather than skipped.
"""

from __future__ import annotations

import hashlib
import shutil
from dataclasses import replace
from itertools import pairwise
from pathlib import Path

import pytest

from axiobyte_studio.backends.three import video as three_video
from axiobyte_studio.backends.three.video import ThreeShotJob
from axiobyte_studio.compose import verify_audio
from axiobyte_studio.core import StudioError
from axiobyte_studio.core.renderers import DEFAULT_RENDERER, RENDERERS
from axiobyte_studio.render.jobs import render_episode
from axiobyte_studio.storyboard import Episode
from axiobyte_studio.storyboard.plan import plan
from axiobyte_studio.storyboard.windows import shot_windows

REPO = Path(__file__).resolve().parents[2]
NIC = REPO / "episodes" / "s01e03-what-is-a-nic"
ZERO_COPY = REPO / "episodes" / "s01e02-zero-copy"


@pytest.fixture
def nic() -> Episode:
    return Episode.load(NIC)


@pytest.fixture
def scratch_nic(tmp_path: Path) -> Path:
    target = tmp_path / NIC.name
    shutil.copytree(NIC, target, ignore=shutil.ignore_patterns("out", "audio"))
    return target


@pytest.fixture
def no_node(monkeypatch: pytest.MonkeyPatch) -> None:
    """Stand in for Node and an installed backend, which the Python CI does not have."""
    monkeypatch.setattr(three_video, "node_binary", lambda: "node")
    monkeypatch.setattr(three_video, "three_root", lambda: REPO / "renderers" / "three")


class TestTheLadder:
    def test_manim_then_three_then_blender(self):
        ranked = sorted(RENDERERS.values(), key=lambda r: r.rank)
        assert [r.id for r in ranked] == ["manim", "three", "blender"]

    def test_only_blender_must_justify_itself(self):
        assert [r.id for r in RENDERERS.values() if r.needs_reason] == ["blender"]

    def test_the_default_is_the_simplest(self):
        assert DEFAULT_RENDERER == "manim"


class TestRendererPerShot:
    def test_an_episode_that_says_nothing_stays_manim(self):
        episode = Episode.load(ZERO_COPY)
        assert episode.renderer == "manim"
        assert episode.shotlist is not None
        assert episode.shotlist.renderers == ["manim"]

    def test_an_episode_default_reaches_every_shot_that_names_none(self, nic: Episode):
        assert nic.shotlist is not None
        assert nic.shotlist.renderers == ["three"]
        assert len(nic.shotlist.by_renderer("three")) == len(nic.shotlist.shots)

    def test_a_shot_can_override_its_episode(self, scratch_nic: Path):
        shots = scratch_nic / "storyboard" / "shots.yaml"
        shots.write_text(
            shots.read_text().replace(
                "{ id: shot_0030_pcb,          act: pcb,   covers: [pcb.board] }",
                "{ id: shot_0030_pcb, act: pcb, covers: [pcb.board], renderer: manim }",
            ),
            encoding="utf-8",
        )
        episode = Episode.load(scratch_nic)
        assert episode.shotlist is not None
        assert episode.shotlist.renderers == ["three", "manim"]
        assert [s.id for s in episode.shotlist.by_renderer("manim")] == ["shot_0030_pcb"]


class TestThePlanChecksTheChoice:
    def _with(self, root: Path, line: str) -> Episode:
        shots = root / "storyboard" / "shots.yaml"
        shots.write_text(
            shots.read_text().replace(
                "{ id: shot_0030_pcb,          act: pcb,   covers: [pcb.board] }", line
            ),
            encoding="utf-8",
        )
        return Episode.load(root)

    def test_the_nic_passes_every_step(self, nic: Episode):
        result = plan(nic)
        assert result.ok, result.report()

    def test_an_unknown_renderer_is_an_error(self, scratch_nic: Path):
        episode = self._with(
            scratch_nic, "{ id: shot_0030_pcb, act: pcb, covers: [pcb.board], renderer: unity }"
        )
        result = plan(episode)
        assert not result.ok
        assert [f.step for f in result.errors] == ["renderers"]

    def test_blender_cannot_render_a_shot_yet_and_must_say_why(self, scratch_nic: Path):
        episode = self._with(
            scratch_nic, "{ id: shot_0030_pcb, act: pcb, covers: [pcb.board], renderer: blender }"
        )
        findings = [f for f in plan(episode).findings if f.step == "renderers"]
        assert {f.severity.value for f in findings} == {"error", "warn"}

    def test_shots_out_of_narrated_order_cannot_tile_the_film(self, scratch_nic: Path):
        shots = scratch_nic / "storyboard" / "shots.yaml"
        lines = shots.read_text().splitlines()
        pcb = next(i for i, line in enumerate(lines) if "shot_0030_pcb" in line)
        rj45 = next(i for i, line in enumerate(lines) if "shot_0040_rj45" in line)
        lines[pcb], lines[rj45] = lines[rj45], lines[pcb]
        shots.write_text("\n".join(lines) + "\n", encoding="utf-8")
        result = plan(Episode.load(scratch_nic))
        assert "renderers" in {f.step for f in result.errors}


class TestShotWindows:
    def test_windows_tile_the_whole_film(self, nic: Episode):
        windows = shot_windows(nic, plan(nic).cues)
        assert windows[0].start == 0.0
        assert windows[-1].end == pytest.approx(nic.film_duration)
        for before, after in pairwise(windows):
            assert before.end == after.start

    def test_frames_neither_gap_nor_overlap(self, nic: Episode):
        windows = shot_windows(nic, plan(nic).cues)
        ranges = [w.frames(30) for w in windows]
        for (_, last), (first, _) in pairwise(ranges):
            assert last == first
        # The same count as the film rendered whole: 719.49 s at 30 fps.
        assert sum(last - first for first, last in ranges) == 21585

    def test_cuts_land_in_silence_between_sentences(self, nic: Episode):
        assert nic.timeline is not None
        for window in shot_windows(nic, plan(nic).cues)[1:]:
            assert nic.timeline.find_sentence(window.start) is None, window.shot.id

    def test_the_film_runs_past_the_voice_by_the_tail(self, nic: Episode):
        assert nic.tail == 1.5
        assert nic.film_duration == pytest.approx(nic.duration + 1.5)


class TestThreeShotJob:
    def test_a_window_is_passed_as_exact_frame_boundaries(self, nic: Episode, no_node: None):
        window = shot_windows(nic, plan(nic).cues)[3]
        argv = ThreeShotJob(NIC, window, Path("out/x.mp4")).command()
        first, last = window.frames(30)
        assert argv[argv.index("--from") + 1] == repr(first / 30)
        assert argv[argv.index("--to") + 1] == repr(last / 30)
        assert "--no-audio" in argv  # sound is laid once, by the composer
        assert "--headless" not in argv

    def test_a_still_renders_no_clip(self, nic: Episode, no_node: None):
        window = shot_windows(nic, plan(nic).cues)[0]
        argv = ThreeShotJob(NIC, window, Path("x.mp4"), still=True, headless=True).command()
        assert "--stills" in argv and "--out" not in argv and "--headless" in argv

    def test_the_fingerprint_moves_with_the_window(self, nic: Episode, no_node: None):
        windows = shot_windows(nic, plan(nic).cues)
        a = ThreeShotJob(NIC, windows[0], Path("x.mp4")).fingerprint()
        b = ThreeShotJob(NIC, windows[1], Path("x.mp4")).fingerprint()
        again = ThreeShotJob(NIC, windows[0], Path("y.mp4")).fingerprint()
        assert a != b
        assert a == again  # where it is written does not change what it is


class TestRenderDispatch:
    def test_a_manim_episode_keeps_its_one_scene_per_target(self):
        result = render_episode(Episode.load(ZERO_COPY), dry_run=True)
        assert [job.target for job in result.jobs] == ["16x9", "9x16"]
        assert result.shot_jobs == []

    def test_a_three_episode_renders_shot_by_shot(self, nic: Episode):
        result = render_episode(nic, dry_run=True)
        assert result.jobs == []
        assert len(result.shot_jobs) == 15

    def test_three_refuses_a_format_it_cannot_lay_out(self, nic: Episode):
        with pytest.raises(StudioError, match="cannot render 9x16"):
            render_episode(nic, targets=["9x16"], dry_run=True)

    def test_a_mixed_episode_asks_each_backend_for_its_own_shots(self, scratch_nic: Path):
        shots = scratch_nic / "storyboard" / "shots.yaml"
        shots.write_text(
            shots.read_text().replace(
                "{ id: shot_0030_pcb,          act: pcb,   covers: [pcb.board] }",
                "{ id: shot_0030_pcb, act: pcb, covers: [pcb.board], renderer: manim }",
            ),
            encoding="utf-8",
        )
        (scratch_nic / "shots").mkdir()
        (scratch_nic / "shots" / "episode.py").write_text(
            "def stage_pcb(scene):\n    pass\n", encoding="utf-8"
        )
        result = render_episode(Episode.load(scratch_nic), dry_run=True)
        assert [job.target for job in result.jobs] == ["16x9"]
        assert len(result.shot_jobs) == 14
        assert "shot_0030_pcb" not in {j.window.shot.id for j in result.shot_jobs}


class TestTheVoiceoverIsPinned:
    def test_a_missing_recording_says_where_to_put_it(self, tmp_path: Path, nic: Episode):
        episode = replace(nic, root=tmp_path)
        with pytest.raises(StudioError, match="never committed"):
            verify_audio(episode)

    def test_a_different_recording_is_refused(self, tmp_path: Path, nic: Episode):
        (tmp_path / "audio").mkdir()
        (tmp_path / "audio" / "voiceover.mpeg").write_bytes(b"a re-recorded take")
        with pytest.raises(StudioError, match="not the recording"):
            verify_audio(replace(nic, root=tmp_path))

    def test_the_pinned_recording_is_accepted(self, tmp_path: Path, nic: Episode):
        take = tmp_path / "audio" / "voiceover.mpeg"
        take.parent.mkdir()
        take.write_bytes(b"the take")
        pinned = {**nic.audio, "sha256": hashlib.sha256(b"the take").hexdigest()}
        assert verify_audio(replace(nic, root=tmp_path, audio=pinned)) == take
