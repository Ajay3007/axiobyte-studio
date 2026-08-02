"""The type ladder, resolved.

Sizes are absolute design pixels and identical in every format — verified against
both reference cuts, which declare the same constants at 1920x1080 and 1080x1920.
Because 1 unit = 100 px in both, a 38 px keyword already occupies a larger share of
a narrow frame; scaling per target on top of that would double-count.

What *does* differ per format is how far a line may run before it wraps, which the
target profile supplies as ``text_max_width``.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any

import yaml

from axiobyte_studio.core.errors import DesignError
from axiobyte_studio.layout.frame import Target

_TOKENS = Path(__file__).resolve().parents[1] / "design" / "tokens" / "type.yaml"

#: Mean glyph advance as a fraction of font size. A rough but stable estimate used
#: for wrap prediction, deliberately biased slightly wide so a layout that lints
#: clean does not overflow at render time.
_SANS_ADVANCE = 0.54
_MONO_ADVANCE = 0.60


@dataclass(frozen=True, slots=True)
class TextStyle:
    """One rung of the type ladder, resolved for a target.

    Attributes:
        name: The rung's name, e.g. ``"keyword"``.
        size_px: Height in design pixels. The same in every format.
        weight: ``"bold"`` or ``"regular"``.
        faces: Font candidates, first available wins at render time.
        mono: Whether this rung uses the monospace face.
        max_width: Longest permitted line, as a fraction of frame width.
    """

    name: str
    size_px: int
    weight: str
    faces: tuple[str, ...]
    mono: bool
    max_width: float

    @property
    def advance(self) -> float:
        """Mean glyph advance as a fraction of font size."""
        return _MONO_ADVANCE if self.mono else _SANS_ADVANCE

    def measure(self, text: str, target: Target) -> float:
        """Estimate a line's width as a fraction of the frame.

        Args:
            text: The line to measure.
            target: The format whose canvas width to measure against.

        Returns:
            Estimated width, as a fraction of frame width.
        """
        return len(text) * self.size_px * self.advance / target.canvas_w

    def fits(self, text: str, target: Target) -> bool:
        """Whether a line fits within this rung's max width.

        Args:
            text: The line to test.
            target: The format to test against.

        Returns:
            ``True`` if the line does not need wrapping or shrinking.
        """
        return self.measure(text, target) <= self.max_width

    def wrap(self, text: str, target: Target) -> list[str]:
        """Break a line into lines that fit.

        Deliberately simple and greedy: a caption that needs cleverer breaking is a
        caption that is too long, which is a writing problem rather than a layout one.

        Args:
            text: The text to wrap.
            target: The format to wrap for.

        Returns:
            The wrapped lines.
        """
        words = text.split()
        if not words:
            return []
        lines: list[str] = []
        current = words[0]
        for word in words[1:]:
            candidate = f"{current} {word}"
            if self.measure(candidate, target) <= self.max_width:
                current = candidate
            else:
                lines.append(current)
                current = word
        lines.append(current)
        return lines


class TypeLadder:
    """Every rung of the type scale, plus the faces they render with."""

    def __init__(self, raw: dict[str, Any]) -> None:
        self.version = str(raw.get("version", "0.0.0"))
        self._sizes: dict[str, int] = {k: int(v) for k, v in raw["sizes"].items()}
        self._weights: dict[str, str] = dict(raw.get("weights", {}))
        faces = raw.get("faces", {})
        self._sans: tuple[str, ...] = tuple(faces.get("sans", ["sans-serif"]))
        self._mono: tuple[str, ...] = tuple(faces.get("mono", ["monospace"]))
        reference = raw.get("reference_canvas", {})
        self.reference_canvas: tuple[int, int] = (
            int(reference.get("w", 1920)),
            int(reference.get("h", 1080)),
        )

    @classmethod
    def load(cls) -> TypeLadder:
        """Load the ladder from ``design/tokens/type.yaml``.

        Returns:
            The loaded ladder.
        """
        return cls(yaml.safe_load(_TOKENS.read_text(encoding="utf-8")))

    def style(self, rung: str, target: Target) -> TextStyle:
        """Resolve one rung for a target.

        Args:
            rung: Ladder rung, e.g. ``"keyword"`` or ``"mono_s"``.
            target: The format supplying ``text_max_width``.

        Returns:
            The resolved style.

        Raises:
            DesignError: No such rung exists.
        """
        try:
            size = self._sizes[rung]
        except KeyError:
            raise DesignError(
                f"No type rung named {rung!r}",
                context={"ladder": ", ".join(self._sizes)},
                fix="Use an existing rung, or add one to design/tokens/type.yaml.",
            ) from None
        mono = rung.startswith("mono")
        return TextStyle(
            name=rung,
            size_px=size,
            weight=self._weights.get(rung, "regular"),
            faces=self._mono if mono else self._sans,
            mono=mono,
            max_width=target.text_max_width,
        )

    @property
    def rungs(self) -> list[str]:
        """Every rung, largest first."""
        return sorted(self._sizes, key=lambda r: -self._sizes[r])


@cache
def ladder() -> TypeLadder:
    """The process-wide type ladder."""
    return TypeLadder.load()


def style(rung: str, target: Target) -> TextStyle:
    """Resolve a type rung for a target.

    Args:
        rung: Ladder rung name.
        target: The format to resolve for.

    Returns:
        The resolved style.
    """
    return ladder().style(rung, target)
