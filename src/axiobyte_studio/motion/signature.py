"""The Motion Language — one signature per idea.

Motion is semantics, not decoration. The rule is the same strength as the colour
rule: *one motion signature per idea, and nothing borrows a motion it does not own.*

Signatures may inherit, which is how a new domain gets a consistent feel without
re-deriving it. ``message.travel`` inherits ``packet.travel`` because a Raft RPC
*is* a packet to a viewer's eye, and only its meaning needs restating.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any

import yaml

from axiobyte_studio.core.errors import DesignError

_TOKENS = Path(__file__).resolve().parents[1] / "design" / "tokens" / "motion.yaml"


@dataclass(frozen=True, slots=True)
class Motion:
    """How one idea moves.

    Attributes:
        name: The signature name, ``<concept>.<verb>``.
        curve: Named easing curve. Backends map this to their own vocabulary.
        duration: Seconds, before any beat-specific stretch.
        secondary: Accompanying effects — trails, pulses, camera reactions.
        reads_as: What the motion must *mean* to a viewer. This is an acceptance
            criterion, not a comment: an implementation that matches the curve but
            does not read as this is wrong.
        inherits: The signature this one derives from, if any.
    """

    name: str
    curve: str
    duration: float
    reads_as: str
    secondary: tuple[str, ...] = ()
    inherits: str | None = None

    def stretched(self, seconds: float) -> Motion:
        """A copy retimed to fill a specific window.

        Beats are anchored to word starts, so the distance to the next idea is
        given rather than chosen. A motion that must fill it keeps its curve and
        its meaning, and only its duration moves.

        Args:
            seconds: The window to fill.

        Returns:
            The retimed signature.

        Raises:
            DesignError: The duration is not positive.
        """
        if seconds <= 0:
            raise DesignError(
                f"Cannot stretch {self.name!r} to {seconds}s",
                fix="A beat's window must be positive — check the two cues around it.",
            )
        return Motion(
            name=self.name,
            curve=self.curve,
            duration=seconds,
            reads_as=self.reads_as,
            secondary=self.secondary,
            inherits=self.inherits,
        )


class MotionLanguage:
    """Every motion signature the Studio knows, with inheritance resolved."""

    def __init__(self, raw: dict[str, Any]) -> None:
        self.version = str(raw.get("version", "0.0.0"))
        self._raw: dict[str, dict[str, Any]] = dict(raw.get("signatures", {}))
        self._resolved: dict[str, Motion] = {}
        for name in self._raw:
            self._resolved[name] = self._resolve(name, set())

    def _resolve(self, name: str, seen: set[str]) -> Motion:
        """Resolve one signature, following ``inherits`` and rejecting cycles."""
        if name in self._resolved:
            return self._resolved[name]
        if name in seen:
            raise DesignError(
                f"Motion signature {name!r} inherits from itself",
                context={"cycle": " -> ".join([*sorted(seen), name])},
                fix="Break the cycle in design/tokens/motion.yaml.",
            )
        try:
            spec = self._raw[name]
        except KeyError:
            raise DesignError(
                f"No motion signature named {name!r}",
                context={"known": ", ".join(sorted(self._raw))},
                fix="Add it to design/tokens/motion.yaml before an action refers to it.",
            ) from None

        parent = spec.get("inherits")
        base: Motion | None = None
        if parent:
            base = self._resolve(str(parent), seen | {name})

        return Motion(
            name=name,
            curve=str(spec.get("curve", base.curve if base else "linear")),
            duration=float(spec.get("duration", base.duration if base else 0.5)),
            reads_as=str(spec.get("reads_as", base.reads_as if base else "")),
            secondary=tuple(spec.get("secondary", base.secondary if base else ())),
            inherits=str(parent) if parent else None,
        )

    def get(self, name: str) -> Motion:
        """Look up one signature.

        Args:
            name: Signature name, ``<concept>.<verb>``.

        Returns:
            The resolved signature.

        Raises:
            DesignError: No such signature is registered.
        """
        try:
            return self._resolved[name]
        except KeyError:
            raise DesignError(
                f"No motion signature named {name!r}",
                context={"known": ", ".join(sorted(self._resolved))},
                fix="Add it to design/tokens/motion.yaml before an action refers to it.",
            ) from None

    @property
    def names(self) -> list[str]:
        """Every registered signature name."""
        return sorted(self._resolved)

    def owners(self) -> dict[str, list[str]]:
        """Which concept owns which signatures.

        Used to check that nothing borrows a motion it does not own.

        Returns:
            Concept names mapped to the signatures they own.
        """
        owned: dict[str, list[str]] = {}
        for name in self._resolved:
            concept = name.split(".", 1)[0]
            owned.setdefault(concept, []).append(name)
        return owned

    @classmethod
    def load(cls) -> MotionLanguage:
        """Load the language from ``design/tokens/motion.yaml``.

        Returns:
            The loaded motion language.
        """
        return cls(yaml.safe_load(_TOKENS.read_text(encoding="utf-8")))


@cache
def motion_language() -> MotionLanguage:
    """The process-wide motion language."""
    return MotionLanguage.load()


def motion(name: str) -> Motion:
    """Look up one motion signature.

    Args:
        name: Signature name, ``<concept>.<verb>``.

    Returns:
        The resolved signature.
    """
    return motion_language().get(name)
