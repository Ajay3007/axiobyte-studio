"""The Action System — typed state transitions that carry a cost and a lesson.

Two fields here are unusual, and both are load-bearing.

**``invariants`` — the lesson lives here.** For most systems concepts the teaching
point *is* an invariant: bytes never move (zero-copy), at most one leader per term
(Raft), one instruction per cycle per warp (GPU). Writing the objective as a
machine-checkable assertion means the concept, the picture, and the test stop being
three things that can drift apart.

**``negation`` — teaching requires showing absence.** A large fraction of systems
education is "and this does *not* happen": no copy, no interrupt, no context
switch, no remote access. Making the absence of an action a first-class property
means it is staged consistently everywhere, and the absence itself becomes grammar.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

from axiobyte_studio.core.errors import ConceptError
from axiobyte_studio.motion.signature import Motion, motion


class Confidence(StrEnum):
    """How much a cost figure can be trusted.

    A wrong number in a systems video is remembered and quoted back. So a cost that
    is not ``EXACT`` may never be shown as an absolute on screen — only as a
    relative claim, which survives hardware generations in a way absolutes do not.
    """

    EXACT = "exact"
    """Measured, with a citation. May be displayed as an absolute number."""

    ORDER = "order"
    """Right to an order of magnitude. Display as relative only."""

    ILLUSTRATIVE = "illustrative"
    """Chosen to make a point. Never display as a number at all."""


@dataclass(frozen=True, slots=True)
class Cost:
    """What an action costs, with the provenance that makes it quotable.

    Attributes:
        cycles: Approximate CPU cycles.
        nanoseconds: Approximate wall time.
        cache_lines: Cache lines touched.
        confidence: How much the figures can be trusted.
        source: Where they came from. Required for ``EXACT``.
    """

    cycles: float | None = None
    nanoseconds: float | None = None
    cache_lines: float | None = None
    confidence: Confidence = Confidence.ILLUSTRATIVE
    source: str = ""

    def __post_init__(self) -> None:
        """Refuse an exact cost with no provenance."""
        if self.confidence is Confidence.EXACT and not self.source:
            raise ConceptError(
                "An exact cost must cite a source",
                fix=(
                    "Add `source=` naming a benchmark or document, or lower the "
                    "confidence to Confidence.ORDER."
                ),
            )

    @property
    def displayable(self) -> bool:
        """Whether these figures may be shown on screen as absolute numbers."""
        return self.confidence is Confidence.EXACT

    def relative_to(self, other: Cost) -> float | None:
        """How many times more expensive this action is than another.

        Relative claims are the default display mode because they stay true across
        hardware generations.

        Args:
            other: The action cost to compare against.

        Returns:
            The ratio, or ``None`` when neither shares a comparable dimension.
        """
        for dimension in ("cycles", "nanoseconds", "cache_lines"):
            mine: float | None = getattr(self, dimension)
            theirs: float | None = getattr(other, dimension)
            if mine is not None and theirs:
                return mine / theirs
        return None


@dataclass(frozen=True, slots=True)
class Invariant:
    """Something that must remain true — usually the lesson itself.

    Attributes:
        id: Stable identifier, cited by a concept's objectives.
        statement: What must hold, in the language the episode teaches it in.
        actor: Which actor it constrains, by instance id.
        unchanged: Properties of that actor that must not change in scope.
        forbids: Action names that may not occur in scope.
        after: When the prohibition begins, in seconds. **This is not a
            convenience.** The ``contrast_then_invariance`` template — which is how
            zero-copy, polling and false sharing are all taught — spends its first
            act *doing the thing the episode later forbids*, on purpose, so that
            stopping reads as the point. An invariant with no time scope makes the
            counter-picture unstageable, and the counter-picture is half the lesson.
    """

    id: str
    statement: str
    actor: str = ""
    unchanged: tuple[str, ...] = ()
    forbids: tuple[str, ...] = ()
    after: float = 0.0


@dataclass(frozen=True, slots=True)
class Action:
    """One typed transition an actor undergoes.

    Attributes:
        name: The verb, lowercase imperative.
        subjects: Concepts this action may be performed on. An action reused
            across concepts is evidence the vocabulary sits at the right level —
            ``release`` means the same thing for an mbuf and for a packet.
        motion: Motion signature name, resolved from the motion language.
        invariants: What must remain true across it. Where the lesson lives.
        cost: What it costs, with provenance.
        negation: How to depict this action *not* happening. ``None`` means its
            absence is never staged, which is true of very few systems actions.
        params: Names of parameters callers may pass.
    """

    name: str
    subjects: tuple[str, ...]
    motion: str
    invariants: tuple[Invariant, ...] = ()
    cost: Cost = field(default_factory=Cost)
    negation: str | None = None
    params: tuple[str, ...] = ()

    @property
    def signature(self) -> Motion:
        """The resolved motion this action moves with."""
        return motion(self.motion)

    def accepts(self, concept: str) -> bool:
        """Whether this action may be performed on a concept.

        Args:
            concept: The concept id to test.

        Returns:
            ``True`` if the action applies.
        """
        return concept in self.subjects

    def describe(self) -> str:
        """A one-line summary for plan output and docs.

        Returns:
            The action, its subjects, and what its motion must read as.
        """
        return f"{self.name}({'|'.join(self.subjects)}) — {self.signature.reads_as}"


@dataclass(frozen=True, slots=True)
class AppliedAction:
    """One action, as it actually occurred in a scene.

    Attributes:
        action: Which action.
        actor: Which actor it was applied to, by id.
        at: When, in seconds from the start of the voiceover.
        before: The actor's state before.
        after: The actor's state after.
        params: Parameters the caller passed.
    """

    action: str
    actor: str
    at: float
    before: str
    after: str
    params: dict[str, Any] = field(default_factory=dict)
