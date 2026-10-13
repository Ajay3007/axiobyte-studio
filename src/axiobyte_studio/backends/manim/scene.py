"""``StudioScene`` — the single Manim scene every episode renders through.

Two things it does that a plain ``Scene`` does not.

**Time is inherited, never invented.** ``self.at("cue")`` seeks to a word start in
the voiceover. There is no ``wait(1.3)`` anywhere in an episode, so a re-cut
narration moves every beat with it rather than drifting the film out of sync.

**Chrome rides the camera.** The keyword and caption are attached to
``camera.frame`` by updaters, so a push-in neither crops them nor scales them into
a second copy of themselves — the behaviour the reference episodes established.
"""

from __future__ import annotations

from typing import Any, ClassVar

import numpy as np
from manim import (
    DOWN,
    FadeIn,
    FadeOut,
    FadeTransform,
    Mobject,
    MovingCameraScene,
    Text,
    VGroup,
    Wait,
    config,
)

from axiobyte_studio.actions.scene import Scene as StudioSceneModel
from axiobyte_studio.backends.manim import space, timing
from axiobyte_studio.backends.manim.shapes import draw
from axiobyte_studio.chrome.pinned import ChromeSlot, caption_bar, keyword_bar, stage_box
from axiobyte_studio.core.errors import ConceptError, StudioError
from axiobyte_studio.design.theme import DEFAULT_THEME, Theme, theme
from axiobyte_studio.layout.frame import Target
from axiobyte_studio.layout.frame import target as load_target
from axiobyte_studio.layout.solve import SolvedLayout, solve
from axiobyte_studio.timeline.cues import CueTable
from axiobyte_studio.typography.style import style


class _Pinned:
    """Attaches a mobject to an edge of the camera frame.

    Reimplements the reference episodes' pinning: the element keeps a constant
    *apparent* size and position however the camera moves, because it belongs to
    the viewer rather than to the world being filmed.
    """

    def __init__(self, scene: MovingCameraScene, slot: ChromeSlot, target: Target) -> None:
        self.scene = scene
        self.slot = slot
        self.target = target
        self.mob: Mobject | None = None
        self._base_width = 0.0

    def _apply(self, mob: Mobject) -> None:
        """Keep the element sized and placed against the live camera frame."""
        frame = self.scene.camera.frame
        _, frame_height = space.frame_size(self.target)
        scale = frame.height / frame_height
        want = self._base_width * scale
        if want > 0 and abs(mob.width - want) > 1e-4:
            mob.scale_to_fit_width(want)
        cy = self.slot.box.center[1]
        offset = (0.5 - cy) * frame.height
        centre = frame.get_center()
        mob.move_to(np.array([centre[0], centre[1] + offset, 0.0]))

    def show(self, mob: Mobject, run_time: float = 0.6) -> None:
        """Transition to a new element, or fade the first one in."""
        self._base_width = mob.width
        self._apply(mob)
        if self.mob is None:
            self.scene.play(FadeIn(mob, shift=DOWN * 0.14), run_time=run_time)
        else:
            self.mob.clear_updaters()
            self.scene.play(FadeTransform(self.mob, mob), run_time=run_time)
        mob.add_updater(self._apply)
        self.mob = mob


def _require_positive(seconds: float, method: str, name: str) -> None:
    """Refuse a non-positive duration, as Manim does — without its one-frame minimum.

    Manim's ``validate_run_time`` also raises anything under a frame to a whole frame.
    Applied to the intended clock, that would add time no one asked for; the frame
    grid already gives every animation at least one frame.
    """
    if seconds <= 0:
        raise ValueError(
            f"{method} has a {name} of {seconds:g} <= 0 seconds which Manim cannot render. "
            f"The {name} must be a positive number."
        )


class StudioScene(MovingCameraScene):
    """Base scene for every Studio render.

    Subclasses set :attr:`target_id` and provide a cue table, then describe the
    shot. Nothing about aspect ratio, palette or timing is hardcoded in the
    subclass — all three are resolved from the profile, the theme and the voiceover.

    Attributes:
        target_id: Which format profile to render.
        theme_name: Which theme supplies role values.
        platform: Platform whose UI must stay clear, e.g. ``"reels"``.
    """

    target_id: ClassVar[str] = "16x9"
    theme_name: ClassVar[str] = DEFAULT_THEME
    platform: ClassVar[str | None] = None

    def __init__(self, **kwargs: Any) -> None:
        self.target: Target = load_target(self.target_id)
        space.configure(self.target)
        self.theme: Theme = theme(self.theme_name)
        self.cues: CueTable | None = None
        # Two clocks (see ``timing``): the intended timeline in exact seconds, and the
        # frames actually rendered — kept on the grid of the first, never drifting.
        self._clock = 0.0
        self._frames = 0
        self._keyword: _Pinned | None = None
        self._caption: _Pinned | None = None
        super().__init__(**kwargs)

    def setup(self) -> None:
        """Paint the canvas before anything is added."""
        self.camera.background_color = self.theme.ground["bg"]

    # -- time ---------------------------------------------------------------

    @property
    def clock(self) -> float:
        """Seconds elapsed on the intended timeline, tracked against the voiceover."""
        return self._clock

    @property
    def frames(self) -> int:
        """Frames rendered so far: always the intended timeline's place on the frame grid."""
        return self._frames

    def at(self, cue: str) -> None:
        """Wait until a named moment in the narration.

        Args:
            cue: The cue name, resolved against the episode's cue table.

        Raises:
            StudioError: No cue table was supplied, or the beat has already passed
                — which means two cues are out of order, not that the wait is
                merely negative.
        """
        if self.cues is None:
            raise StudioError(
                "This scene has no cue table",
                fix="Set `self.cues = CueTable.resolve(...)` before calling at().",
            )
        when = self.cues[cue]
        delta = when - self._clock
        if delta < -1e-3:
            raise StudioError(
                f"Cue {cue!r} is at t={when:.2f}s but the film is already at {self._clock:.2f}s",
                fix=(
                    "Beats cannot run backwards. Check the cue's sentence index, or "
                    "run `abs timeline drift` if the voiceover was re-cut."
                ),
            )
        if delta > 0:
            self.wait(delta)
            self._clock = when

    def window(self, cue: str) -> float:
        """Seconds from the present moment until a cue.

        Args:
            cue: The cue to measure to.

        Returns:
            The gap, in seconds. Zero when the cue has already passed.

        Raises:
            StudioError: No cue table was supplied.
        """
        if self.cues is None:
            raise StudioError(
                "This scene has no cue table",
                fix="Set `self.cues = CueTable.resolve(...)` before measuring a window.",
            )
        return max(0.0, self.cues[cue] - self._clock)

    def until(self, cue: str, minimum: float = 0.08) -> float:
        """A run time that lands exactly on a cue.

        The third way to anchor time, alongside ``at()`` and a motion's own
        duration: *fill the gap*. Two cues 0.32 s apart cannot hold a 0.45 s
        animation, and guessing a number that happens to fit today is what makes a
        film fragile the moment the voiceover is re-cut. ``until()`` asks the
        narration how long there is.

        Args:
            cue: The cue the animation should land on.
            minimum: Floor, so a very tight gap still produces visible motion.

        Returns:
            A run time in seconds.
        """
        return max(minimum, self.window(cue))

    def play(self, *args: Any, **kwargs: Any) -> None:
        """Play animations, advancing the scene clock — on the frame grid.

        The intended timeline advances by the play's run time, exactly. The play is
        then given precisely the frames that bring the picture to that moment's place
        on the frame grid, so Manim's per-play rounding can never accumulate into
        drift against the voiceover. Several animations in one play keep their
        relative timing; only the whole is fitted to the grid.

        Args:
            *args: Animations.
            **kwargs: Passed through to Manim, including ``run_time``.
        """
        subtitles = {
            key: kwargs.pop(key)
            for key in ("subcaption", "subcaption_duration", "subcaption_offset")
            if key in kwargs
        }
        animations = self.compile_animations(*args, **kwargs)
        if not animations:
            super().play(*args, **subtitles, **kwargs)
            return
        requested = max(animation.run_time for animation in animations)
        _require_positive(requested, f"{type(self).__name__}.play()", "run_time")
        static = self._is_static_wait(animations)
        fps = int(config.frame_rate)
        count = timing.frames_to_emit(
            self._clock + requested, self._frames, fps, minimum=0 if static else 1
        )
        self._clock += requested
        if count == 0:
            return  # a wait the picture is already on the mark for
        fitted = timing.manim_run_time(count, fps, static=static)
        for animation in animations:
            animation.run_time = animation.run_time * fitted / requested
        super().play(*animations, **subtitles)
        self._frames += count

    def wait(
        self,
        duration: float = 1.0,
        stop_condition: Any = None,
        frozen_frame: Any = None,
    ) -> None:
        """Hold, advancing the scene clock once, on the frame grid.

        Manim's own ``wait`` re-enters :meth:`play`, which would count the hold a
        second time; so the wait is played here directly, and counted there alone.
        A hold shorter than a frame advances the clock by exactly its duration —
        never by the whole frame Manim would round it up to.

        Args:
            duration: Seconds to hold.
            stop_condition: Passed through to Manim. A hold cut short by it still
                advances the clock its full duration.
            frozen_frame: Passed through to Manim.
        """
        _require_positive(duration, f"{type(self).__name__}.wait()", "duration")
        self.play(Wait(run_time=duration, stop_condition=stop_condition, frozen_frame=frozen_frame))

    def hold_until(self, seconds: float) -> None:
        """Hold the last picture until a moment on the intended timeline.

        Used to carry the final frame to the end of the voiceover, so the picture is
        exactly as long as the film it is composed into.

        Args:
            seconds: The moment to hold until. Nothing happens if it has passed.
        """
        if seconds > self._clock:
            self.wait(seconds - self._clock)

    def _is_static_wait(self, animations: list[Any]) -> bool:
        """Whether Manim will freeze the frame for this play — decided here, once.

        The same test Manim applies (``Scene.should_update_mobjects``), settled on
        the Wait itself before playing, so the frame count is computed for the path
        Manim actually takes.
        """
        if len(animations) != 1 or not isinstance(animations[0], Wait):
            return False
        wait = animations[0]
        # Typed bool in Manim, but None until decided — exactly what Manim itself tests.
        decided: Any = wait.is_static_wait
        if decided is None:
            wait.is_static_wait = not (
                self.always_update_mobjects
                or self.updaters
                or wait.stop_condition is not None
                or any(mob.has_time_based_updater() for mob in self.get_mobject_family_members())
            )
        return bool(wait.is_static_wait)

    # -- staging ------------------------------------------------------------

    def solve_shot(self, relation: Any, **kwargs: Any) -> SolvedLayout:
        """Solve a shot into the stage — the space left once chrome has its share.

        Episodes should always go through this rather than calling ``solve``
        directly, because solving into the full safe area is how a diagram ends up
        underneath a caption.

        Args:
            relation: The shot's root relation.
            **kwargs: Passed to the solver, e.g. ``cognitive_budget``.

        Returns:
            The solved layout.
        """
        return solve(
            relation,
            self.target,
            platform=self.platform,
            content=stage_box(self.target, self.platform),
            **kwargs,
        )

    def stage(
        self, model: StudioSceneModel, layout: SolvedLayout, phase: int = 0
    ) -> dict[str, VGroup]:
        """Draw every actor of a scene into its solved position.

        Args:
            model: The semantic scene holding the actors.
            layout: The solved layout for this target.
            phase: Which reveal to draw.

        Returns:
            The drawn groups, keyed by the slot name they were placed at.

        Raises:
            ConceptError: A layout slot has no actor to fill it. Skipping it
                silently would let a shot declare something it never casts and
                simply not draw it, which is exactly the class of bug that only
                surfaces on watching the finished render.
        """
        drawn: dict[str, VGroup] = {}
        for slot, box in layout.phases[phase].boxes.items():
            actor = model.actors.get(slot) or self._by_slot(model, slot)
            if actor is None:
                raise ConceptError(
                    f"The layout places {slot!r} but nothing in the scene fills it",
                    context={"cast": ", ".join(sorted(model.actors)) or "nothing"},
                    fix=(
                        f"Cast an actor for {slot!r}, or remove it from the shot's "
                        "relations. A declared slot that draws nothing is a hole in "
                        "the frame."
                    ),
                )
            drawn[slot] = draw(actor, box, self.target, self.theme)
        return drawn

    @staticmethod
    def _by_slot(model: StudioSceneModel, slot: str) -> Any:
        """Match a layout slot to an actor by concept when ids do not line up."""
        for actor in model.actors.values():
            if actor.concept == slot or actor.instance == slot:
                return actor
        return None

    # -- chrome -------------------------------------------------------------

    def keyword(self, text: str, role: str = "packet", run_time: float = 0.5) -> None:
        """Set the pinned chapter keyword.

        Args:
            text: The keyword. One at a time, never popped on.
            role: Which role colours it.
            run_time: Transition length.
        """
        slot = keyword_bar(self.target, self.platform)
        if self._keyword is None:
            self._keyword = _Pinned(self, slot, self.target)
        self._keyword.show(self._chrome_text(text, slot, self.theme.role(role).hue), run_time)

    def caption(self, text: str, run_time: float = 0.4) -> None:
        """Set the pinned narration caption.

        Args:
            text: The caption. One idea per card.
            run_time: Transition length.
        """
        slot = caption_bar(self.target, self.platform)
        if self._caption is None:
            self._caption = _Pinned(self, slot, self.target)
        self._caption.show(self._chrome_text(text, slot, self.theme.ink["primary"]), run_time)

    def chrome_mobjects(self) -> list[Mobject]:
        """The pinned furniture currently on screen.

        Args:
            None.

        Returns:
            The keyword and caption mobjects, if any.
        """
        return [p.mob for p in (self._keyword, self._caption) if p is not None and p.mob]

    def clear_stage(self, run_time: float = 0.4) -> None:
        """Fade out the scene, leaving the chrome where it is.

        Never sweep ``scene.mobjects`` directly. Chrome rides ``camera.frame``
        through an updater that closes over this scene, so anything Manim
        serialises — its render cache, notably — follows that reference into the
        file writer and its thread locks. Chrome belongs to the viewer, not to the
        act; an act ends, the keyword does not.

        Args:
            run_time: How long the fade takes.
        """
        pinned = {id(m) for m in self.chrome_mobjects()}
        staged = [m for m in self.mobjects if id(m) not in pinned]
        if staged:
            self.play(*[FadeOut(m) for m in staged], run_time=run_time)

    def _chrome_text(self, text: str, slot: ChromeSlot, colour: str) -> VGroup:
        """Build a chrome line, wrapped to the width the slot actually has."""
        text_style = style(slot.rung, self.target)
        lines = text_style.wrap(text, self.target) or [text]
        group = VGroup(
            *[
                Text(
                    line,
                    font=text_style.faces[-1],
                    font_size=text_style.size_px,
                    color=colour,
                    weight="BOLD" if text_style.weight == "bold" else "NORMAL",
                )
                for line in lines
            ]
        ).arrange(DOWN, buff=space.units(10))
        group.set_z_index(25)
        return group
