"""Layout lint — every check runs against every declared target, before any render.

The value is not that these checks exist; it is *when* they run. A label that ships
under a Reels caption, or a slot too small to read on a phone, is discovered by a
viewer unless something checks all formats at plan time.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from axiobyte_studio.layout.solve import SolvedLayout


class Severity(StrEnum):
    """How much a finding matters."""

    ERROR = "error"
    WARN = "warn"


@dataclass(frozen=True, slots=True)
class Finding:
    """One layout problem, in one target.

    Attributes:
        severity: Whether this blocks the build.
        target: Which format the problem occurs in.
        slot: The slot at fault, when there is one.
        message: What is wrong.
        fix: The concrete next action.
    """

    severity: Severity
    target: str
    slot: str
    message: str
    fix: str

    def __str__(self) -> str:
        """Render as one aligned report line."""
        where = f"{self.target}:{self.slot}" if self.slot else self.target
        return f"[{self.severity}] {where}: {self.message}\n         Fix: {self.fix}"


def check(layout: SolvedLayout) -> list[Finding]:
    """Run every layout check against one solved target.

    Args:
        layout: A solved layout.

    Returns:
        Findings, most severe first. Empty means the layout is sound.
    """
    findings: list[Finding] = []
    name = layout.target.id

    for phase_index, phase in enumerate(layout.phases):
        placed = phase.boxes
        phase_note = f" (reveal {phase_index + 1})" if layout.is_split else ""

        for slot, box in sorted(placed.items()):
            if not layout.content.contains(box):
                findings.append(
                    Finding(
                        Severity.ERROR,
                        name,
                        slot,
                        f"falls outside the safe area{phase_note}",
                        "Reduce the relation's weight, or give the shot fewer elements.",
                    )
                )

            if box.w < layout.target.min_element or box.h < layout.target.min_element:
                findings.append(
                    Finding(
                        Severity.ERROR,
                        name,
                        slot,
                        f"is {box.w:.3f} x {box.h:.3f} of the frame — below the "
                        f"{layout.target.min_element} legibility floor{phase_note}",
                        "Split the beat, crop the relation, or move an element to a later beat.",
                    )
                )

            if layout.platform:
                for occluded in layout.target.occluded(layout.platform):
                    if box.overlaps(occluded):
                        findings.append(
                            Finding(
                                Severity.ERROR,
                                name,
                                slot,
                                f"sits under the {layout.platform} interface{phase_note}",
                                f"It will be covered by platform chrome. Solve with "
                                f"platform={layout.platform!r} so the content box excludes it.",
                            )
                        )

        items = sorted(placed.items())
        for index, (slot_a, box_a) in enumerate(items):
            for slot_b, box_b in items[index + 1 :]:
                if box_a.overlaps(box_b):
                    findings.append(
                        Finding(
                            Severity.WARN,
                            name,
                            f"{slot_a}↔{slot_b}",
                            f"overlap{phase_note}",
                            "Siblings should not share area unless one is a deliberate overlay.",
                        )
                    )

    findings.sort(key=lambda f: (f.severity is not Severity.ERROR, f.target, f.slot))
    return findings


def check_all(layouts: dict[str, SolvedLayout]) -> list[Finding]:
    """Run checks across every target a shot declares.

    Args:
        layouts: Solved layouts, keyed by target id.

    Returns:
        Every finding, across every format.
    """
    return [finding for layout in layouts.values() for finding in check(layout)]


def errors(findings: list[Finding]) -> list[Finding]:
    """Only the findings that block a build.

    Args:
        findings: Findings to filter.

    Returns:
        Those with error severity.
    """
    return [f for f in findings if f.severity is Severity.ERROR]


def report(findings: list[Finding]) -> str:
    """Render findings for a terminal.

    Args:
        findings: Findings to render.

    Returns:
        A multi-line report, or a success line when there is nothing to say.
    """
    if not findings:
        return "layout: clean in every target"
    counts = f"{len(errors(findings))} errors, {len(findings) - len(errors(findings))} warnings"
    return f"layout: {counts}\n" + "\n".join(str(f) for f in findings)
