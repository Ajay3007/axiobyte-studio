"""The frame grid: a scene's picture never drifts off its intended timeline.

The regression this guards: Manim rounds every play to whole frames on its own, and
``StudioScene.wait`` used to be counted twice (once by ``wait``, once more — a whole
default second — by ``play``, which Manim's ``wait`` re-enters). Over a film, both
pushed the picture seconds ahead of the voiceover and finished it short, so the
composer refused it. Time is now kept twice — intended seconds, and frames emitted
on that timeline's grid — and the frames are what Manim really renders.
"""

from __future__ import annotations

import importlib.util
import tempfile
from pathlib import Path
from typing import Any

import pytest

from axiobyte_studio.backends.manim.timing import (
    frame_at,
    frames_to_emit,
    manim_frames,
    manim_run_time,
)

REPO = Path(__file__).resolve().parents[2]
RATES = (10, 15, 24, 25, 30, 50, 60)


def _emit(durations: list[float], fps: int, *, static: bool = False) -> list[int]:
    """Frames per play for a run of plays, the way StudioScene schedules them."""
    clock, emitted, counts = 0.0, 0, []
    for duration in durations:
        count = frames_to_emit(clock + duration, emitted, fps, minimum=0 if static else 1)
        clock += duration
        emitted += count
        counts.append(count)
    return counts


@pytest.mark.parametrize("fps", RATES)
def test_manim_renders_exactly_the_frames_asked_for(fps):
    for frames in range(1, 3000):
        assert manim_frames(manim_run_time(frames, fps, static=True), fps, static=True) == frames
    for frames in range(1, 3000):
        assert manim_frames(manim_run_time(frames, fps, static=False), fps, static=False) == frames


def test_no_play_is_asked_for_no_frames():
    # Manim renders at least one frame for any play, so none is not a request it can meet;
    # StudioScene skips a wait that is already on its mark rather than asking.
    for static in (True, False):
        with pytest.raises(ValueError):
            manim_run_time(0, 30, static=static)


def test_the_mirror_includes_manims_one_frame_minimum():
    # Manim raises a run time shorter than a frame to one frame before rounding.
    assert manim_frames(0.01, 30, static=True) == 1
    assert manim_frames(0.01, 30, static=False) == 1
    assert manim_run_time(1, 30, static=False) == 1 / 30  # exactly: no rounding up


@pytest.mark.parametrize("fps", RATES)
def test_fractional_frames_do_not_accumulate(fps):
    # 1,000 plays of a third of a second: each alone is a fractional number of frames.
    counts = _emit([0.333] * 1000, fps)
    assert sum(counts) == round(333.0 * fps)
    # And at every step the picture is within half a frame of the intended clock.
    emitted = 0
    for step, count in enumerate(counts, start=1):
        emitted += count
        assert abs(emitted / fps - 0.333 * step) <= 0.5 / fps + 1e-9


def test_the_old_per_play_rounding_lost_frames_the_grid_does_not():
    # What Manim did on its own: each static hold of 0.333 s at 30 fps froze int(9.99) = 9.
    alone = sum(manim_frames(0.333, 30, static=True) for _ in range(1000))
    assert alone == 9000  # 333 s of holds rendered as 300 s
    assert sum(_emit([0.333] * 1000, 30, static=True)) == 9990  # exactly 333 s


def test_whole_frame_timings_are_unchanged():
    assert _emit([0.5] * 10, 30) == [15] * 10
    assert _emit([1.0] * 5, 24) == [24] * 5
    assert _emit([2.0, 0.1, 0.4], 30) == [60, 3, 12]


def test_no_extra_frames_are_inserted_between_beats():
    # No play is stretched or shortened by more than one frame: each of its two ends
    # sits within half a frame of the intended timeline.
    durations = [0.25, 1.1, 0.75, 0.08, 0.6, 0.4, 3.37, 0.5, 1.9]
    for fps in RATES:
        for duration, count in zip(durations, _emit(durations, fps), strict=True):
            assert abs(count - duration * fps) <= 1.0 + 1e-9
        clock = 0.0
        for duration in durations:
            clock += duration  # accumulated as the scene does, so a half-frame tie agrees
        assert sum(_emit(durations, fps)) == frame_at(clock, fps)


def test_scheduling_is_deterministic():
    durations = [0.333, 0.25, 1.1, 0.08, 0.6] * 40
    assert _emit(durations, 30) == _emit(list(durations), 30)


def test_e02_voiceover_is_6534_frames_at_30_fps():
    assert frame_at(217.809, 30) == 6534
    assert frame_at(217.809, 60) == 13069


# -- the real thing: StudioScene rendered by Manim, every frame counted --------------


@pytest.fixture
def render() -> Any:
    pytest.importorskip("manim", reason="the Manim backend needs manim installed")
    from manim import tempconfig

    def run(scene_class: type, fps: int = 30) -> Any:
        with tempfile.TemporaryDirectory() as media:
            options = {
                "write_to_movie": False,
                "disable_caching": True,
                "frame_rate": fps,
                "verbosity": "ERROR",
                "progress_bar": "none",
                "media_dir": media,
            }
            with tempconfig(options):
                scene = scene_class()
                scene.render()
        # The renderer adds 1/fps for every frame it actually renders.
        return scene, round(scene.renderer.time * fps)

    return run


def test_a_studio_scene_renders_exactly_its_intended_timeline(render):
    from manim import Circle, FadeIn, FadeOut, Square

    from axiobyte_studio.backends.manim import StudioScene

    class Fractional(StudioScene):
        def construct(self) -> None:
            self.cues = {"beat": 5.0}  # type: ignore[assignment]
            square, circle = Square(), Circle()
            for _ in range(4):
                self.play(FadeIn(square), run_time=0.333)
                self.play(FadeOut(square), run_time=0.333)
            for _ in range(3):
                self.wait(0.333)
            # Two animations of different lengths, no run_time: Manim takes the longer.
            self.play(FadeIn(square, run_time=0.25), FadeIn(circle, run_time=0.7))
            self.at("beat")
            self.wait(0.3)
            self.hold_until(7.0)

    scene, rendered = render(Fractional)
    assert scene.clock == pytest.approx(7.0)
    assert rendered == scene.frames == 210  # 7.0 s at 30 fps, frame for frame


def test_a_wait_advances_the_clock_once(render):
    from axiobyte_studio.backends.manim import StudioScene

    seen: list[float] = []

    class Waits(StudioScene):
        def construct(self) -> None:
            self.wait(0.3)
            seen.append(self.clock)
            self.wait(0.8)
            seen.append(self.clock)

    scene, rendered = render(Waits)
    assert seen == [pytest.approx(0.3), pytest.approx(1.1)]  # not 1.3 and 3.1
    assert rendered == scene.frames == 33


def test_a_cue_lands_on_the_grid_after_fractional_plays(render):
    from manim import FadeIn, Square

    from axiobyte_studio.backends.manim import StudioScene

    landed: list[int] = []

    class Cued(StudioScene):
        def construct(self) -> None:
            self.cues = {"one": 2.0, "two": 3.51}  # type: ignore[assignment]
            for _ in range(5):
                self.play(FadeIn(Square()), run_time=0.37)
            self.at("one")
            landed.append(self.frames)
            self.play(FadeIn(Square()), run_time=self.until("two"))
            landed.append(self.frames)

    scene, rendered = render(Cued)
    assert landed == [60, round(3.51 * 30)]
    assert rendered == scene.frames


def test_e02_is_exactly_as_long_as_its_voiceover():
    pytest.importorskip("manim", reason="the Manim backend needs manim installed")
    from manim import tempconfig

    from axiobyte_studio.storyboard import Episode

    root = REPO / "episodes" / "s01e02-zero-copy"
    spec = importlib.util.spec_from_file_location("_e02_timing", root / "shots" / "episode.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with tempfile.TemporaryDirectory() as media:
        options = {
            "dry_run": True,
            "write_to_movie": False,
            "disable_caching": True,
            "frame_rate": 30,
            "verbosity": "ERROR",
            "progress_bar": "none",
            "media_dir": media,
        }
        with tempconfig(options):
            scene = module.SCENES["16x9"]()
            scene.render()
    duration = Episode.load(root).film_duration
    assert scene.clock == pytest.approx(duration)
    assert scene.frames == frame_at(duration, 30) == 6534


# -- edge cases, rendered ------------------------------------------------------------


def test_a_hold_less_than_a_frame_from_its_target_lands_on_it(render):
    from manim import FadeIn, Square

    from axiobyte_studio.backends.manim import StudioScene

    class Close(StudioScene):
        def construct(self) -> None:
            self.play(FadeIn(Square()), run_time=6.99)
            self.hold_until(7.0)  # 0.01 s to go: Manim alone would hold a whole frame

    scene, rendered = render(Close)
    assert scene.clock == pytest.approx(7.0)
    assert rendered == scene.frames == 210


def test_hold_until_a_moment_reached_or_passed_adds_nothing(render):
    from manim import FadeIn, Square

    from axiobyte_studio.backends.manim import StudioScene

    class Held(StudioScene):
        def construct(self) -> None:
            self.play(FadeIn(Square()), run_time=2.0)
            self.hold_until(2.0)  # already there
            self.hold_until(1.0)  # already past
            self.hold_until(2.5)  # later: half a second, exactly

    scene, rendered = render(Held)
    assert scene.clock == pytest.approx(2.5)
    assert rendered == scene.frames == 75


def test_a_wait_shorter_than_a_frame_advances_the_clock_by_itself(render):
    from manim import FadeIn, Square

    from axiobyte_studio.backends.manim import StudioScene

    seen: list[tuple[float, int]] = []

    class Tiny(StudioScene):
        def construct(self) -> None:
            self.wait(0.01)
            seen.append((self.clock, self.frames))
            self.play(FadeIn(Square()), run_time=0.99)  # ends at 1.0 s: 30 frames in all
            seen.append((self.clock, self.frames))

    _, rendered = render(Tiny)
    assert seen == [(pytest.approx(0.01), 0), (pytest.approx(1.0), 30)]
    assert rendered == 30


def test_an_animation_shorter_than_a_frame_is_seen_and_the_grid_catches_up(render):
    from manim import FadeIn, Square

    from axiobyte_studio.backends.manim import StudioScene

    counts: list[int] = []

    class Blink(StudioScene):
        def construct(self) -> None:
            self.play(FadeIn(Square()), run_time=0.01)  # under a frame: still one frame
            counts.append(self.frames)
            self.play(FadeIn(Square()), run_time=0.99)
            counts.append(self.frames)

    _, rendered = render(Blink)
    assert counts == [1, 30]  # the extra frame is absorbed; the total is still 1.0 s
    assert rendered == 30


def test_animations_in_one_play_keep_their_relative_timing(render):
    from manim import Circle, FadeIn, Square

    from axiobyte_studio.backends.manim import StudioScene

    played: list[Any] = []

    class Together(StudioScene):
        def construct(self) -> None:
            self.wait(0.02)  # off the grid, so the play below is fitted
            short, long = FadeIn(Square(), run_time=0.25), FadeIn(Circle(), run_time=0.7)
            self.play(short, long)
            played.extend([short, long])

    scene, rendered = render(Together)
    short, long = played
    assert short.run_time / long.run_time == pytest.approx(0.25 / 0.7)
    assert scene.clock == pytest.approx(0.72)
    assert rendered == scene.frames == round(0.72 * 30)


@pytest.mark.parametrize("seconds", [0, -0.5])
def test_a_duration_that_is_not_positive_is_refused(render, seconds):
    from manim import FadeIn, Square

    from axiobyte_studio.backends.manim import StudioScene

    class Played(StudioScene):
        def construct(self) -> None:
            self.play(FadeIn(Square()), run_time=seconds)

    class Waited(StudioScene):
        def construct(self) -> None:
            self.wait(seconds)

    # Refused with a ValueError, as Manim refuses it — never a ZeroDivisionError, and
    # never quietly rounded up to a frame. (Manim itself rejects a negative run_time on
    # the animation, before StudioScene sees it.)
    for scene_class in (Played, Waited):
        with pytest.raises(ValueError, match=r"positive|negative"):
            render(scene_class)
