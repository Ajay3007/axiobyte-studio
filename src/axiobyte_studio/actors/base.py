"""The Actor System — everything on screen is an actor, and an actor is not a shape.

An actor owns identity, state, anchors, salience and invariants. The state is a
typed machine, and that is what makes the system more than a drawing library: an
episode that animates a freed mbuf being dereferenced is making a **false claim
about DPDK**, and a state machine turns that into a build failure rather than a
review comment.

State machines are opt-in. A ``Legend`` has no lifecycle worth modelling. The rule
is that a machine exists only where legality is part of the lesson — ``Packet``,
``Mbuf``, ``Lock``, ``CacheLine`` — because without that rule the type system
becomes bureaucracy.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from enum import StrEnum
from typing import Any

from axiobyte_studio.core.errors import ConceptError
from axiobyte_studio.design.theme import visual_language


class Salience(StrEnum):
    """How much attention an actor may claim in a beat.

    A beat may hold exactly one ``PRIMARY``. This is the cognitive-load rule made
    structural: without it, screens drift toward busy one defensible addition at a
    time.
    """

    PRIMARY = "primary"
    SUPPORTING = "supporting"
    AMBIENT = "ambient"


@dataclass(frozen=True, slots=True)
class Transition:
    """One legal state change, and the action that causes it."""

    action: str
    source: str
    target: str


@dataclass(frozen=True, slots=True)
class StateMachine:
    """The states an actor may occupy, and the only legal ways between them.

    Attributes:
        initial: The state an actor starts in.
        states: Every state, including terminal ones.
        transitions: Legal moves.
    """

    initial: str
    states: frozenset[str]
    transitions: tuple[Transition, ...]

    def next_state(self, current: str, action: str) -> str:
        """The state an action moves an actor to.

        Args:
            current: The actor's current state.
            action: The action being applied.

        Returns:
            The resulting state.

        Raises:
            ConceptError: The action is illegal from that state. The message names
                the systems fact being violated, because that is what it is.
        """
        for transition in self.transitions:
            if transition.action == action and transition.source == current:
                return transition.target
        legal = sorted({t.action for t in self.transitions if t.source == current})
        from_here = sorted({t.source for t in self.transitions if t.action == action})
        return self._reject(current, action, legal, from_here)

    def _reject(self, current: str, action: str, legal: list[str], from_here: list[str]) -> str:
        """Raise the most informative error the machine can offer."""
        context: dict[str, Any] = {"current state": current}
        if legal:
            context["legal here"] = ", ".join(legal)
        if from_here:
            context[f"{action!r} is legal from"] = ", ".join(from_here)
        raise ConceptError(
            f"{action!r} is not legal from state {current!r}",
            context=context,
            fix=(
                "This is a claim about how the system behaves, not a staging "
                "preference. Either the shot is wrong, or the state machine is."
            ),
        )

    def is_terminal(self, state: str) -> bool:
        """Whether no action leads out of a state.

        Args:
            state: The state to test.

        Returns:
            ``True`` if nothing can follow.
        """
        return not any(t.source == state for t in self.transitions)


@dataclass(frozen=True, slots=True)
class Actor:
    """One thing on screen, with an identity that survives the whole episode.

    Attributes:
        concept: Which registered concept this is — ``"packet"``, ``"mbuf"``.
        instance: Stable identity within an episode, so ``packet#1`` in act one is
            recognisably the same object in act five.
        state: Current state, when the concept has a machine.
        props: Facts about this instance. ``address`` is the load-bearing one for
            zero-copy: the invariant that teaches the lesson watches it.
        salience: How much attention it may claim.
        anchors: Named attachment points, so a link can be drawn to
            ``mbuf.buf_addr`` rather than to a coordinate.
    """

    concept: str
    instance: str
    state: str = ""
    props: dict[str, Any] = field(default_factory=dict)
    salience: Salience = Salience.SUPPORTING
    anchors: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        """Refuse an actor whose concept has no visual identity."""
        visual_language().concept(self.concept)

    @property
    def id(self) -> str:
        """Fully qualified identity, ``concept#instance``."""
        return f"{self.concept}#{self.instance}"

    @property
    def role(self) -> str:
        """The visual role this actor's concept owns."""
        return visual_language().concept(self.concept).role

    def anchor(self, name: str) -> str:
        """A named attachment point on this actor.

        Args:
            name: The anchor name.

        Returns:
            A fully qualified anchor reference.

        Raises:
            ConceptError: This actor declares no such anchor.
        """
        if name not in self.anchors:
            raise ConceptError(
                f"{self.id} has no anchor named {name!r}",
                context={"declares": ", ".join(self.anchors) or "none"},
                fix="Add it to the actor definition, or link to an existing anchor.",
            )
        return f"{self.id}.{name}"

    def with_state(self, state: str) -> Actor:
        """A copy in a new state.

        Args:
            state: The new state.

        Returns:
            The updated actor.
        """
        return replace(self, state=state)

    def with_props(self, **props: Any) -> Actor:
        """A copy with updated facts.

        Args:
            **props: Properties to set or overwrite.

        Returns:
            The updated actor.
        """
        return replace(self, props={**self.props, **props})


@dataclass(frozen=True, slots=True)
class ActorDefinition:
    """The reusable definition a concept's actors are built from.

    Attributes:
        concept: The registered concept id.
        machine: Its state machine, when legality is part of the lesson.
        anchors: Named attachment points every instance has.
        default_props: Facts every instance starts with.
    """

    concept: str
    machine: StateMachine | None = None
    anchors: tuple[str, ...] = ()
    default_props: dict[str, Any] = field(default_factory=dict)

    def spawn(
        self,
        instance: str,
        *,
        salience: Salience = Salience.SUPPORTING,
        **props: Any,
    ) -> Actor:
        """Create one actor from this definition.

        Args:
            instance: Its identity within the episode.
            salience: How much attention it may claim.
            **props: Instance facts, overriding the definition's defaults.

        Returns:
            The new actor, in its initial state.
        """
        return Actor(
            concept=self.concept,
            instance=instance,
            state=self.machine.initial if self.machine else "",
            props={**self.default_props, **props},
            salience=salience,
            anchors=self.anchors,
        )
