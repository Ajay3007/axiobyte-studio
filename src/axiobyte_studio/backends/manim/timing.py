"""The frame grid: how a scene's intended timeline becomes whole frames.

Manim turns each ``play`` into frames on its own, and rounds each one independently:
an animation of ``t`` seconds renders ``len(arange(0, t, 1/fps))`` frames (rounding
up), a static wait renders ``int(t * fps)`` (rounding down). Summed over a film of
dozens of plays and waits, those per-call fractions are lost or gained for good, and
the picture drifts off the voiceover it was cued to.

So a scene keeps two clocks. The *intended* time is exact seconds — what cues, beats
and ``until()`` reason in. The *frame count* is what has actually been emitted. Each
play advances the intended time by its run time, then emits exactly as many frames
as it takes to bring the frame count to the intended time's place on the grid. The
rounding happens once, against the absolute timeline, so it never accumulates: the
picture is always within half a frame of where the narration says it should be.
"""

from __future__ import annotations

import numpy as np

#: How far inside a frame boundary a run time is placed, in frames, so that Manim's
#: float arithmetic cannot land it on the wrong side. Far larger than float error
#: (~1e-12 frames), far smaller than anything a viewer could see.
MARGIN = 1e-3


def frame_at(seconds: float, fps: int) -> int:
    """The frame a moment on the intended timeline falls on.

    Rounds to the nearest frame, the same way a composed film's shot windows are
    cut (``ShotWindow.frames``), so a scene held to the voiceover's end has exactly
    the frames the composer expects.

    Args:
        seconds: A time on the intended timeline.
        fps: Frame rate.

    Returns:
        The frame index.
    """
    return round(seconds * fps)


def frames_to_emit(intended_end: float, emitted: int, fps: int, *, minimum: int) -> int:
    """How many frames a play must render to bring the picture to its intended end.

    Args:
        intended_end: Where the intended timeline will be once the play is done.
        emitted: Frames rendered so far.
        fps: Frame rate.
        minimum: The fewest frames to render. An animation always renders at least
            one, so it is seen; a wait may render none, when the picture is already
            on its mark.

    Returns:
        The number of frames.
    """
    return max(minimum, frame_at(intended_end, fps) - emitted)


def manim_frames(run_time: float, fps: int, *, static: bool) -> int:
    """How many frames Manim 0.20 renders for one ``play`` of ``run_time`` seconds.

    Mirrors Manim exactly. A run time shorter than one frame is first raised to one
    frame (``Scene.validate_run_time``). Then a static wait is frozen for
    ``int(run_time / dt)`` frames (``CairoRenderer.freeze_current_frame``), and
    anything else renders one frame per step of ``np.arange(0, run_time, dt)``
    (``Scene.get_time_progression``).

    Args:
        run_time: The play's run time.
        fps: Frame rate.
        static: Whether Manim takes the frozen-frame path.

    Returns:
        The number of frames.
    """
    dt = 1 / fps
    run_time = max(run_time, dt)
    if static:
        return int(run_time / dt)
    return len(np.arange(0, run_time, dt))


def manim_run_time(frames: int, fps: int, *, static: bool) -> float:
    """A run time for which Manim renders exactly ``frames`` frames.

    Placed a hair inside the frame boundary from whichever side Manim rounds — above
    it for a static wait (rounded down), below it for an animation (rounded up) — so
    float error cannot add or drop a frame. An animation plays across its frames at
    the same pace as one of exactly ``frames / fps`` seconds, to within ``MARGIN``.
    A single animated frame is exactly one frame long, the shortest run time Manim
    accepts as it is.

    Args:
        frames: The frames to render, at least one: Manim renders no play in none.
        fps: Frame rate.
        static: Whether Manim takes the frozen-frame path.

    Returns:
        The run time to give Manim.

    Raises:
        ValueError: No frames were asked for.
    """
    if frames < 1:
        raise ValueError("Manim renders at least one frame for every play")
    if static:
        return (frames + MARGIN) / fps
    return max((frames - MARGIN) / fps, 1 / fps)
