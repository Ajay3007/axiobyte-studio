"""The Concept SDK — three kinds of teachable unit.

A great deal of computer science is **relationships rather than objects**, so the
SDK represents both, plus the stories assembled from them:

* :class:`AtomicConcept` — a thing that exists. Has a silhouette; can be drawn.
* :class:`InteractionConcept` — a relationship that *is* the lesson. Has no
  silhouette, because a relationship cannot be drawn; it reaches the screen through
  its participants.
* :class:`CompositeConcept` — a story. Stages nothing itself; sequences members.

Interaction Concepts are not an exception to the one-concept-per-beat rule. They
*are* one concept, and because their participants are prerequisites, the number of
**new** ideas in the beat is still exactly one. See ``CONCEPT-ARCHITECTURE.md`` §5.4.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

from axiobyte_studio.core.errors import ConceptError


class ConceptKind(StrEnum):
    """What sort of teachable unit this is."""

    ATOMIC = "atomic"
    """A thing that exists. Drawable."""

    INTERACTION = "interaction"
    """A relationship that is itself the lesson. Not drawable."""

    COMPOSITE = "composite"
    """A story assembled from the other two. Stages nothing."""


class Depth(StrEnum):
    """How much teaching a composite owes a member."""

    ASSUMED = "assumed"
    """The viewer already knows it; reference without explanation."""

    BRIEF = "brief"
    """One beat, one image, no derivation."""

    FULL = "full"
    """Complete staging, with objectives and misconception refutation."""


@dataclass(frozen=True, slots=True)
class Objective:
    """Something the viewer can do afterwards that they could not do before."""

    id: str
    statement: str
    evidence: str = ""


@dataclass(frozen=True, slots=True)
class Misconception:
    """A wrong model learners actually hold, and how the staging destroys it."""

    id: str
    wrong: str
    refute_by: str
    source: str = ""

    @property
    def is_draft(self) -> bool:
        """Whether this lacks provenance and so may not be cited by a grammar rule."""
        return not self.source


@dataclass(frozen=True, slots=True)
class Member:
    """One member of a composite, at a declared depth."""

    concept: str
    depth: Depth = Depth.BRIEF


@dataclass(frozen=True, slots=True)
class Concept:
    """What every kind shares.

    Attributes:
        id: Stable identifier, ``snake_case``.
        kind: Which sort of concept this is.
        version: Semver. A revision reports which shipped episodes are affected.
        domain: Which actor domain it belongs to.
        title: Human name.
        objectives: What the viewer can do afterwards.
        misconceptions: Wrong models it destroys.
        requires: Hard prerequisites.
        contrasts_with: Concepts it is defined *against*.
        composes_into: Composites that use it.
        source: Where it was loaded from, for error messages.
    """

    id: str
    kind: ConceptKind
    version: str
    domain: str
    title: str = ""
    objectives: tuple[Objective, ...] = ()
    misconceptions: tuple[Misconception, ...] = ()
    requires: tuple[str, ...] = ()
    contrasts_with: tuple[str, ...] = ()
    composes_into: tuple[str, ...] = ()
    source: str = ""

    @property
    def drawable(self) -> bool:
        """Whether this concept has a silhouette of its own.

        Only atomic concepts do. An interaction reaches the screen through its
        participants; a composite through its members.
        """
        return self.kind is ConceptKind.ATOMIC

    @property
    def participants(self) -> tuple[str, ...]:
        """The concepts that must hold primary attention when this is in focus.

        One for an atomic concept — itself. For an interaction, everything it
        joins. This is what the salience check compares against.
        """
        return (self.id,)

    def _fail(self, message: str, **context: Any) -> ConceptError:
        """Build an error that names this concept and where it came from."""
        return ConceptError(
            f"{self.id}: {message}",
            context={**context, "defined in": self.source or "<memory>"},
        )


@dataclass(frozen=True, slots=True)
class AtomicConcept(Concept):
    """A thing that exists.

    It owns a role in the visual language and a silhouette, which is exactly what
    makes it the only kind that can be drawn.

    Attributes:
        states: Its lifecycle, when legality is part of the lesson.
        anchors: Named attachment points.
    """

    states: tuple[str, ...] = ()
    anchors: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class InteractionConcept(Concept):
    """A relationship that is itself the lesson.

    Seven blocks are mandatory (``CONCEPT-ARCHITECTURE.md`` §5.2). A file missing
    any of them is not an interaction; it is two things on screen.

    Attributes:
        between: Its participants — two or more atomic concepts.
        removal_test: Per participant, what remains if it is taken away. The
            argument that this is genuinely a relationship, written down so it can
            be reviewed rather than assumed.
        visual_grammar: How its participants are staged together.
        motion_grammar: How the interaction itself moves.
        camera: Which move reveals it, and which would hide it.
        staging: Its storyboard template, and the counter-picture it destroys.
        assessment: What the viewer can do once it is over.
    """

    between: tuple[str, ...] = ()
    removal_test: dict[str, str] = field(default_factory=dict)
    visual_grammar: dict[str, Any] = field(default_factory=dict)
    motion_grammar: dict[str, Any] = field(default_factory=dict)
    camera: dict[str, Any] = field(default_factory=dict)
    staging: dict[str, Any] = field(default_factory=dict)
    assessment: tuple[str, ...] = ()

    @property
    def participants(self) -> tuple[str, ...]:
        """Everything this interaction joins — all of which hold primary attention."""
        return self.between

    @property
    def contrast_defined(self) -> bool:
        """Whether this is defined against something rather than by its relation.

        ``polling`` is the worked case: its participants are real, but the lesson —
        "100% CPU is a feature" — means nothing except against interrupt-driven
        receive. Such a concept must declare ``contrasts_with``.
        """
        return bool(self.staging.get("contrast_defined"))


@dataclass(frozen=True, slots=True)
class CompositeConcept(Concept):
    """A story assembled from the other two kinds.

    Attributes:
        composes: Its members, each at a declared depth.
        focus_order: Which members carry the episode, in order.
    """

    composes: tuple[Member, ...] = ()
    focus_order: tuple[str, ...] = ()

    @property
    def members(self) -> tuple[str, ...]:
        """Every member's id, in declaration order."""
        return tuple(m.concept for m in self.composes)

    def depth_of(self, concept: str) -> Depth:
        """How much teaching this composite owes a member.

        Args:
            concept: The member's id.

        Returns:
            Its declared depth.

        Raises:
            ConceptError: That concept is not a member.
        """
        for member in self.composes:
            if member.concept == concept:
                return member.depth
        raise self._fail(
            f"{concept!r} is not a member",
            members=", ".join(self.members) or "none",
        )
