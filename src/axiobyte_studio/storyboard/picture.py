"""THE ONE PICTURE — an episode's visual thesis, made testable.

The reference episodes contain something more valuable than any of their code, and
it is a docstring. Episode 02's reads: *"the bytes have sat still for two minutes
while a yellow arrow did all the travelling."* That is why the episode is good —
not the toolkit, the **thesis**.

A framework that industrialises drawing but leaves the thesis to chance produces
twenty competent, forgettable videos. So the thesis becomes a required artifact,
written before the storyboard, and the clauses that can be checked *are* checked.

A violation is not a style note. A packet that moves during a zero-copy episode is
a factual error, and the build refuses it.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from axiobyte_studio.core.errors import StudioError

#: The four sections a picture must contain, in order.
REQUIRED_SECTIONS = (
    "The One Picture",
    "The counter-picture",
    "The payoff frame",
    "What must never happen",
)

_HEADING = re.compile(r"^##\s+(.+?)\s*$", re.M)
_FENCE = re.compile(r"```yaml\s*\n(.*?)```", re.S)


@dataclass(frozen=True, slots=True)
class Assertion:
    """One machine-checkable clause of the thesis.

    Attributes:
        id: Stable identifier, cited in failures.
        statement: The prohibition in the episode's own words.
        actor: The actor it constrains, when it constrains one.
        unchanged: Properties of that actor that must not change.
        forbids: Action names that may not occur.
        after: The cue from which the prohibition applies. Before it, the episode
            is usually *building* the picture it will destroy.
    """

    id: str
    statement: str
    actor: str = ""
    unchanged: tuple[str, ...] = ()
    forbids: tuple[str, ...] = ()
    after: str = ""


@dataclass(frozen=True, slots=True)
class Picture:
    """An episode's controlling thesis.

    Attributes:
        thesis: The one sentence the whole episode is arranging to make obvious.
        counter: The picture built first, on purpose, so it can be destroyed.
        payoff: The single frame the episode exists to earn.
        prohibitions: What must never happen, in prose.
        assertions: The subset of those prohibitions the engine can verify.
        source: Where it was loaded from.
    """

    thesis: str
    counter: str
    payoff: str
    prohibitions: tuple[str, ...] = ()
    assertions: tuple[Assertion, ...] = ()
    source: str = ""
    _sections: dict[str, str] = field(default_factory=dict, repr=False)

    @classmethod
    def parse(cls, text: str, source: str = "") -> Picture:
        """Parse a ``picture.md``.

        Args:
            text: The file's contents.
            source: Where it came from, for error messages.

        Returns:
            The parsed picture.

        Raises:
            StudioError: A required section is missing or empty.
        """
        body = _FENCE.sub("", text)
        sections: dict[str, str] = {}
        matches = list(_HEADING.finditer(body))
        for index, match in enumerate(matches):
            end = matches[index + 1].start() if index + 1 < len(matches) else len(body)
            sections[match.group(1).strip()] = body[match.end() : end].strip()

        missing = [s for s in REQUIRED_SECTIONS if not sections.get(s, "").strip()]
        if missing:
            raise StudioError(
                f"picture.md is missing {len(missing)} required section(s)",
                context={"missing": ", ".join(f"## {m}" for m in missing), "file": source},
                fix=(
                    "An episode without a stated thesis is an episode that will be "
                    "competent and forgettable. Write all four: " + ", ".join(REQUIRED_SECTIONS)
                ),
            )

        prohibitions = tuple(
            line.lstrip("-* ").strip()
            for line in sections["What must never happen"].splitlines()
            if line.strip().startswith(("-", "*"))
        )

        assertions: list[Assertion] = []
        for fenced in _FENCE.findall(text):
            raw: Any = yaml.safe_load(fenced) or {}
            for spec in raw.get("assertions", []):
                assertions.append(
                    Assertion(
                        id=str(spec["id"]),
                        statement=str(spec["statement"]),
                        actor=str(spec.get("actor", "")),
                        unchanged=tuple(spec.get("unchanged", [])),
                        forbids=tuple(spec.get("forbids", [])),
                        after=str(spec.get("after", "")),
                    )
                )

        return cls(
            thesis=sections["The One Picture"],
            counter=sections["The counter-picture"],
            payoff=sections["The payoff frame"],
            prohibitions=prohibitions,
            assertions=tuple(assertions),
            source=source,
            _sections=sections,
        )

    @classmethod
    def load(cls, path: str | Path) -> Picture:
        """Load a picture from disk.

        Args:
            path: Path to ``picture.md``.

        Returns:
            The parsed picture.

        Raises:
            StudioError: The file is missing, or malformed.
        """
        path = Path(path)
        try:
            return cls.parse(path.read_text(encoding="utf-8"), source=str(path))
        except FileNotFoundError as exc:
            raise StudioError(
                f"No picture.md at {path}",
                fix=(
                    "Every episode states its thesis before its storyboard. "
                    "Run `abs new episode` to scaffold one."
                ),
            ) from exc

    @property
    def checkable(self) -> int:
        """How many of the stated prohibitions the engine can verify."""
        return len(self.assertions)

    def summary(self) -> str:
        """A one-screen reading of the thesis, for plan output."""
        lines = [f"  thesis   {self.thesis.splitlines()[0]}"]
        if self.counter:
            lines.append(f"  against  {self.counter.splitlines()[0]}")
        lines.append(f"  payoff   {self.payoff.splitlines()[0]}")
        lines.append(
            f"  rules    {len(self.prohibitions)} stated, {self.checkable} machine-checked"
        )
        return "\n".join(lines)
