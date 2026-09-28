"""Shot windows — the stretch of the film each shot is responsible for.

Renderers are chosen per shot (ARCHITECTURE.md §8.0a), so a film is assembled from
clips that different backends produced. That only works if the shots *tile* the
film: every frame belongs to exactly one shot, and no two shots claim the same one.

A window runs from the cut before a shot to the cut before the next. A cut is
placed in the silence before the sentence that carries the shot's first beat —
midway between the previous sentence's last word and this one's first — because
a hard cut on a word is audible and a cut in a pause is not. The first shot
starts at zero; the last ends where the picture does, voiceover plus tail.

Nothing here renders or imports a renderer. It is timing, derived from the cue
table the plan already resolved.
"""

from __future__ import annotations

from dataclasses import dataclass
from itertools import pairwise

from axiobyte_studio.core.errors import StudioError
from axiobyte_studio.storyboard.episode import Episode
from axiobyte_studio.storyboard.shotlist import Shot
from axiobyte_studio.timeline.cues import CueTable


@dataclass(frozen=True, slots=True)
class ShotWindow:
    """One shot's stretch of the film, in seconds.

    Attributes:
        shot: The shot.
        start: First instant it owns.
        end: The instant the next shot takes over.
    """

    shot: Shot
    start: float
    end: float

    @property
    def duration(self) -> float:
        """Length of the window, in seconds."""
        return self.end - self.start

    def frames(self, fps: int) -> tuple[int, int]:
        """The window as a half-open frame range ``[first, last)``.

        Both ends round the same way, so adjacent windows share their boundary
        frame index and the film has neither a gap nor a duplicated frame.

        Args:
            fps: Frame rate.

        Returns:
            ``(first, last)`` frame indices.
        """
        return round(self.start * fps), round(self.end * fps)


def _cut_before(episode: Episode, cues: CueTable, shot: Shot) -> float:
    """Where the cut into a shot falls: in the silence before its first beat's sentence."""
    if episode.beatmap is None or episode.timeline is None or not shot.covers:
        raise StudioError(f"{shot.id} covers no beats, so it has no place in the film")
    first = min(shot.covers, key=lambda beat: cues[beat])
    sentence = episode.timeline.find_sentence(cues[first])
    if sentence is None or sentence.index == 0:
        return cues[first] if sentence is None else 0.0
    previous = episode.timeline.sentence(sentence.index - 1)
    return (previous.end + sentence.start) / 2


def shot_windows(episode: Episode, cues: CueTable) -> list[ShotWindow]:
    """Tile the film with the episode's shots, in narrated order.

    Args:
        episode: The episode, with its shot list and voiceover.
        cues: The resolved cue table (``plan(episode).cues``).

    Returns:
        One window per shot, contiguous, covering ``0 → film_duration``.

    Raises:
        StudioError: A shot covers no beats, or shots are declared out of
            narrated order, so the windows would overlap.
    """
    if episode.shotlist is None or not episode.shotlist.shots:
        raise StudioError(f"{episode.id} has no shots to lay out")
    shots = list(episode.shotlist.shots)
    cuts = [0.0] + [_cut_before(episode, cues, shot) for shot in shots[1:]]
    for (before, a), (after, b) in pairwise(zip(cuts, shots, strict=True)):
        if after <= before:
            raise StudioError(
                f"{b.id} starts at {after:.2f}s, not after {a.id} ({before:.2f}s)",
                fix="List shots in shots.yaml in the order they are narrated.",
            )
    ends = [*cuts[1:], episode.film_duration]
    return [
        ShotWindow(shot=shot, start=start, end=end)
        for shot, start, end in zip(shots, cuts, ends, strict=True)
    ]
