"""``abs plan`` — the validation cascade.

Ordered cheapest-first, so the most common mistakes fail in milliseconds and nothing
renders until every one of them passes. Steps 2 to 6 do not exist in any animation
framework; they are what makes this an educational one.

The rule the whole cascade serves: **a wrong visualization is a compile error, not a
review comment.**
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum

from axiobyte_studio.concepts.base import ConceptKind, InteractionConcept
from axiobyte_studio.concepts.registry import ConceptRegistry, registry
from axiobyte_studio.core.errors import CueNotFoundError, StudioError
from axiobyte_studio.storyboard.episode import Episode
from axiobyte_studio.timeline.cues import CueTable


class Severity(StrEnum):
    """Whether a finding blocks the build."""

    ERROR = "error"
    WARN = "warn"


@dataclass(frozen=True, slots=True)
class Finding:
    """One problem, attributed to the check that found it."""

    step: str
    severity: Severity
    where: str
    message: str
    fix: str = ""

    def __str__(self) -> str:
        """Render as a report line."""
        mark = "✗" if self.severity is Severity.ERROR else "!"
        line = f"  {mark} [{self.step}] {self.where}: {self.message}"
        return f"{line}\n      → {self.fix}" if self.fix else line


@dataclass
class Plan:
    """The result of validating an episode.

    Attributes:
        episode: What was validated.
        cues: The resolved cue table, when resolution succeeded.
        findings: Everything the cascade found.
        steps: Which checks ran, in order, and whether each passed.
    """

    episode: Episode
    cues: CueTable | None = None
    findings: list[Finding] = field(default_factory=list)
    steps: list[tuple[str, bool]] = field(default_factory=list)

    @property
    def errors(self) -> list[Finding]:
        """Findings that block a render."""
        return [f for f in self.findings if f.severity is Severity.ERROR]

    @property
    def ok(self) -> bool:
        """Whether the episode may render."""
        return not self.errors

    def report(self) -> str:
        """Render the cascade for a terminal.

        Returns:
            A multi-line report, ending in a verdict.
        """
        lines = [f"{self.episode.id}  —  {self.episode.title}", ""]
        if self.episode.picture:
            lines += [self.episode.picture.summary(), ""]
        for name, passed in self.steps:
            lines.append(f"  {'ok  ' if passed else 'FAIL'}  {name}")
        if self.findings:
            lines.append("")
            lines += [str(f) for f in self.findings]
        lines.append("")
        warnings = len(self.findings) - len(self.errors)
        lines.append(
            "plan: ready to render"
            if self.ok
            else f"plan: {len(self.errors)} error(s), {warnings} warning(s) — nothing rendered"
        )
        return "\n".join(lines)


def plan(episode: Episode, concepts: ConceptRegistry | None = None) -> Plan:
    """Validate an episode without rendering anything.

    Args:
        episode: The episode to check.
        concepts: The concept SDK. Defaults to the shipped registry.

    Returns:
        The plan, whose ``ok`` says whether a render may proceed.
    """
    sdk = concepts or registry()
    result = Plan(episode=episode)

    _step_cues(result)
    _step_closure(result, sdk)
    _step_focus(result, sdk)
    _step_budget(result, sdk)
    _step_picture(result)
    _step_order(result)
    return result


def _record(result: Plan, name: str, before: int) -> None:
    """Mark a step passed or failed by whether it added errors."""
    added = [f for f in result.findings[before:] if f.severity is Severity.ERROR]
    result.steps.append((name, not added))


# ---------------------------------------------------------------------------
# 1. CUES — every beat lands on a word that is actually spoken.
# ---------------------------------------------------------------------------


def _step_cues(result: Plan) -> None:
    """Resolve the whole cue table. THE ONE RULE, applied to the episode."""
    before = len(result.findings)
    episode = result.episode
    if not (episode.beatmap and episode.timeline):
        result.findings.append(
            Finding("cues", Severity.ERROR, episode.id, "no beat map or no voiceover")
        )
    else:
        try:
            result.cues = CueTable.resolve(episode.beatmap.cues, episode.timeline)
        except CueNotFoundError as exc:
            result.findings.append(
                Finding(
                    "cues",
                    Severity.ERROR,
                    episode.id,
                    exc.message.splitlines()[0],
                    exc.fix or "",
                )
            )
    _record(result, "cues        every beat lands on a spoken word", before)


# ---------------------------------------------------------------------------
# 2. CLOSURE — nothing is used before it is known.
# ---------------------------------------------------------------------------


def _step_closure(result: Plan, sdk: ConceptRegistry) -> None:
    """Every prerequisite is taught earlier or declared assumed.

    Includes the check specific to the concept hierarchy: an Interaction Concept may
    not be taught before its participants, because if a participant is unknown the
    beat carries two new ideas rather than one.
    """
    before = len(result.findings)
    episode = result.episode
    unknown = [c for c in episode.concepts if c not in sdk]
    for concept_id in unknown:
        result.findings.append(
            Finding(
                "closure",
                Severity.ERROR,
                concept_id,
                "is not in the concept SDK",
                "Add it under concepts/library/, or correct the beat.",
            )
        )
    if not unknown:
        for finding in sdk.check_teaching_order(episode.concepts, set(episode.assumed)):
            result.findings.append(
                Finding("closure", Severity.ERROR, finding.concept, finding.message, finding.fix)
            )
    _record(result, "closure     prerequisites known before use", before)


# ---------------------------------------------------------------------------
# 3. FOCUS — one concept per beat, and it must be one the SDK knows.
# ---------------------------------------------------------------------------


def _step_focus(result: Plan, sdk: ConceptRegistry) -> None:
    """Exactly one concept in focus per beat, and its citations must resolve."""
    before = len(result.findings)
    episode = result.episode
    if not episode.beatmap:
        _record(result, "focus       one concept per beat", before)
        return

    for beat in episode.beatmap.beats:
        if not beat.teaches:
            continue
        if beat.concept not in sdk:
            continue  # already reported by closure
        concept = sdk.get(beat.concept)
        if beat.objective and beat.objective not in {o.id for o in concept.objectives}:
            result.findings.append(
                Finding(
                    "focus",
                    Severity.ERROR,
                    beat.id,
                    f"cites objective {beat.objective!r}, which {concept.id} does not declare",
                    f"{concept.id} declares: "
                    + (", ".join(o.id for o in concept.objectives) or "none"),
                )
            )
        if beat.refutes and beat.refutes not in {m.id for m in concept.misconceptions}:
            result.findings.append(
                Finding(
                    "focus",
                    Severity.ERROR,
                    beat.id,
                    f"claims to refute {beat.refutes!r}, which {concept.id} does not declare",
                    f"{concept.id} declares: "
                    + (", ".join(m.id for m in concept.misconceptions) or "none"),
                )
            )
    _record(result, "focus       objectives and refutations resolve", before)


# ---------------------------------------------------------------------------
# 4. BUDGET — how many new ideas each act asks a viewer to hold.
# ---------------------------------------------------------------------------


def _step_budget(result: Plan, sdk: ConceptRegistry) -> None:
    """An act should not introduce more new concepts than a viewer can carry.

    An Interaction Concept counts as **one** new idea, because its participants are
    prerequisites and therefore already known. That is the whole reason interactions
    do not violate the cognitive budget, and it is worth reporting so the claim is
    visible rather than assumed.
    """
    before = len(result.findings)
    episode = result.episode
    if not episode.beatmap:
        _record(result, "budget      new ideas per act", before)
        return

    known = set(episode.assumed)
    for act in episode.beatmap.acts:
        introduced = [c for c in act.concepts if c not in known]
        if len(introduced) > 3:
            result.findings.append(
                Finding(
                    "budget",
                    Severity.WARN,
                    act.id,
                    f"introduces {len(introduced)} new concepts: {', '.join(introduced)}",
                    "An act is 20-60 seconds. Consider splitting it, or moving a "
                    "concept to `assumed` if the audience already has it.",
                )
            )
        known.update(act.concepts)
    _record(result, "budget      new ideas per act", before)


# ---------------------------------------------------------------------------
# 5. PICTURE — the episode's own thesis, checked for the parts that can be.
# ---------------------------------------------------------------------------


def _step_picture(result: Plan) -> None:
    """The thesis exists, and its assertions are well formed and anchored."""
    before = len(result.findings)
    episode = result.episode
    picture = episode.picture
    if picture is None:
        result.findings.append(Finding("picture", Severity.ERROR, episode.id, "has no picture.md"))
        _record(result, "picture     the thesis is stated and anchored", before)
        return

    if not picture.assertions:
        result.findings.append(
            Finding(
                "picture",
                Severity.WARN,
                episode.id,
                f"states {len(picture.prohibitions)} prohibition(s), none machine-checked",
                "Add an `assertions:` block so the thesis becomes a build gate rather "
                "than a note. Two of ep02's three are checkable.",
            )
        )

    known_beats = set(episode.beatmap.cues) if episode.beatmap else set()
    for assertion in picture.assertions:
        if not (assertion.unchanged or assertion.forbids):
            result.findings.append(
                Finding(
                    "picture",
                    Severity.ERROR,
                    assertion.id,
                    "asserts nothing checkable",
                    "Give it `unchanged:` or `forbids:`, or move it to prose.",
                )
            )
        if assertion.after and assertion.after not in known_beats:
            result.findings.append(
                Finding(
                    "picture",
                    Severity.ERROR,
                    assertion.id,
                    f"applies after {assertion.after!r}, which is not a beat",
                    "Anchor the prohibition to a beat id from beats.yaml.",
                )
            )
    _record(result, "picture     the thesis is stated and anchored", before)


# ---------------------------------------------------------------------------
# 6. ORDER — the film runs forwards.
# ---------------------------------------------------------------------------


def _step_order(result: Plan) -> None:
    """Beats are narrated in the order they are declared, and fit the recording."""
    before = len(result.findings)
    episode = result.episode
    if result.cues is None:
        _record(result, "order       beats run forwards, and fit the recording", before)
        return

    for earlier, later in result.cues.out_of_order():
        result.findings.append(
            Finding(
                "order",
                Severity.WARN,
                f"{earlier.name} → {later.name}",
                f"declared in that order but spoken at {earlier.time:.2f}s and {later.time:.2f}s",
                "Usually a wrong sentence index rather than a deliberate flashback.",
            )
        )
    if episode.timeline:
        for cue in result.cues:
            if cue.time > episode.timeline.duration:
                result.findings.append(
                    Finding(
                        "order",
                        Severity.ERROR,
                        cue.name,
                        f"lands at {cue.time:.2f}s, past the end of the "
                        f"{episode.timeline.duration:.2f}s recording",
                    )
                )
    _record(result, "order       beats run forwards, and fit the recording", before)


def summarise_concepts(episode: Episode, sdk: ConceptRegistry | None = None) -> str:
    """A reading of what an episode teaches, by kind.

    Args:
        episode: The episode.
        sdk: The concept SDK. Defaults to the shipped registry.

    Returns:
        One line per concept, in teaching order.
    """
    sdk = sdk or registry()
    lines = []
    for concept_id in episode.concepts:
        if concept_id not in sdk:
            lines.append(f"  {concept_id:<20} UNKNOWN")
            continue
        concept = sdk.get(concept_id)
        extra = ""
        if isinstance(concept, InteractionConcept):
            extra = f"  between {', '.join(concept.between)}"
        elif concept.kind is ConceptKind.COMPOSITE:
            extra = "  composite"
        lines.append(f"  {concept_id:<20} {concept.kind.value:<12}{extra}")
    return "\n".join(lines)


def require_ok(result: Plan) -> None:
    """Raise unless the plan passed.

    Args:
        result: The plan to check.

    Raises:
        StudioError: The episode has errors. Every one is listed.
    """
    if not result.ok:
        raise StudioError(
            f"{result.episode.id}: {len(result.errors)} error(s) — nothing rendered:\n"
            + "\n".join(str(f) for f in result.errors),
            fix="Every check here runs before a frame is drawn, which is the point.",
        )
