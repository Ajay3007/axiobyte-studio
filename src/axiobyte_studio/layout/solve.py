"""The layout solver — semantic relations plus a target profile become positions.

One shot in, one solved layout per target out. Neither target is derived from the
other; both are projections of the same relations.

The solver also enforces the density budget, because the honest limit of "just
reflow it" is that a wide frame holds seven things legibly and a tall one holds
four. Exceeding that is handled by a strategy the shot declared, never by silently
shrinking everything.
"""

from __future__ import annotations

from dataclasses import dataclass, replace

from axiobyte_studio.core.errors import DesignError
from axiobyte_studio.layout.frame import Box, Target
from axiobyte_studio.layout.relations import (
    Chain,
    Cluster,
    Ensemble,
    OverBudget,
    Relation,
    Stack,
)


@dataclass(frozen=True, slots=True)
class Phase:
    """One reveal within a beat.

    Most beats have a single phase. A relation that exceeded the frame's density
    budget with ``OverBudget.SPLIT`` produces several, played in sequence inside
    the beat's own time window — so the cue table is untouched and the formats stay
    in sync with the narration.
    """

    boxes: dict[str, Box]
    label: str = ""


@dataclass(frozen=True, slots=True)
class SolvedLayout:
    """A shot's relations, resolved for one target.

    Attributes:
        target: The profile this was solved against.
        phases: Sequential reveals; usually exactly one.
        content: The region the shot was allowed to use.
        platform: Which platform's UI was avoided, if any.
        notes: Human-readable record of decisions the solver made.
    """

    target: Target
    phases: tuple[Phase, ...]
    content: Box
    platform: str | None = None
    notes: tuple[str, ...] = ()

    @property
    def boxes(self) -> dict[str, Box]:
        """Placements of the first phase — the common case."""
        return self.phases[0].boxes

    @property
    def is_split(self) -> bool:
        """Whether the beat had to be played as several reveals."""
        return len(self.phases) > 1

    def box(self, slot: str) -> Box:
        """Look up one slot's placement.

        Args:
            slot: The slot name.

        Returns:
            Its box in the first phase that contains it.

        Raises:
            DesignError: No phase placed that slot.
        """
        for phase in self.phases:
            if slot in phase.boxes:
                return phase.boxes[slot]
        placed = sorted({name for phase in self.phases for name in phase.boxes})
        raise DesignError(
            f"Nothing named {slot!r} was placed in this shot",
            context={"placed": ", ".join(placed)},
            fix="Check the slot name against the shot's relations.",
        )

    @property
    def slots(self) -> list[str]:
        """Every placed slot, across all phases."""
        return sorted({name for phase in self.phases for name in phase.boxes})


def _leaf_relations(relation: Relation) -> list[Relation]:
    """Flatten a relation tree to the relations that actually place things."""
    if isinstance(relation, Stack):
        return [leaf for child in relation.children for leaf in _leaf_relations(child)]
    return [relation]


def _apply_budget(relation: Relation, budget: int) -> tuple[list[Relation], list[str]]:
    """Reduce one relation to fit a density budget.

    Returns a list because ``SPLIT`` turns one relation into several sequential
    ones. The notes explain what was done, so ``abs plan`` can report it rather
    than have it discovered at render time.

    Args:
        relation: The relation to check.
        budget: The most slots this frame holds legibly.

    Returns:
        The replacement relations, and notes describing the decision.

    Raises:
        DesignError: The relation is over budget and declared no strategy.
    """
    count = len(relation.slots)
    if count <= budget:
        return [relation], []

    strategy = relation.over_budget
    if strategy is OverBudget.ERROR:
        raise DesignError(
            f"Relation {relation.id!r} holds {count} elements but this frame shows "
            f"{budget} legibly",
            context={"relation": relation.kind},
            fix=(
                "Declare how it should degrade — strategy=OverBudget.SPLIT to play it "
                "as sequential reveals, or OverBudget.CROP to show the first few and "
                "an ellipsis. Silently shrinking everything is not an option."
            ),
        )

    if strategy is OverBudget.CROP:
        kept = budget - 1  # one slot is spent on the ellipsis
        note = f"{relation.id}: cropped {count} → {kept} elements plus an ellipsis"
        if isinstance(relation, Ensemble):
            return [replace(relation, count=kept)], [note]
        if isinstance(relation, Chain):
            return [replace(relation, items=relation.items[:kept])], [note]
        if isinstance(relation, Cluster):
            return [replace(relation, items=relation.items[:kept])], [note]
        raise DesignError(f"Relation {relation.kind!r} cannot be cropped")

    # SPLIT — chunk the relation into successive reveals.
    chunks: list[Relation] = []
    slots = list(relation.slots)
    groups = [slots[i : i + budget] for i in range(0, len(slots), budget)]
    for index, group in enumerate(groups):
        if isinstance(relation, Chain | Cluster):
            chunks.append(replace(relation, id=f"{relation.id}#{index}", items=tuple(group)))
        elif isinstance(relation, Ensemble):
            chunks.append(replace(relation, id=f"{relation.id}#{index}", count=len(group)))
        else:
            raise DesignError(f"Relation {relation.kind!r} cannot be split")
    note = f"{relation.id}: split {count} elements into {len(groups)} reveals"
    return chunks, [note]


def solve(
    relation: Relation,
    target: Target,
    *,
    platform: str | None = None,
    cognitive_budget: int | None = None,
    content: Box | None = None,
) -> SolvedLayout:
    """Resolve a shot's relations into positions for one target.

    Args:
        relation: The shot's root relation. Usually a :class:`Stack`.
        target: The format profile to solve for.
        platform: Platform whose UI must stay clear, e.g. ``"reels"``.
        cognitive_budget: A concept's limit on novel elements per beat. The engine
            uses whichever is lower — the frame's legibility ceiling or this.
        content: The region to solve into. Defaults to the frame's safe area, but a
            shot rendered with chrome must pass the *stage* box instead — the space
            left once the keyword and caption bands have taken theirs. Solving into
            the full safe area is how a diagram ends up under a caption.

    Returns:
        The solved layout.

    Raises:
        DesignError: A relation exceeds the budget with no declared strategy, or
            the relation tree is malformed.
    """
    effective = target if cognitive_budget is None else target.with_density(cognitive_budget)
    if content is None:
        content = effective.content_box(platform)

    notes: list[str] = []
    if cognitive_budget is not None and cognitive_budget < target.density_budget:
        notes.append(
            f"density budget {cognitive_budget} from the concept overrides the frame's "
            f"{target.density_budget}"
        )

    leaves = _leaf_relations(relation)
    if not leaves:
        raise DesignError(
            f"Relation {relation.id!r} places nothing",
            fix="Give it at least one child relation, or drop it from the shot.",
        )

    # Density is measured per placing relation, not on the whole tree: a stack of
    # three chains is not "twelve things at once", it is three groups. The aggregate
    # case — many small relations that each pass — is caught by the legibility floor
    # in layout.lint, which is the backstop this deliberately leaves to it.
    reduced: list[list[Relation]] = []
    for leaf in leaves:
        replacements, leaf_notes = _apply_budget(leaf, effective.density_budget)
        reduced.append(replacements)
        notes.extend(leaf_notes)

    phase_count = max(len(r) for r in reduced)
    phases: list[Phase] = []
    for index in range(phase_count):
        # A relation with fewer phases than the maximum holds its last state.
        picks = [group[min(index, len(group) - 1)] for group in reduced]
        root: Relation = (
            picks[0]
            if len(picks) == 1
            else Stack(
                id=relation.id,
                children=tuple(picks),
                weight=relation.weight,
            )
        )
        phases.append(Phase(boxes=root.solve(content, effective), label=f"phase {index}"))

    return SolvedLayout(
        target=effective,
        phases=tuple(phases),
        content=content,
        platform=platform,
        notes=tuple(notes),
    )


def solve_all(
    relation: Relation,
    targets: list[str],
    *,
    platforms: dict[str, str] | None = None,
    cognitive_budget: int | None = None,
    content: Box | None = None,
) -> dict[str, SolvedLayout]:
    """Solve one shot for every declared target at once.

    This is what ``abs plan`` calls. Solving all formats together is the point:
    a layout that works in 16:9 and breaks in 9:16 should fail the build, not
    surface after a render.

    Args:
        relation: The shot's root relation.
        targets: Target profile ids.
        platforms: Optional platform per target, e.g. ``{"9x16": "reels"}``.
        cognitive_budget: The concept's limit on novel elements.
        content: The region to solve into, shared by every target. Defaults to each
            target's own safe area.

    Returns:
        One solved layout per target.
    """
    from axiobyte_studio.layout.frame import target as load_target

    platforms = platforms or {}
    return {
        name: solve(
            relation,
            load_target(name),
            platform=platforms.get(name),
            cognitive_budget=cognitive_budget,
            content=content,
        )
        for name in targets
    }
