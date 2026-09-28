"""Render one shot's window of a Three.js episode to a clip.

The backend's renderer is a pure function of the frame index, and it warms up
for a segment that starts mid-film, so a shot rendered on its own is frame-for-
frame the same as that stretch of a whole-film render. That is what lets a film
be cut into shots, rendered per shot, and joined without a seam.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
from dataclasses import dataclass
from pathlib import Path

from axiobyte_studio.core.errors import StudioError
from axiobyte_studio.storyboard.windows import ShotWindow

#: The repository root, as seen from this file (src/axiobyte_studio/backends/three/).
_REPO = Path(__file__).resolve().parents[4]


def three_root() -> Path:
    """Where the Three.js backend lives.

    Returns:
        The ``renderers/three`` directory. ``AXIOBYTE_THREE_ROOT`` overrides it.

    Raises:
        StudioError: It is not there, or its dependencies are not installed.
    """
    root = Path(os.environ.get("AXIOBYTE_THREE_ROOT", _REPO / "renderers" / "three"))
    if not (root / "tools" / "render.mjs").exists():
        raise StudioError(
            "The Three.js backend is not installed",
            context={"expected": str(root / "tools" / "render.mjs")},
            fix="Run from a full checkout of axiobyte-studio, or set AXIOBYTE_THREE_ROOT.",
        )
    modules = [p / "node_modules" / "three" for p in (root, *root.parents)]
    if not any(m.exists() for m in modules):
        raise StudioError(
            "The Three.js backend's dependencies are not installed",
            fix="Run `npm ci` at the repository root.",
        )
    return root


def workspace_root() -> Path:
    """The npm workspace root that holds the backend and the experiences.

    Returns:
        The repository root (the directory above ``renderers/``).
    """
    return three_root().parent.parent


def node_binary() -> str:
    """Locate Node.js.

    Returns:
        The ``node`` executable.

    Raises:
        StudioError: Node is not on PATH.
    """
    node = shutil.which("node")
    if node is None:
        raise StudioError(
            "Node.js not found",
            fix="Install Node.js 20.19 or newer; the Three.js backend runs in it.",
        )
    return node


def _digest_tree(root: Path, into: hashlib._Hash) -> None:
    """Fold every file under ``root`` into a hash, by relative path and content."""
    for path in sorted(p for p in root.rglob("*") if p.is_file()):
        if "node_modules" in path.parts or path.name == ".DS_Store":
            continue
        into.update(path.relative_to(root).as_posix().encode())
        into.update(path.read_bytes())


@dataclass(frozen=True, slots=True)
class ThreeShotJob:
    """One shot, one window, one clip.

    Attributes:
        episode_root: The episode directory (containing ``three/video.html``).
        window: The shot and the stretch of film it owns.
        out: Where the clip is written.
        fps: Frame rate.
        headless: Run Chrome without a window. Slower (software GL) but works
            where there is no display; headful uses the GPU.
        still: Write one PNG from the shot instead of a clip.
    """

    episode_root: Path
    window: ShotWindow
    out: Path
    fps: int = 30
    headless: bool = False
    still: bool = False

    def command(self) -> list[str]:
        """The backend invocation for this shot.

        Times are passed as exact frame boundaries (``frame / fps``), so the
        renderer's rounding lands on the same frames as :meth:`ShotWindow.frames`.

        Returns:
            The argv to run.
        """
        first, last = self.window.frames(self.fps)
        argv = [
            node_binary(),
            str(three_root() / "tools" / "render.mjs"),
            "--episode",
            str(self.episode_root),
            "--fps",
            str(self.fps),
        ]
        if self.still:
            middle = (first + min(last, first + 2 * self.fps)) // 2
            argv += ["--stills", repr(middle / self.fps)]
        else:
            argv += [
                "--from",
                repr(first / self.fps),
                "--to",
                repr(last / self.fps),
                "--no-audio",
                "--out",
                str(self.out),
            ]
        if self.headless:
            argv.append("--headless")
        return argv

    def fingerprint(self) -> str:
        """Everything that decides this clip's pixels, hashed.

        The backend's source and tools, the episode's score and timeline, the
        window, the frame rate, and whether Chrome ran headless — software GL and
        a GPU need not produce the same pixels. Conservative on purpose: a needless re-render
        costs minutes, a wrongly reused clip costs trust.

        Returns:
            A hex digest.
        """
        digest = hashlib.sha256()
        root = three_root()
        for tree in (root / "src", root / "tools", self.episode_root / "three"):
            _digest_tree(tree, digest)
        digest.update((self.episode_root / "timeline" / "words.json").read_bytes())
        digest.update(json.dumps([self.window.frames(self.fps), self.fps, self.headless]).encode())
        return digest.hexdigest()
