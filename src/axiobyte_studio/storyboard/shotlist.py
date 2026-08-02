"""The shot list — which staging covers which beats.

A beat is a claim that something is taught at a moment. A shot is the staging that
makes good on it. Without a list binding the two, an episode can plan cleanly, render
successfully, and simply never draw one of its acts — which is exactly what
``s01e02`` did: its ``traditional`` act was declared, cued, planned and never staged.

The list is derived by default — one shot per act, which is the shape most episodes
want — and declared explicitly when an act needs several.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import yaml

from axiobyte_studio.core.errors import StudioError
from axiobyte_studio.storyboard.beats import BeatMap


@dataclass(frozen=True, slots=True)
class Shot:
    """One staging, covering one or more beats.

    Attributes:
        id: ``shot_NNNN_snake_slug``. Four digits, stepping by ten, so a shot can
            be inserted without renumbering the episode.
        covers: The beats this staging is responsible for.
        act: Which act it belongs to.
        intent: What the shot is for, in the author's words.
    """

    id: str
    covers: tuple[str, ...]
    act: str = ""
    intent: str = ""

    @property
    def stage_function(self) -> str:
        """The name a shots module must expose to stage this shot."""
        return f"stage_{self.act}" if self.act else f"stage_{self.id}"


@dataclass(frozen=True, slots=True)
class ShotList:
    """Every shot in an episode, and what each covers.

    Attributes:
        shots: The shots, in narrated order.
        derived: Whether this was inferred from the acts rather than declared.
    """

    shots: tuple[Shot, ...] = ()
    derived: bool = True

    @classmethod
    def derive(cls, beatmap: BeatMap) -> ShotList:
        """Infer one shot per act.

        Args:
            beatmap: The episode's beats.

        Returns:
            The derived shot list.
        """
        shots = []
        for index, act in enumerate(beatmap.acts, start=1):
            shots.append(
                Shot(
                    id=f"shot_{index * 10:04d}_{act.id}",
                    covers=tuple(beat.id for beat in act.beats),
                    act=act.id,
                    intent=act.title,
                )
            )
        return cls(shots=tuple(shots), derived=True)

    @classmethod
    def load(cls, path: str | Path, beatmap: BeatMap) -> ShotList:
        """Load a declared shot list, or derive one when none exists.

        Args:
            path: Path to ``shots.yaml``.
            beatmap: The episode's beats, used when deriving.

        Returns:
            The shot list.

        Raises:
            StudioError: The file exists but is malformed.
        """
        path = Path(path)
        if not path.exists():
            return cls.derive(beatmap)
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
        if not isinstance(raw, dict) or "shots" not in raw:
            raise StudioError(
                f"{path} declares no `shots:`",
                fix="Either list the shots, or delete the file and let them derive from acts.",
            )
        return cls(
            shots=tuple(
                Shot(
                    id=str(spec["id"]),
                    covers=tuple(spec.get("covers", [])),
                    act=str(spec.get("act", "")),
                    intent=str(spec.get("intent", "")),
                )
                for spec in raw["shots"]
            ),
            derived=False,
        )

    # -- coverage -----------------------------------------------------------

    @property
    def covered(self) -> set[str]:
        """Every beat some shot is responsible for."""
        return {beat for shot in self.shots for beat in shot.covers}

    def uncovered(self, beatmap: BeatMap) -> list[str]:
        """Beats that teach something but have no staging.

        This is the check whose absence let an entire act go undrawn.

        Args:
            beatmap: The episode's beats.

        Returns:
            The ids of teaching beats no shot covers.
        """
        covered = self.covered
        return [beat.id for beat in beatmap.beats if beat.teaches and beat.id not in covered]

    def orphans(self, beatmap: BeatMap) -> list[str]:
        """Beats a shot claims to cover that the beat map does not contain.

        Args:
            beatmap: The episode's beats.

        Returns:
            The ids claimed but not declared.
        """
        known = {beat.id for beat in beatmap.beats}
        return sorted(self.covered - known)

    def shot_for(self, beat_id: str) -> Shot | None:
        """Which shot stages a beat.

        Args:
            beat_id: The beat.

        Returns:
            The shot, or ``None`` when nothing covers it.
        """
        for shot in self.shots:
            if beat_id in shot.covers:
                return shot
        return None
