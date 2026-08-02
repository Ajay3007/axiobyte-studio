"""Drift — what a re-cut voiceover did to an episode's beats.

The Studio's error messages have been promising this command since the Timeline
Engine was written: *"The voiceover was probably re-cut. Run `abs timeline drift` to
see what moved."* This is that command.

Re-recording narration is normal — a line is unclear, a take is better, a fact
changes. What is not normal is discovering afterwards that forty beats moved by
0.3 seconds and three no longer point at anything. Every cue is a word, so drift is
computable exactly rather than eyeballed against a waveform.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from axiobyte_studio.core.errors import CueNotFoundError
from axiobyte_studio.timeline.cues import Cue
from axiobyte_studio.timeline.timeline import Timeline, normalise


class Change(StrEnum):
    """What happened to one cue between two recordings."""

    HELD = "held"
    """Within tolerance. Nothing to do."""

    MOVED = "moved"
    """Still resolves, at a different time. Everything anchored to it follows."""

    LOST = "lost"
    """The word is no longer spoken in that scope. This one needs a decision."""

    GAINED = "gained"
    """It did not resolve in the old recording but does now. Not a problem, but
    not "held" either — usually it means the cue was added alongside the re-cut."""


@dataclass(frozen=True, slots=True)
class CueDrift:
    """How one cue fared.

    Attributes:
        name: The cue name.
        cue: What it points at.
        change: What happened.
        before: Where it landed in the old recording, if it resolved there.
        after: Where it lands now, if it still resolves.
        detail: Why it was lost, when it was.
    """

    name: str
    cue: Cue
    change: Change
    before: float | None = None
    after: float | None = None
    detail: str = ""

    @property
    def delta(self) -> float | None:
        """How far it moved, in seconds."""
        if self.before is None or self.after is None:
            return None
        return self.after - self.before

    def __str__(self) -> str:
        """Render as a report line."""
        if self.change is Change.LOST:
            return f"  LOST   {self.name:<28} {self.detail}"
        if self.change is Change.GAINED:
            return f"  gained {self.name:<28}         → {self.after:7.2f}s"
        delta = self.delta or 0.0
        arrow = "→" if abs(delta) > 0 else "="
        mark = "moved " if self.change is Change.MOVED else "held  "
        return (
            f"  {mark} {self.name:<28} {self.before:7.2f}s {arrow} {self.after:7.2f}s"
            f"  ({delta:+.2f}s)"
        )


@dataclass(frozen=True, slots=True)
class Drift:
    """The whole comparison between two recordings.

    Attributes:
        cues: What happened to each cue, in declaration order.
        old_duration: Length of the previous recording.
        new_duration: Length of the current one.
        tolerance: Below this, a move counts as held.
    """

    cues: tuple[CueDrift, ...]
    old_duration: float
    new_duration: float
    tolerance: float = 0.05

    @property
    def lost(self) -> list[CueDrift]:
        """Cues that no longer point at anything. These need a decision."""
        return [c for c in self.cues if c.change is Change.LOST]

    @property
    def moved(self) -> list[CueDrift]:
        """Cues that still resolve, elsewhere. These follow automatically."""
        return [c for c in self.cues if c.change is Change.MOVED]

    @property
    def held(self) -> list[CueDrift]:
        """Cues that did not meaningfully move."""
        return [c for c in self.cues if c.change is Change.HELD]

    @property
    def gained(self) -> list[CueDrift]:
        """Cues that only resolve against the new recording."""
        return [c for c in self.cues if c.change is Change.GAINED]

    @property
    def ok(self) -> bool:
        """Whether the episode still resolves against the new recording."""
        return not self.lost

    @property
    def largest_move(self) -> float:
        """The biggest shift any surviving cue underwent."""
        deltas = [abs(c.delta) for c in self.cues if c.delta is not None]
        return max(deltas) if deltas else 0.0

    def report(self, verbose: bool = False) -> str:
        """Render the comparison for a terminal.

        Args:
            verbose: Include cues that held.

        Returns:
            A multi-line report.
        """
        lines = [
            f"recording: {self.old_duration:.2f}s → {self.new_duration:.2f}s "
            f"({self.new_duration - self.old_duration:+.2f}s)",
            "",
        ]
        shown = self.cues if verbose else [c for c in self.cues if c.change is not Change.HELD]
        lines.extend(str(c) for c in shown)
        if not shown:
            lines.append("  every cue held")
        lines.append("")
        lines.append(
            f"drift: {len(self.held)} held, {len(self.moved)} moved, "
            f"{len(self.gained)} gained, {len(self.lost)} lost"
            f"  ·  largest move {self.largest_move:+.2f}s"
        )
        if self.lost:
            lines.append("")
            lines.append("Lost cues are the only ones that need a decision. Everything anchored")
            lines.append("to a moved cue follows it automatically — that is what anchoring is for.")
        return "\n".join(lines)


def _resolve(timeline: Timeline, cue: Cue) -> tuple[float | None, str]:
    """Resolve one cue against a recording, reporting why if it fails."""
    try:
        word = timeline.find(cue.word, cue.sentence, cue.occurrence)
    except CueNotFoundError:
        elsewhere = [w.sentence for w in timeline.words if normalise(w.text) == normalise(cue.word)]
        if elsewhere:
            where = ", ".join(str(s) for s in sorted(set(elsewhere))[:4])
            return None, f"{cue.word!r} is no longer in sentence {cue.sentence}; now in {where}"
        return None, f"{cue.word!r} is no longer spoken at all"
    return word.start + cue.offset, ""


def compare(
    specs: Mapping[str, Any],
    old: Timeline,
    new: Timeline,
    tolerance: float = 0.05,
) -> Drift:
    """Compare a cue table against two recordings.

    Args:
        specs: Cue names mapped to :class:`Cue` objects or their shorthand.
        old: The previous recording.
        new: The current one.
        tolerance: Below this many seconds, a move counts as held.

    Returns:
        The drift.
    """
    results: list[CueDrift] = []
    for name, spec in specs.items():
        cue = spec if isinstance(spec, Cue) else Cue.parse(spec)
        before, _ = _resolve(old, cue)
        after, why = _resolve(new, cue)

        if after is None:
            change = Change.LOST
        elif before is None:
            change = Change.GAINED
        elif abs(after - before) <= tolerance:
            change = Change.HELD
        else:
            change = Change.MOVED
        results.append(
            CueDrift(
                name=name,
                cue=cue,
                change=change,
                before=before,
                after=after,
                detail=why,
            )
        )
    return Drift(
        cues=tuple(results),
        old_duration=old.duration,
        new_duration=new.duration,
        tolerance=tolerance,
    )
