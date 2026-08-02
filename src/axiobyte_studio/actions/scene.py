"""A Scene — the actors of one shot, and the actions applied to them.

This is where the architecture's central claim becomes executable: **a wrong
visualization is a compile error, not a review comment.** A scene validates every
action against the subject's state machine as it is applied, and validates every
invariant over the completed log.

The zero-copy episode is the worked case. Its lesson — *the bytes never move* — is
expressed as an invariant on the payload's address. Any staging that moves those
bytes fails, and it fails as a factual error about DPDK rather than as a note about
composition.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from typing import Any

from axiobyte_studio.actions.base import Action, AppliedAction, Invariant
from axiobyte_studio.actors.base import Actor, ActorDefinition, Salience
from axiobyte_studio.core.errors import ConceptError


@dataclass(frozen=True, slots=True)
class Violation:
    """One broken invariant, with enough detail to locate it in the episode."""

    invariant: str
    statement: str
    detail: str
    at: float | None = None

    def __str__(self) -> str:
        """Render as a report line."""
        when = f" at t={self.at:.2f}s" if self.at is not None else ""
        return f"{self.invariant}: {self.statement}\n    violated{when} — {self.detail}"


@dataclass
class Scene:
    """The actors of one shot, and everything that happens to them.

    Attributes:
        id: The shot or beat this scene belongs to.
        actors: Live actors, by instance id.
        log: Every action applied, in the order it occurred.
        invariants: What must hold across the whole scene.
    """

    id: str
    actors: dict[str, Actor] = field(default_factory=dict)
    log: list[AppliedAction] = field(default_factory=list)
    invariants: list[Invariant] = field(default_factory=list)
    _definitions: dict[str, ActorDefinition] = field(default_factory=dict, repr=False)
    _initial: dict[str, Actor] = field(default_factory=dict, repr=False)

    # -- population ---------------------------------------------------------

    def cast(
        self,
        definition: ActorDefinition,
        instance: str,
        *,
        salience: Salience = Salience.SUPPORTING,
        **props: Any,
    ) -> Actor:
        """Add an actor to the scene.

        Args:
            definition: The reusable definition to build from.
            instance: Identity within the episode.
            salience: How much attention it may claim.
            **props: Instance facts.

        Returns:
            The new actor.

        Raises:
            ConceptError: That instance id is already cast.
        """
        actor = definition.spawn(instance, salience=salience, **props)
        if actor.id in self.actors:
            raise ConceptError(
                f"{actor.id} is already in this scene",
                fix="Instance ids identify one object across the episode; pick another.",
            )
        self.actors[actor.id] = actor
        self._definitions[actor.id] = definition
        self._initial[actor.id] = actor
        return actor

    def require(self, invariant: Invariant) -> None:
        """Declare something that must hold across this scene.

        Args:
            invariant: What must remain true.
        """
        self.invariants.append(invariant)

    # -- action -------------------------------------------------------------

    def apply(self, action: Action, actor_id: str, at: float, **params: Any) -> Actor:
        """Apply an action, validating it against the actor's state machine.

        Args:
            action: The action to apply.
            actor_id: Which actor, by id.
            at: When, in seconds from the start of the voiceover.
            **params: Action parameters.

        Returns:
            The actor in its new state.

        Raises:
            ConceptError: No such actor, the action's subject does not match, or
                the transition is illegal from the actor's current state.
        """
        actor = self._actor(actor_id)
        if not action.accepts(actor.concept):
            raise ConceptError(
                f"{action.name!r} does not apply to a {actor.concept!r}",
                context={"actor": actor.id, "applies to": ", ".join(action.subjects)},
                fix=(
                    "Apply it to one of those concepts, or add this one to the "
                    "action's `subjects` if the verb genuinely means the same thing."
                ),
            )

        machine = self._definitions[actor.id].machine
        before = actor.state
        after = machine.next_state(before, action.name) if machine else before

        updated = actor.with_state(after)
        if params:
            updated = updated.with_props(**params)
        self.actors[actor.id] = updated
        self.log.append(
            AppliedAction(
                action=action.name,
                actor=actor.id,
                at=at,
                before=before,
                after=after,
                params=dict(params),
            )
        )
        return updated

    def _actor(self, actor_id: str) -> Actor:
        """Look up an actor, or say what is actually cast."""
        try:
            return self.actors[actor_id]
        except KeyError:
            raise ConceptError(
                f"Nothing named {actor_id!r} is in this scene",
                context={"cast": ", ".join(sorted(self.actors)) or "nothing"},
                fix="Cast it before acting on it, or correct the id.",
            ) from None

    # -- validation ---------------------------------------------------------

    def check(self) -> list[Violation]:
        """Validate every declared invariant against what actually happened.

        Returns:
            Violations, in declaration order. Empty means the scene tells the truth.
        """
        violations: list[Violation] = []
        for invariant in self.invariants:
            violations.extend(self._check_unchanged(invariant))
            violations.extend(self._check_forbidden(invariant))
        return violations

    def _check_unchanged(self, invariant: Invariant) -> list[Violation]:
        """Properties that must not move — the zero-copy case."""
        if not invariant.unchanged:
            return []
        actor_id = invariant.actor
        if actor_id not in self._initial:
            return [
                Violation(
                    invariant.id,
                    invariant.statement,
                    f"constrains {actor_id!r}, which is not in this scene",
                )
            ]
        found: list[Violation] = []
        start, now = self._initial[actor_id], self.actors[actor_id]
        for prop in invariant.unchanged:
            was, is_now = start.props.get(prop), now.props.get(prop)
            if was != is_now:
                last = next(
                    (entry for entry in reversed(self.log) if entry.actor == actor_id), None
                )
                found.append(
                    Violation(
                        invariant.id,
                        invariant.statement,
                        f"{actor_id}.{prop} changed from {was!r} to {is_now!r}",
                        at=last.at if last else None,
                    )
                )
        return found

    def _check_forbidden(self, invariant: Invariant) -> list[Violation]:
        """Actions that may not occur — "and this does not happen"."""
        found: list[Violation] = []
        for name in invariant.forbids:
            for entry in self.log:
                if entry.action == name:
                    found.append(
                        Violation(
                            invariant.id,
                            invariant.statement,
                            f"{name!r} was applied to {entry.actor}",
                            at=entry.at,
                        )
                    )
        return found

    def check_salience(self) -> list[Violation]:
        """Verify that exactly one actor claims primary attention.

        Args:
            None.

        Returns:
            A violation when zero or several actors are primary.
        """
        counts = Counter(a.salience for a in self.actors.values())
        primary = counts[Salience.PRIMARY]
        if primary == 1:
            return []
        names = sorted(a.id for a in self.actors.values() if a.salience is Salience.PRIMARY)
        return [
            Violation(
                "FOCUS",
                "exactly one actor holds primary attention in a beat",
                f"{primary} are primary: {', '.join(names) or 'none'}",
            )
        ]

    def verify(self) -> None:
        """Check everything, and raise if the scene does not tell the truth.

        Raises:
            ConceptError: One or more invariants were violated. The message lists
                every failure so a shot can be repaired in one pass.
        """
        violations = [*self.check(), *self.check_salience()]
        if violations:
            raise ConceptError(
                f"{self.id}: {len(violations)} invariant(s) violated:\n"
                + "\n".join(f"  {v}" for v in violations),
                fix=(
                    "An invariant is the lesson written as an assertion. A violation "
                    "means the staging contradicts what the episode claims to teach — "
                    "fix the shot, or fix the concept."
                ),
            )

    # -- reporting ----------------------------------------------------------

    def timeline(self) -> str:
        """The scene's action log, as a readable trace.

        Returns:
            One line per action, in the order it occurred.
        """
        if not self.log:
            return f"{self.id}: nothing happens"
        lines = [f"{self.id}:"]
        for entry in self.log:
            arrow = f"{entry.before} -> {entry.after}" if entry.before != entry.after else "="
            lines.append(f"  {entry.at:7.2f}s  {entry.action:<12} {entry.actor:<16} {arrow}")
        return "\n".join(lines)
