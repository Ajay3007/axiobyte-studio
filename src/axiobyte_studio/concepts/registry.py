"""The concept registry — loading, validating, and traversing the knowledge graph.

Five of the six gates that keep Interaction Concepts from becoming a loophole are
enforced here (``CONCEPT-ARCHITECTURE.md`` §5.5). The sixth — *is the removal test
actually true* — cannot be automated, and pretending otherwise would be the loophole.
What this module can do is guarantee the argument was written down, per participant,
so a reviewer has something specific to disagree with.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any

import yaml

from axiobyte_studio.concepts.base import (
    AtomicConcept,
    CompositeConcept,
    Concept,
    ConceptKind,
    Depth,
    InteractionConcept,
    Member,
    Misconception,
    Objective,
)
from axiobyte_studio.core.errors import ConceptError

_LIBRARY = Path(__file__).parent / "library"

#: The seven blocks an Interaction Concept must carry. Missing any one of them
#: means it is not an interaction; it is two things on screen.
REQUIRED_INTERACTION_BLOCKS = (
    "objectives",
    "misconceptions",
    "visual_grammar",
    "motion_grammar",
    "camera",
    "staging",
    "assessment",
)


@dataclass(frozen=True, slots=True)
class Finding:
    """One problem with a concept, or with the graph."""

    concept: str
    message: str
    fix: str

    def __str__(self) -> str:
        """Render as a report line."""
        return f"  {self.concept}: {self.message}\n      Fix: {self.fix}"


def _objectives(raw: list[dict[str, Any]] | None) -> tuple[Objective, ...]:
    """Parse the objectives block."""
    return tuple(
        Objective(
            id=str(o["id"]), statement=str(o["statement"]), evidence=str(o.get("evidence", ""))
        )
        for o in raw or []
    )


def _misconceptions(raw: list[dict[str, Any]] | None) -> tuple[Misconception, ...]:
    """Parse the misconceptions block."""
    return tuple(
        Misconception(
            id=str(m["id"]),
            wrong=str(m["wrong"]),
            refute_by=str(m["refute_by"]),
            source=str(m.get("source", "")),
        )
        for m in raw or []
    )


def _parse(raw: dict[str, Any], source: Path) -> Concept:
    """Build one concept from its file.

    Args:
        raw: The parsed YAML mapping.
        source: Where it came from.

    Returns:
        The concept, of whichever kind it declares.

    Raises:
        ConceptError: The file declares no kind, or an unknown one.
    """
    try:
        kind = ConceptKind(str(raw["kind"]))
    except KeyError:
        raise ConceptError(
            f"{source.name} declares no `kind:`",
            fix="Add `kind: atomic`, `kind: interaction`, or `kind: composite`.",
        ) from None
    except ValueError:
        raise ConceptError(
            f"{source.name} declares an unknown kind {raw['kind']!r}",
            context={"valid": ", ".join(k.value for k in ConceptKind)},
            fix="A concept is a thing, a relationship, or a story. Pick one.",
        ) from None

    pedagogy = raw.get("pedagogy", {})
    relations = raw.get("relations", {})
    common: dict[str, Any] = {
        "id": str(raw["id"]),
        "kind": kind,
        "version": str(raw.get("version", "0.1.0")),
        "domain": str(raw.get("domain", "")),
        "title": str(raw.get("title", "")),
        "objectives": _objectives(pedagogy.get("objectives")),
        "misconceptions": _misconceptions(pedagogy.get("misconceptions")),
        "requires": tuple(relations.get("requires", [])),
        "contrasts_with": tuple(relations.get("contrasts_with", [])),
        "composes_into": tuple(relations.get("composes_into", [])),
        "source": str(source),
    }

    if kind is ConceptKind.ATOMIC:
        return AtomicConcept(
            **common,
            states=tuple(raw.get("states", [])),
            anchors=tuple(raw.get("anchors", [])),
        )
    if kind is ConceptKind.INTERACTION:
        return InteractionConcept(
            **common,
            between=tuple(raw.get("between", [])),
            removal_test=dict(pedagogy.get("removal_test", {})),
            visual_grammar=dict(raw.get("visual_grammar", {})),
            motion_grammar=dict(raw.get("motion_grammar", {})),
            camera=dict(raw.get("camera", {})),
            staging=dict(raw.get("staging", {})),
            assessment=tuple(raw.get("assessment", {}).get("after_this_the_viewer_can", [])),
        )
    return CompositeConcept(
        **common,
        composes=tuple(
            Member(concept=str(m["concept"]), depth=Depth(str(m.get("depth", "brief"))))
            for m in raw.get("composes", [])
        ),
        focus_order=tuple(raw.get("focus_order", [])),
    )


class ConceptRegistry:
    """Every concept the Studio knows, and the graph they form."""

    def __init__(self, concepts: dict[str, Concept]) -> None:
        self._concepts = concepts

    # -- construction -------------------------------------------------------

    @classmethod
    def load(cls, root: Path | None = None) -> ConceptRegistry:
        """Load and validate the whole SDK.

        Args:
            root: Library directory. Defaults to the one shipped with the package.

        Returns:
            The loaded registry.

        Raises:
            ConceptError: A file is malformed, an id is duplicated, or the graph
                fails validation. Every problem is reported together.
        """
        root = root or _LIBRARY
        concepts: dict[str, Concept] = {}
        for path in sorted(root.rglob("*.yaml")):
            raw = yaml.safe_load(path.read_text(encoding="utf-8"))
            if not isinstance(raw, dict):
                raise ConceptError(f"{path.name} does not contain a mapping")
            concept = _parse(raw, path)
            if concept.id in concepts:
                raise ConceptError(
                    f"Two concepts share the id {concept.id!r}",
                    context={"here": str(path), "and": concepts[concept.id].source},
                    fix="Concept ids are the SDK's namespace; rename one.",
                )
            concepts[concept.id] = concept

        registry = cls(concepts)
        findings = registry.validate()
        if findings:
            raise ConceptError(
                f"The concept SDK has {len(findings)} problem(s):\n"
                + "\n".join(str(f) for f in findings),
                fix="Every gate here exists to keep the hierarchy meaningful.",
            )
        return registry

    # -- access -------------------------------------------------------------

    def get(self, concept_id: str) -> Concept:
        """Look up one concept.

        Args:
            concept_id: Its id.

        Returns:
            The concept.

        Raises:
            ConceptError: No concept by that id is registered.
        """
        try:
            return self._concepts[concept_id]
        except KeyError:
            from difflib import get_close_matches

            near = get_close_matches(concept_id, self._concepts, n=3, cutoff=0.6)
            raise ConceptError(
                f"No concept named {concept_id!r}",
                context={"did you mean": ", ".join(near)} if near else {},
                fix="Add it under concepts/library/, or correct the reference.",
            ) from None

    def of_kind(self, kind: ConceptKind) -> list[Concept]:
        """Every concept of one kind, by id.

        Args:
            kind: Which kind.

        Returns:
            The matching concepts, id-sorted.
        """
        return sorted((c for c in self._concepts.values() if c.kind is kind), key=lambda c: c.id)

    def __contains__(self, concept_id: str) -> bool:
        """Whether a concept is registered."""
        return concept_id in self._concepts

    def __len__(self) -> int:
        """How many concepts are registered."""
        return len(self._concepts)

    @property
    def ids(self) -> list[str]:
        """Every registered concept id."""
        return sorted(self._concepts)

    # -- the gates ----------------------------------------------------------

    def validate(self) -> list[Finding]:
        """Run every mechanical gate over the whole SDK.

        Returns:
            Findings, empty when the SDK is sound.
        """
        findings: list[Finding] = []
        for concept in self._concepts.values():
            findings.extend(self._check_references(concept))
            if isinstance(concept, InteractionConcept):
                findings.extend(self._check_interaction(concept))
            if isinstance(concept, CompositeConcept):
                findings.extend(self._check_composite(concept))
        return findings

    def _check_references(self, concept: Concept) -> list[Finding]:
        """Every id a concept names must exist."""
        found = []
        for field_name in ("requires", "contrasts_with", "composes_into"):
            for other in getattr(concept, field_name):
                if other not in self._concepts:
                    found.append(
                        Finding(
                            concept.id,
                            f"{field_name} names {other!r}, which is not registered",
                            f"Add concepts/library/**/{other}.yaml, or correct the name.",
                        )
                    )
        return found

    def _check_interaction(self, concept: InteractionConcept) -> list[Finding]:
        """Gates 1-5 from §5.5, in order."""
        found: list[Finding] = []

        # Gate 1 — at least two participants, all of them atomic and registered.
        if len(concept.between) < 2:
            found.append(
                Finding(
                    concept.id,
                    f"`between:` names {len(concept.between)} participant(s); an "
                    "interaction needs at least two",
                    "If it has one participant it is an atomic concept, not a relationship.",
                )
            )
        for participant in concept.between:
            if participant not in self._concepts:
                found.append(
                    Finding(
                        concept.id,
                        f"participant {participant!r} is not registered",
                        f"Add concepts/library/atomic/{participant}.yaml.",
                    )
                )
            elif self._concepts[participant].kind is not ConceptKind.ATOMIC:
                found.append(
                    Finding(
                        concept.id,
                        f"participant {participant!r} is "
                        f"{self._concepts[participant].kind}, not atomic",
                        "Interactions join things. To build on another relationship, "
                        "use `requires:` or make this a composite.",
                    )
                )

            # Gate 2 — every participant is a declared prerequisite. This is what
            # keeps the beat to one NEW idea (§5.4).
            if participant not in concept.requires:
                found.append(
                    Finding(
                        concept.id,
                        f"participant {participant!r} is not in `requires:`",
                        "Participants must be prerequisites, or the beat carries two "
                        "new ideas instead of one.",
                    )
                )

            # Gate 3 — the removal argument is written down, per participant.
            if not concept.removal_test.get(participant, "").strip():
                found.append(
                    Finding(
                        concept.id,
                        f"no `removal_test:` entry for {participant!r}",
                        "State what remains if it is taken away. If the lesson "
                        "survives, this is not an interaction.",
                    )
                )

        # Gate 4 — all seven blocks present and non-empty.
        blocks = {
            "objectives": concept.objectives,
            "misconceptions": concept.misconceptions,
            "visual_grammar": concept.visual_grammar,
            "motion_grammar": concept.motion_grammar,
            "camera": concept.camera,
            "staging": concept.staging,
            "assessment": concept.assessment,
        }
        for name, value in blocks.items():
            if not value:
                found.append(
                    Finding(
                        concept.id,
                        f"required block `{name}` is missing or empty",
                        f"An Interaction Concept owns all seven blocks: "
                        f"{', '.join(REQUIRED_INTERACTION_BLOCKS)}.",
                    )
                )

        # Gate 5 — a contrast-defined interaction must name what it contrasts with.
        if concept.contrast_defined and not concept.contrasts_with:
            found.append(
                Finding(
                    concept.id,
                    "is declared contrast-defined but names no `contrasts_with:`",
                    "Its lesson only exists against something else. Name that thing.",
                )
            )
        return found

    def _check_composite(self, concept: CompositeConcept) -> list[Finding]:
        """A composite's members must exist, and its focus must be among them."""
        found = []
        for member in concept.members:
            if member not in self._concepts:
                found.append(
                    Finding(
                        concept.id,
                        f"member {member!r} is not registered",
                        f"Add concepts/library/**/{member}.yaml, or correct the name.",
                    )
                )
        for focused in concept.focus_order:
            if focused not in concept.members:
                found.append(
                    Finding(
                        concept.id,
                        f"focus_order names {focused!r}, which it does not compose",
                        "A composite can only foreground its own members.",
                    )
                )
        return found

    # -- the graph ----------------------------------------------------------

    def closure(self, concept_id: str) -> list[str]:
        """Everything a concept transitively requires.

        Args:
            concept_id: Where to start.

        Returns:
            Prerequisite ids, nearest first, excluding the concept itself.

        Raises:
            ConceptError: The requires graph contains a cycle.
        """
        seen: list[str] = []
        stack = [(concept_id, [concept_id])]
        while stack:
            current, path = stack.pop()
            for required in self.get(current).requires:
                if required in path:
                    raise ConceptError(
                        f"Prerequisite cycle: {' -> '.join([*path, required])}",
                        fix="A concept cannot require something that requires it.",
                    )
                if required not in seen:
                    seen.append(required)
                stack.append((required, [*path, required]))
        return seen

    def check_teaching_order(
        self, order: list[str], assumed: set[str] | None = None
    ) -> list[Finding]:
        """Verify an episode teaches things in a possible order.

        Two checks. Prerequisites must precede their dependents — the ordinary one.
        And **an interaction may not be taught before its participants**, which is
        the mechanism behind one-new-idea-per-beat: if a participant is unknown, the
        beat carries two new ideas and the cognitive budget really is violated.

        Args:
            order: Concept ids, in the order the episode teaches them.
            assumed: Concepts the audience is declared to know already.

        Returns:
            Findings, empty when the order is sound.
        """
        known = set(assumed or ())
        found: list[Finding] = []
        for concept_id in order:
            concept = self.get(concept_id)
            for required in concept.requires:
                if required not in known:
                    found.append(
                        Finding(
                            concept_id,
                            f"requires {required!r}, which is neither taught earlier "
                            "nor declared assumed",
                            f"Teach {required!r} first, or add it to the episode's "
                            "assumed knowledge.",
                        )
                    )
            if isinstance(concept, InteractionConcept):
                for participant in concept.between:
                    if participant not in known:
                        found.append(
                            Finding(
                                concept_id,
                                f"is an interaction taught before its participant "
                                f"{participant!r} is known",
                                "An interaction's participants must already be "
                                "familiar, or the beat carries two new ideas.",
                            )
                        )
            known.add(concept_id)
        return found

    def stats(self) -> dict[str, Any]:
        """A health reading on the shape of the SDK.

        Interaction Concepts should stay a minority. A catalogue that is mostly
        interactions has stopped distinguishing relationships from crowded frames.

        Returns:
            Counts per kind, the interaction ratio, and whether it looks healthy.
        """
        counts = Counter(c.kind.value for c in self._concepts.values())
        total = len(self._concepts) or 1
        ratio = counts[ConceptKind.INTERACTION.value] / total
        return {
            "total": len(self._concepts),
            "by_kind": dict(counts),
            "interaction_ratio": round(ratio, 3),
            "healthy": ratio <= 0.5,
        }


@cache
def registry() -> ConceptRegistry:
    """The process-wide concept registry."""
    return ConceptRegistry.load()


def concept(concept_id: str) -> Concept:
    """Look up one concept in the shipped SDK.

    Args:
        concept_id: Its id.

    Returns:
        The concept.
    """
    return registry().get(concept_id)
