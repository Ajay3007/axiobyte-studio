"""The render cache — don't render what has not changed.

A 56-second episode costs minutes per target. Most edits change one act, and
re-rendering the other two to see it is the single biggest friction in the whole
workflow.

The cache is **content-addressed**: a fingerprint over everything that can affect
the output — the episode's authored files, the design system, the concept SDK, the
plates it may replay, and the versions of the Studio and Manim themselves. Two runs
with the same fingerprint produce the same frames, so the second one need not
happen.

The same fingerprint is also the reproducibility record. Every render writes a
manifest naming each input hash and tool version, which is what makes "re-render
episode 1 in three years" a capability rather than a hope: it either reproduces, or
it names which input moved.

Conservative by design. When in doubt the fingerprint changes and the render
happens — a needless render costs minutes, a wrongly reused one costs trust.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path

from axiobyte_studio import __version__
from axiobyte_studio.storyboard.episode import Episode

_PACKAGE = Path(__file__).resolve().parents[1]

#: Everything shipped with the Studio that changes what a frame looks like.
_ENGINE_INPUTS = (
    _PACKAGE / "design",
    _PACKAGE / "concepts" / "library",
)


def _tool_versions() -> dict[str, str]:
    """The versions of everything that draws.

    A Manim upgrade can change antialiasing, font metrics or easing. It must
    invalidate the cache, or the first render after an upgrade silently mixes old
    and new frames.
    """
    versions = {"axiobyte-studio": __version__}
    for package in ("manim", "pillow", "numpy"):
        try:
            versions[package] = version(package)
        except PackageNotFoundError:  # pragma: no cover - depends on the environment
            versions[package] = "absent"
    return versions


def _hash_path(path: Path, digest: hashlib._Hash) -> None:
    """Fold a file, or every file under a directory, into a digest."""
    if path.is_file():
        digest.update(path.name.encode())
        digest.update(path.read_bytes())
        return
    if not path.is_dir():
        return
    for child in sorted(path.rglob("*")):
        if child.is_file() and "__pycache__" not in child.parts:
            digest.update(str(child.relative_to(path)).encode())
            digest.update(child.read_bytes())


def _authored_inputs(episode: Episode) -> list[Path]:
    """The files an author edits, which is most of what changes between renders."""
    return [
        episode.root / "episode.yaml",
        episode.root / "picture.md",
        episode.root / "storyboard",
        episode.root / "shots",
    ]


def _plate_inputs(plates_root: Path) -> list[Path]:
    """Every plate manifest.

    Manifests rather than frames: a manifest carries the bake digest, so it changes
    exactly when the plate does, and hashing megabytes of PNG on every render would
    cost more than the render it is trying to avoid.
    """
    if not plates_root.is_dir():
        return []
    return sorted(plates_root.rglob("manifest.json"))


@dataclass(frozen=True, slots=True)
class Fingerprint:
    """Everything that determines a render's output.

    Attributes:
        digest: The hash itself.
        inputs: What went into it, for the manifest and for diagnosis.
        tools: Versions of everything that draws.
    """

    digest: str
    inputs: dict[str, str] = field(default_factory=dict)
    tools: dict[str, str] = field(default_factory=dict)


def fingerprint(
    episode: Episode,
    target: str,
    *,
    quality: str,
    still: bool,
    plates_root: Path | None = None,
) -> Fingerprint:
    """Compute the fingerprint for one episode rendered to one target.

    Args:
        episode: The episode.
        target: Which format.
        quality: The quality preset.
        still: Whether this is a single frame.
        plates_root: Where baked plates live.

    Returns:
        The fingerprint.
    """
    tools = _tool_versions()
    parts: dict[str, str] = {}
    overall = hashlib.sha256()

    for label, value in (
        ("target", target),
        ("quality", quality),
        ("still", str(still)),
        ("platform", episode.platform_for(target) or "-"),
        ("theme", episode.theme),
        ("tools", json.dumps(tools, sort_keys=True)),
    ):
        parts[label] = value
        overall.update(f"{label}={value}".encode())

    for label, paths in (
        ("authored", _authored_inputs(episode)),
        ("engine", list(_ENGINE_INPUTS)),
        ("plates", _plate_inputs(plates_root or Path("assets/plates"))),
    ):
        section = hashlib.sha256()
        for path in paths:
            _hash_path(path, section)
        parts[label] = section.hexdigest()[:16]
        overall.update(parts[label].encode())

    # The voiceover decides every beat's time, so a re-cut must re-render even when
    # not a single authored line changed.
    voice = hashlib.sha256()
    if episode.timeline is not None:
        voice.update(f"{episode.timeline.duration}:{len(episode.timeline)}".encode())
        for word in episode.timeline.words:
            voice.update(f"{word.text}{word.start}".encode())
    parts["voiceover"] = voice.hexdigest()[:16]
    overall.update(parts["voiceover"].encode())

    return Fingerprint(digest=overall.hexdigest()[:24], inputs=parts, tools=tools)


@dataclass(frozen=True, slots=True)
class CacheEntry:
    """A previous render, and whether it can be reused.

    Attributes:
        path: Where the manifest lives.
        digest: The fingerprint it was rendered from.
        outputs: The files it produced.
    """

    path: Path
    digest: str
    outputs: tuple[Path, ...]

    @property
    def intact(self) -> bool:
        """Whether every file it claims to have produced still exists.

        A manifest whose outputs were deleted is not a cache hit. Reporting one
        would be the worst failure this module could have: a render that says it
        succeeded and produced nothing.
        """
        return bool(self.outputs) and all(path.exists() for path in self.outputs)


def manifest_path(out: Path, target: str) -> Path:
    """Where a target's render manifest lives.

    Args:
        out: The episode's output directory.
        target: Which format.

    Returns:
        The manifest path.
    """
    return out / ".renders" / f"{target}.json"


def lookup(out: Path, target: str) -> CacheEntry | None:
    """The previous render for a target, if there is one.

    Args:
        out: The episode's output directory.
        target: Which format.

    Returns:
        The entry, or ``None`` when nothing was recorded or it is unreadable.
    """
    path = manifest_path(out, target)
    if not path.exists():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return CacheEntry(
        path=path,
        digest=str(raw.get("digest", "")),
        outputs=tuple(Path(p) for p in raw.get("outputs", [])),
    )


def record(
    out: Path,
    target: str,
    print_: Fingerprint,
    outputs: list[Path],
    *,
    episode_id: str,
    scene: str,
) -> Path:
    """Write the render manifest.

    This is the reproducibility record as much as the cache key: it names every
    input hash and tool version, so a render three years from now either reproduces
    or says which input moved.

    Args:
        out: The episode's output directory.
        target: Which format.
        print_: The fingerprint this render was made from.
        outputs: The files produced.
        episode_id: Which episode.
        scene: Which scene class.

    Returns:
        The manifest path.
    """
    path = manifest_path(out, target)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "episode": episode_id,
                "target": target,
                "scene": scene,
                "digest": print_.digest,
                "rendered_at": datetime.now(UTC).isoformat(timespec="seconds"),
                "inputs": print_.inputs,
                "tools": print_.tools,
                "outputs": [str(p) for p in outputs],
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    return path


def explain(previous: CacheEntry | None, current: Fingerprint) -> str:
    """Why a cached render could not be reused.

    Args:
        previous: The recorded entry, if any.
        current: The fingerprint now.

    Returns:
        A short reason, for the render report.
    """
    if previous is None:
        return "no previous render"
    if not previous.intact:
        return "previous output is missing"
    if previous.digest != current.digest:
        return "inputs changed"
    return "unchanged"
