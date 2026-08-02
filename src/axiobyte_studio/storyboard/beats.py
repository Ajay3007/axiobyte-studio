"""Acts and beats — the narrative axis.

**The Beat is the atom.** Not the shot, not the scene. A beat is *one idea landing
at one moment in the narration*, and it is the unit at which everything is checked:
concept focus, cognitive budget, invariant scope, narration contract.

A beat names a concept, and the concept may be of any kind — an Interaction Concept
is one concept, and it is one idea, because its participants are prerequisites the
viewer already has.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from axiobyte_studio.core.errors import StudioError


@dataclass(frozen=True, slots=True)
class Beat:
    """One idea, landing on one word.

    Attributes:
        id: ``<act>.<beat>``, matching the cue namespace.
        cue: The cue this beat lands on.
        concept: What is being taught. Exactly one, of any kind.
        objective: Which of that concept's objectives this beat serves.
        refutes: Which misconception it destroys, if any.
        intent: What the beat is *for*, in the author's words.
        act: Which act it belongs to. Filled in when loaded.
    """

    id: str
    cue: str
    concept: str = ""
    objective: str = ""
    refutes: str = ""
    intent: str = ""
    act: str = ""

    @property
    def teaches(self) -> bool:
        """Whether this beat carries a concept, or is pure narration or chrome."""
        return bool(self.concept)


@dataclass(frozen=True, slots=True)
class Act:
    """A movement of the argument — one keyword on screen, 20-60 seconds.

    Attributes:
        id: Short slug, and the namespace its beats live in.
        keyword: The pinned chapter keyword. One at a time, never popped on.
        title: The act title card, when it has one.
        beats: Its beats, in narrated order.
    """

    id: str
    keyword: str = ""
    title: str = ""
    beats: tuple[Beat, ...] = ()

    @property
    def concepts(self) -> list[str]:
        """Every concept this act teaches, in first-taught order, deduplicated."""
        seen: list[str] = []
        for beat in self.beats:
            if beat.concept and beat.concept not in seen:
                seen.append(beat.concept)
        return seen


@dataclass(frozen=True, slots=True)
class BeatMap:
    """Every act and beat in an episode.

    Attributes:
        acts: The acts, in narrated order.
        source: Where it was loaded from.
    """

    acts: tuple[Act, ...] = ()
    source: str = ""
    _by_id: dict[str, Beat] = field(default_factory=dict, repr=False)

    @classmethod
    def parse(cls, raw: dict[str, Any], source: str = "") -> BeatMap:
        """Build a beat map from a parsed ``beats.yaml``.

        Args:
            raw: The parsed mapping.
            source: Where it came from.

        Returns:
            The beat map.

        Raises:
            StudioError: The file declares no acts, or a beat id is duplicated.
        """
        if not raw.get("acts"):
            raise StudioError(
                "beats.yaml declares no acts",
                context={"file": source},
                fix="An episode is a sequence of acts, each a movement of the argument.",
            )

        acts: list[Act] = []
        by_id: dict[str, Beat] = {}
        for act_spec in raw["acts"]:
            act_id = str(act_spec["id"])
            beats: list[Beat] = []
            for beat_spec in act_spec.get("beats", []):
                beat = Beat(
                    id=str(beat_spec["id"]),
                    cue=str(beat_spec["cue"]),
                    concept=str(beat_spec.get("concept", "")),
                    objective=str(beat_spec.get("objective", "")),
                    refutes=str(beat_spec.get("refutes", "")),
                    intent=str(beat_spec.get("intent", "")),
                    act=act_id,
                )
                if beat.id in by_id:
                    raise StudioError(
                        f"Two beats share the id {beat.id!r}",
                        context={"file": source},
                        fix="Beat ids are the cue namespace; they must be unique.",
                    )
                by_id[beat.id] = beat
                beats.append(beat)
            acts.append(
                Act(
                    id=act_id,
                    keyword=str(act_spec.get("keyword", "")),
                    title=str(act_spec.get("title", "")),
                    beats=tuple(beats),
                )
            )
        return cls(acts=tuple(acts), source=source, _by_id=by_id)

    @classmethod
    def load(cls, path: str | Path) -> BeatMap:
        """Load a beat map from disk.

        Args:
            path: Path to ``beats.yaml``.

        Returns:
            The beat map.

        Raises:
            StudioError: The file is missing or malformed.
        """
        path = Path(path)
        try:
            raw = yaml.safe_load(path.read_text(encoding="utf-8"))
        except FileNotFoundError as exc:
            raise StudioError(
                f"No beats.yaml at {path}",
                fix="Run `abs storyboard build <episode>` to scaffold one from the script.",
            ) from exc
        if not isinstance(raw, dict):
            raise StudioError(f"{path} does not contain a mapping")
        return cls.parse(raw, source=str(path))

    # -- access -------------------------------------------------------------

    @property
    def beats(self) -> list[Beat]:
        """Every beat, in narrated order."""
        return [beat for act in self.acts for beat in act.beats]

    def beat(self, beat_id: str) -> Beat:
        """Look up one beat.

        Args:
            beat_id: Its id.

        Returns:
            The beat.

        Raises:
            StudioError: No beat by that id.
        """
        try:
            return self._by_id[beat_id]
        except KeyError:
            raise StudioError(
                f"No beat named {beat_id!r}",
                context={"beats": ", ".join(sorted(self._by_id))},
            ) from None

    @property
    def teaching_order(self) -> list[str]:
        """Every concept taught, in the order the episode first teaches it.

        This is what the closure check consumes: it is the episode's claim about
        what the viewer knows, and when.
        """
        order: list[str] = []
        for beat in self.beats:
            if beat.concept and beat.concept not in order:
                order.append(beat.concept)
        return order

    @property
    def cues(self) -> dict[str, str]:
        """Every beat's cue, keyed by beat id — the episode's cue table."""
        return {beat.id: beat.cue for beat in self.beats}
