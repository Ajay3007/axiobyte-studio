"""Golden files — the safety net for everything a unit test cannot see.

Every visual defect this project has had was found by a human looking at a PNG
while the suite stayed green: a label escaping its box, chrome colliding with a
diagram, and a payload rendering at the wrong address. Structural errors have
guards; **semantic** ones did not.

Three layers, cheapest first, because they catch different things:

1. **Semantic snapshots** — the scene's actors, states and props as JSON. Fast,
   exact, and diffable. This is the layer that catches "the address on screen is
   wrong", which is the class of bug that shipped.
2. **SVG goldens** — deterministic markup, committed as text. A git diff shows
   *what* changed rather than that something did, which is worth more than a hash.
3. **Perceptual hashes** — for real renders, where exactness is neither possible
   nor desirable. Tolerant of a font hinting difference, intolerant of a moved box.

Update them deliberately: ``UPDATE_GOLDEN=1 pytest``. A golden that updates itself
silently is not a test.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from axiobyte_studio.actions.scene import Scene

#: Set to update goldens instead of asserting against them.
UPDATE_ENV = "UPDATE_GOLDEN"


def updating() -> bool:
    """Whether goldens should be rewritten rather than checked."""
    return os.environ.get(UPDATE_ENV, "").lower() in {"1", "true", "yes"}


# ---------------------------------------------------------------------------
# 1. Semantic snapshots
# ---------------------------------------------------------------------------


def snapshot_scene(scene: Scene) -> dict[str, Any]:
    """A deterministic record of what a scene claims about the system.

    Captures the facts an episode asserts on screen — an actor's state, and the
    props a viewer can read, like an address. A frame showing the wrong address is
    a lie about the system, and this is what notices.

    Args:
        scene: The scene to snapshot.

    Returns:
        A JSON-serialisable mapping, stable across runs.
    """
    return {
        "id": scene.id,
        "focus": scene.focus,
        "actors": {
            actor_id: {
                "concept": actor.concept,
                "state": actor.state,
                "salience": actor.salience.value,
                "props": {k: _plain(v) for k, v in sorted(actor.props.items())},
            }
            for actor_id, actor in sorted(scene.actors.items())
        },
        "log": [
            {
                "at": round(entry.at, 3),
                "action": entry.action,
                "actor": entry.actor,
                "state": f"{entry.before}->{entry.after}",
            }
            for entry in scene.log
        ],
        "invariants": [
            {
                "id": inv.id,
                "actor": inv.actor,
                "unchanged": list(inv.unchanged),
                "forbids": list(inv.forbids),
                "after": round(inv.after, 3),
            }
            for inv in scene.invariants
        ],
    }


def _plain(value: Any) -> Any:
    """Reduce a prop to something JSON can hold, stably."""
    if isinstance(value, str | int | bool) or value is None:
        return value
    if isinstance(value, float):
        return round(value, 4)
    return str(value)


# ---------------------------------------------------------------------------
# 2 & 3. Golden files
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Golden:
    """One golden file, and the comparison against it.

    Attributes:
        path: Where the reference lives.
    """

    path: Path

    def check_text(self, actual: str) -> None:
        """Compare text against the reference.

        Args:
            actual: The freshly produced content.

        Raises:
            AssertionError: The content differs. The message names the file and the
                first differing line, because that is what a reviewer needs.
        """
        if updating() or not self.path.exists():
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.path.write_text(actual, encoding="utf-8")
            if not updating():
                raise AssertionError(
                    f"Created a new golden at {self.path}.\n"
                    "Review it, then commit it. A golden nobody looked at proves nothing."
                )
            return

        expected = self.path.read_text(encoding="utf-8")
        if expected == actual:
            return
        raise AssertionError(_diff(self.path, expected, actual))

    def check_json(self, actual: dict[str, Any]) -> None:
        """Compare a mapping against the reference, formatted for diffing.

        Args:
            actual: The freshly produced snapshot.
        """
        self.check_text(json.dumps(actual, indent=2, sort_keys=True) + "\n")


def _diff(path: Path, expected: str, actual: str) -> str:
    """A reviewer-shaped failure message."""
    import difflib

    lines = list(
        difflib.unified_diff(
            expected.splitlines(),
            actual.splitlines(),
            fromfile=f"golden: {path.name}",
            tofile="rendered now",
            lineterm="",
            n=2,
        )
    )
    body = "\n".join(lines[:40])
    more = f"\n… {len(lines) - 40} more lines" if len(lines) > 40 else ""
    return (
        f"{path.name} differs from its golden.\n{body}{more}\n\n"
        f"If the change is intended, re-run with {UPDATE_ENV}=1 and commit the diff.\n"
        "If it is not, something moved that should not have."
    )


# ---------------------------------------------------------------------------
# Perceptual hashing
# ---------------------------------------------------------------------------


def image_hash(path: str | Path, size: int = 16) -> str:
    """An average hash of an image.

    Tolerant of a font-hinting difference or a one-pixel antialiasing change;
    intolerant of a box that moved. That is exactly the sensitivity a render golden
    wants — pixel equality would be abandoned within a week.

    Args:
        path: The image file.
        size: Grid resolution. Higher is stricter.

    Returns:
        A hex digest.
    """
    from PIL import Image

    with Image.open(path) as image:
        grid = image.convert("L").resize((size, size), Image.Resampling.LANCZOS)
        pixels = list(grid.getdata())
    mean = sum(pixels) / len(pixels)
    bits = "".join("1" if pixel > mean else "0" for pixel in pixels)
    return f"{int(bits, 2):0{size * size // 4}x}"


def hamming(left: str, right: str) -> int:
    """How many bits two hashes differ by.

    Args:
        left: One hash.
        right: The other.

    Returns:
        The bit distance.

    Raises:
        ValueError: The hashes are different lengths, so were made at different
            resolutions and cannot be compared.
    """
    if len(left) != len(right):
        raise ValueError(
            f"Hashes are {len(left)} and {len(right)} characters — different "
            "resolutions cannot be compared."
        )
    return bin(int(left, 16) ^ int(right, 16)).count("1")
