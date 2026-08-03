"""Scene generation — one class per format, synthesised rather than written.

An episode used to hand-write a scene class per target::

    class Episode16x9(_Ep02): target_id = "16x9"
    class Episode9x16(_Ep02): target_id = "9x16"

which made the Studio's headline claim false. *"Adding a new aspect ratio to a
finished episode should require editing nothing inside that episode"* — and yet a
third format needed a third class. The relations were format-agnostic; the
boilerplate around them was not.

So the classes are generated, for **every format the Studio ships**, not only the
ones an episode lists. An episode's ``targets:`` decides what ``abs render``
produces by default; any other format stays renderable on demand, at no cost.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Any

from axiobyte_studio.actions.scene import Scene as SceneModel
from axiobyte_studio.backends.manim.scene import StudioScene
from axiobyte_studio.core.errors import StudioError
from axiobyte_studio.layout.frame import available_targets

#: A staging function: draws one act into a scene, optionally using the model.
Act = Callable[..., None]


def scene_class_name(target: str) -> str:
    """The class name generated for a target.

    Args:
        target: A target profile id, e.g. ``"9x16"``.

    Returns:
        The class name, e.g. ``"Episode9x16"``.
    """
    return f"Episode{target}"


def build_episode_scenes(
    namespace: dict[str, Any],
    episode_root: str | Path,
    acts: Sequence[Act],
    *,
    build: Callable[[Any], SceneModel] | None = None,
    turn_cue: str | None = None,
    targets: Sequence[str] | None = None,
) -> dict[str, type[StudioScene]]:
    """Generate one scene class per format and inject them into a module.

    Args:
        namespace: The shots module's ``globals()``. Generated classes are placed
            here so ``manim <module> Episode1x1`` finds them.
        episode_root: The episode directory, for loading cues and platforms.
        acts: Staging functions, in narrated order. Each is called with the scene,
            and with the semantic model as a second argument if it accepts one.
        build: Builds the semantic model. Called with the turn's absolute time when
            ``turn_cue`` is given, and with nothing otherwise.
        turn_cue: The cue at which a time-scoped invariant begins.
        targets: Which formats to generate for. Defaults to every format the
            Studio ships — which is what makes a new format free.

    Returns:
        The generated classes, by target id.

    Raises:
        StudioError: No acts were supplied.
    """
    if not acts:
        raise StudioError(
            "An episode needs at least one act",
            fix="Pass the staging functions in narrated order.",
        )
    root = Path(episode_root)
    generated: dict[str, type[StudioScene]] = {}

    # Manim discovers scenes by `cls.__module__ == module.__name__`, so a
    # generated class must claim the shots module rather than this one.
    module_name = str(namespace.get("__name__", "__main__"))
    for target in targets or available_targets():
        cls = _make_class(root, target, acts, build, turn_cue, module_name)
        namespace[cls.__name__] = cls
        generated[target] = cls
    return generated


def _make_class(
    root: Path,
    target: str,
    acts: Sequence[Act],
    build: Callable[[Any], SceneModel] | None,
    turn_cue: str | None,
    module_name: str,
) -> type[StudioScene]:
    """Build one scene class for one format."""
    import inspect

    from axiobyte_studio.storyboard.episode import Episode
    from axiobyte_studio.timeline.cues import CueTable

    def construct(self: StudioScene) -> None:
        episode = Episode.load(root)
        if episode.beatmap is None or episode.timeline is None:
            raise StudioError(f"{episode.id} has no beat map or no voiceover")
        self.cues = CueTable.resolve(episode.beatmap.cues, episode.timeline)

        model: SceneModel | None = None
        if build is not None:
            model = build(self.cues[turn_cue]) if turn_cue else build()  # type: ignore[call-arg]

        for act in acts:
            # An act may take the model or not; most opening acts do not need it.
            takes_model = len(inspect.signature(act).parameters) > 1
            act(self, model) if takes_model else act(self)

    platform = _platform_for(root, target)
    return type(
        scene_class_name(target),
        (StudioScene,),
        {
            "target_id": target,
            "platform": platform,
            "construct": construct,
            "__module__": module_name,
            "__doc__": f"Generated {target} cut. Same acts, same cues, same invariants.",
        },
    )


def _platform_for(root: Path, target: str) -> str | None:
    """Which platform's interface a target must clear, from ``episode.yaml``.

    Read directly rather than through :class:`Episode` so that generating classes
    at import time does not require the beat map and voiceover to load.
    """
    import yaml

    manifest = root / "episode.yaml"
    if not manifest.exists():
        return None
    raw = yaml.safe_load(manifest.read_text(encoding="utf-8")) or {}
    value = dict(raw.get("platforms", {})).get(target)
    return str(value) if value else None
