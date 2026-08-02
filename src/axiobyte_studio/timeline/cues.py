"""Cue tables — the whole film's timing, resolved before anything renders.

A cue names a moment in the narration. Resolving the table up front is the point:
read a cue table top to bottom and you have read the episode, and a cue that points
at nothing fails now rather than drifting silently later.

One deliberate improvement on the reference episodes: resolution collects *every*
broken cue and reports them together. Fixing a re-cut voiceover one exception at a
time, re-running after each, is the slow path.
"""

from __future__ import annotations

from collections.abc import Iterator, Mapping
from dataclasses import dataclass, field
from itertools import pairwise
from typing import Any

from axiobyte_studio.core.errors import CueNotFoundError, TimelineError
from axiobyte_studio.timeline.timeline import Timeline


@dataclass(frozen=True, slots=True)
class Cue:
    """A moment in the narration, named rather than numbered.

    Attributes:
        word: The spoken word the beat lands on.
        sentence: Which sentence it is in. Optional, but strongly recommended —
            it is what stops a cue from silently re-binding to another occurrence
            when the script changes.
        occurrence: Which occurrence within scope, when the word repeats.
        offset: Seconds to nudge off the word start. Use sparingly; a large offset
            usually means the cue is anchored to the wrong word.
    """

    word: str
    sentence: int | None = None
    occurrence: int = 0
    offset: float = 0.0

    @classmethod
    def parse(cls, spec: Any) -> Cue:
        """Build a cue from YAML-friendly shorthand.

        Accepts ``"word"``, ``"word@4"`` (word in sentence 4), or a mapping with
        explicit keys.

        Args:
            spec: The shorthand string or mapping.

        Returns:
            The parsed cue.

        Raises:
            TimelineError: The shorthand is malformed.
        """
        if isinstance(spec, str):
            word, _, sentence = spec.partition("@")
            if not sentence:
                return cls(word=word)
            if not sentence.isdigit():
                raise TimelineError(
                    f"Malformed cue shorthand {spec!r}",
                    fix="Use 'word' or 'word@<sentence index>', e.g. 'pointer@41'.",
                )
            return cls(word=word, sentence=int(sentence))
        if isinstance(spec, Mapping):
            return cls(
                word=str(spec["word"]),
                sentence=None if spec.get("sentence") is None else int(spec["sentence"]),
                occurrence=int(spec.get("occurrence", 0)),
                offset=float(spec.get("offset", 0.0)),
            )
        raise TimelineError(
            f"Cue must be a string or mapping, got {type(spec).__name__}",
            fix="Use 'word@<sentence>' or {word: …, sentence: …}.",
        )


@dataclass(frozen=True, slots=True)
class ResolvedCue:
    """A cue bound to an absolute time in the voiceover."""

    name: str
    time: float
    cue: Cue
    spoken: str

    def __float__(self) -> float:
        """Allow a resolved cue to be used directly wherever seconds are expected."""
        return self.time


class CueTable:
    """Every named moment in an episode, resolved against one voiceover.

    Attributes:
        cues: Resolved cues, keyed by name, in declaration order.
    """

    def __init__(self, cues: dict[str, ResolvedCue]) -> None:
        self.cues = cues

    @classmethod
    def resolve(cls, specs: Mapping[str, Any], timeline: Timeline) -> CueTable:
        """Resolve a whole cue table, reporting every failure at once.

        Args:
            specs: Cue names mapped to :class:`Cue` objects or their shorthand.
            timeline: The voiceover timeline to resolve against.

        Returns:
            The resolved table.

        Raises:
            CueNotFoundError: One or more cues do not point at spoken words. The
                message lists every failure, so a re-cut voiceover can be repaired
                in one pass.
        """
        resolved: dict[str, ResolvedCue] = {}
        failures: list[str] = []

        for name, spec in specs.items():
            cue = spec if isinstance(spec, Cue) else Cue.parse(spec)
            try:
                word = timeline.find(cue.word, cue.sentence, cue.occurrence)
            except CueNotFoundError as exc:
                failures.append(f"  {name}: {exc.message}")
                continue
            resolved[name] = ResolvedCue(
                name=name,
                time=word.start + cue.offset,
                cue=cue,
                spoken=word.text,
            )

        if failures:
            raise CueNotFoundError(
                f"{len(failures)} of {len(specs)} cues do not point at spoken words:\n"
                + "\n".join(failures),
                fix=(
                    "The voiceover was probably re-cut. Run `abs timeline drift` to see "
                    "what moved, then update these cues together."
                ),
            )
        return cls(resolved)

    # -- access -------------------------------------------------------------

    def __getitem__(self, name: str) -> float:
        """Return a cue's absolute time.

        Args:
            name: The cue name.

        Returns:
            Seconds from the start of the voiceover.

        Raises:
            CueNotFoundError: No cue by that name is declared.
        """
        try:
            return self.cues[name].time
        except KeyError:
            from difflib import get_close_matches

            near = get_close_matches(name, self.cues.keys(), n=3, cutoff=0.6)
            raise CueNotFoundError(
                f"No cue named {name!r} in this episode's cue table",
                context={"did you mean": ", ".join(repr(n) for n in near)} if near else {},
                fix="Add it to the cue table, or correct the name at the call site.",
            ) from None

    def __contains__(self, name: str) -> bool:
        """Whether a cue by that name is declared."""
        return name in self.cues

    def __len__(self) -> int:
        """Number of resolved cues."""
        return len(self.cues)

    def __iter__(self) -> Iterator[ResolvedCue]:
        """Iterate resolved cues in declaration order."""
        return iter(self.cues.values())

    def in_spoken_order(self) -> list[ResolvedCue]:
        """Every cue sorted by when it is spoken, rather than when it was declared."""
        return sorted(self.cues.values(), key=lambda c: c.time)

    def out_of_order(self) -> list[tuple[ResolvedCue, ResolvedCue]]:
        """Consecutive declared cues that run backwards in time.

        A cue table is meant to read top-to-bottom as the film does. A pair that
        goes backwards is usually a wrong sentence index rather than a deliberate
        choice, so ``abs plan`` surfaces it as a warning.

        Returns:
            Pairs ``(earlier_declared, later_declared)`` where the later-declared
            cue is spoken first.
        """
        ordered = list(self.cues.values())
        return [(a, b) for a, b in pairwise(ordered) if b.time < a.time]


@dataclass(slots=True)
class CueTableBuilder:
    """Incremental construction of a cue table, for episode modules.

    Mirrors how the reference episodes declare cues — a flat, readable table —
    while keeping resolution to a single fail-fast pass at the end.
    """

    specs: dict[str, Any] = field(default_factory=dict)

    def at(self, name: str, word: str, sentence: int | None = None, **kwargs: Any) -> None:
        """Declare one cue.

        Args:
            name: The cue name, ``<act>.<beat>.<event>``.
            word: The spoken word the beat lands on.
            sentence: Which sentence the word is in.
            **kwargs: ``occurrence`` and ``offset``.
        """
        self.specs[name] = Cue(word=word, sentence=sentence, **kwargs)

    def build(self, timeline: Timeline) -> CueTable:
        """Resolve everything declared so far.

        Args:
            timeline: The voiceover timeline to resolve against.

        Returns:
            The resolved cue table.
        """
        return CueTable.resolve(self.specs, timeline)
