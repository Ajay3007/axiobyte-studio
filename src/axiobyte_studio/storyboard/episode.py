"""An Episode — a traversal of the concept graph, plus a voiceover.

An episode is deliberately *not* a container of knowledge. It names concepts the SDK
already holds, states its own thesis, and anchors the whole thing to one recording.
Delete an episode and nothing reusable is lost.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from axiobyte_studio.core.errors import StudioError
from axiobyte_studio.core.renderers import DEFAULT_RENDERER
from axiobyte_studio.design.theme import DEFAULT_THEME
from axiobyte_studio.storyboard.beats import BeatMap
from axiobyte_studio.storyboard.picture import Picture
from axiobyte_studio.storyboard.shotlist import ShotList
from axiobyte_studio.timeline.timeline import Timeline


@dataclass(frozen=True, slots=True)
class Episode:
    """One episode's authored inputs, loaded and bound together.

    Attributes:
        id: ``sNNeNN-kebab-slug``.
        title: Human title.
        root: The episode directory.
        pillar: Which content pillar it belongs to.
        targets: Formats it declares.
        platforms: Which platform's UI to clear, per target.
        theme: Which theme it renders in.
        assumed: Concepts the audience is declared to already know.
        picture: Its thesis.
        beatmap: Its acts and beats.
        shotlist: Which staging covers which beats.
        timeline: Its voiceover.
        renderer: The default renderer for shots that do not name one.
        audio: The recorded voiceover, when declared: ``path`` (relative to the
            episode), ``sha256`` and ``duration``. Timing never comes from it —
            only the final mix does — so it may be absent from a checkout.
        tail: Seconds of picture after the last word.
    """

    id: str
    title: str
    root: Path
    pillar: str = ""
    targets: tuple[str, ...] = ("16x9",)
    platforms: dict[str, str] = field(default_factory=dict)
    theme: str = DEFAULT_THEME
    assumed: frozenset[str] = frozenset()
    picture: Picture | None = None
    beatmap: BeatMap | None = None
    shotlist: ShotList | None = None
    timeline: Timeline | None = None
    renderer: str = DEFAULT_RENDERER
    audio: dict[str, Any] = field(default_factory=dict)
    tail: float = 0.0

    @classmethod
    def load(cls, root: str | Path) -> Episode:
        """Load an episode directory.

        Args:
            root: The episode directory, containing ``episode.yaml``.

        Returns:
            The loaded episode, with picture, beats and timeline bound.

        Raises:
            StudioError: The directory is not an episode, or a required input is
                missing or malformed.
        """
        root = Path(root)
        manifest = root / "episode.yaml"
        if not manifest.exists():
            raise StudioError(
                f"{root} is not an episode",
                context={"expected": str(manifest)},
                fix="Run `abs new episode <id>` to scaffold one.",
            )
        raw: dict[str, Any] = yaml.safe_load(manifest.read_text(encoding="utf-8")) or {}

        voiceover = raw.get("voiceover", "timeline/words.json")
        timeline_path = Path(voiceover)
        if not timeline_path.is_absolute():
            timeline_path = root / timeline_path

        beatmap = BeatMap.load(root / "storyboard" / "beats.yaml")
        renderer = str(raw.get("renderer", DEFAULT_RENDERER))
        return cls(
            id=str(raw.get("id", root.name)),
            title=str(raw.get("title", "")),
            root=root,
            pillar=str(raw.get("pillar", "")),
            targets=tuple(raw.get("targets", ["16x9"])),
            platforms=dict(raw.get("platforms", {})),
            theme=str(raw.get("theme", DEFAULT_THEME)),
            assumed=frozenset(raw.get("assumed", [])),
            picture=Picture.load(root / "picture.md"),
            beatmap=beatmap,
            shotlist=ShotList.load(root / "storyboard" / "shots.yaml", beatmap, renderer),
            timeline=Timeline.load(timeline_path),
            renderer=renderer,
            audio=dict(raw.get("audio") or {}),
            tail=float(raw.get("tail", 0.0)),
        )

    # -- convenience --------------------------------------------------------

    @property
    def concepts(self) -> list[str]:
        """Every concept this episode teaches, in first-taught order."""
        return self.beatmap.teaching_order if self.beatmap else []

    @property
    def duration(self) -> float:
        """The voiceover's length, which is the episode's length."""
        return self.timeline.duration if self.timeline else 0.0

    @property
    def film_duration(self) -> float:
        """The picture's length: the voiceover plus the tail after its last word."""
        return self.duration + self.tail

    @property
    def audio_path(self) -> Path | None:
        """Where the recorded voiceover is expected, when the episode declares one."""
        path = self.audio.get("path")
        return self.root / str(path) if path else None

    def platform_for(self, target: str) -> str | None:
        """Which platform's interface a target must stay clear of.

        Args:
            target: The target profile id.

        Returns:
            The platform key, or ``None``.
        """
        return self.platforms.get(target)
