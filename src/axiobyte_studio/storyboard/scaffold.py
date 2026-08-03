"""Scaffolding an episode from the concepts it teaches.

This is the Educational Grammar's *scaffold-then-refine* contract
(``CONCEPT-ARCHITECTURE.md`` §11.4) made real. The grammar does not draw the
episode; it produces a **plain, correct default** which the author then refines,
and the concept's assertions keep holding over whatever refinement happens.

The scaffold is derived, not templated. A concept already declares its objectives,
its misconceptions, its participants, its staging template and its motion grammar —
so a beat per objective, an act per concept, and a cast per participant all follow
from what the SDK already knows. Every line generated here is a line the author did
not write, and it is the compounding the Studio exists to produce.

What it deliberately does **not** invent is timing. Cues are marked ``TODO`` and
``abs plan`` fails on them until a voiceover exists, because a beat that lands on a
guessed moment is exactly what THE ONE RULE forbids.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from axiobyte_studio.concepts.base import Concept, ConceptKind, InteractionConcept
from axiobyte_studio.concepts.registry import ConceptRegistry, registry
from axiobyte_studio.core.errors import StudioError

_ID = re.compile(r"^s\d{2}e\d{2}-[a-z0-9]+(-[a-z0-9]+)*$")


@dataclass(frozen=True, slots=True)
class Scaffold:
    """What was written, and what the author still owes.

    Attributes:
        root: The episode directory.
        files: Files created, in the order an author should open them.
        todo: What the scaffold could not decide.
    """

    root: Path
    files: tuple[Path, ...]
    todo: tuple[str, ...]

    def report(self) -> str:
        """Render for a terminal.

        Returns:
            The files written and what remains.
        """
        lines = [f"{self.root}", ""]
        lines += [f"  wrote  {f.relative_to(self.root)}" for f in self.files]
        if self.todo:
            lines.append("")
            lines.append("  still yours:")
            lines += [f"    - {item}" for item in self.todo]
        return "\n".join(lines)


def _validate(episode_id: str, concepts: list[str], sdk: ConceptRegistry) -> list[Concept]:
    """Check the request before writing anything."""
    if not _ID.match(episode_id):
        raise StudioError(
            f"{episode_id!r} is not an episode id",
            fix="Use sNNeNN-kebab-slug, e.g. s01e03-poll-mode.",
        )
    if not concepts:
        raise StudioError(
            "An episode must teach something",
            fix="Name at least one concept: --concept polling",
        )
    resolved = [sdk.get(c) for c in concepts]
    composites = [c.id for c in resolved if c.kind is ConceptKind.COMPOSITE]
    if composites:
        raise StudioError(
            f"A composite cannot be an episode's concept list: {', '.join(composites)}",
            fix=(
                "A composite IS an episode's shape. Name its members instead, or "
                "scaffold from it with --from-composite."
            ),
        )
    return resolved


def _picture(episode_id: str, concepts: list[Concept]) -> str:
    """A thesis prompt, seeded from what the concepts claim to teach."""
    objectives = [o for c in concepts for o in c.objectives]
    counters = [c.contrasts_with[0] for c in concepts if c.contrasts_with]
    prohibitions = [
        f"- {m.wrong}  (this episode exists partly to destroy that)"
        for c in concepts
        for m in c.misconceptions
    ]
    return f"""# THE ONE PICTURE — {episode_id}

## The One Picture

<!-- One sentence. The whole episode is an arrangement to make this obvious.
     Not a summary — a description of what will literally be on screen. -->

{objectives[0].statement if objectives else "TODO"}

## The counter-picture

<!-- What you build first, on purpose, so that it can be destroyed. -->

{"Contrast with: " + ", ".join(counters) if counters else "TODO"}

## The payoff frame

<!-- The single frame this episode exists to earn. -->

TODO

## What must never happen

{chr(10).join(prohibitions) if prohibitions else "- TODO"}

```yaml
# Clauses the engine can check. Two of ep02's three were checkable.
assertions: []
```
"""


def _keyword(concept: Concept) -> str:
    """The pinned chapter keyword for a concept.

    Derived from the id, never from the title. Slicing a title to fit produced
    ``"FALSE SHARING — TWO THRE"``, and a keyword cut mid-word is worse than no
    keyword: it reads as a bug on screen for the whole act.
    """
    return concept.id.replace("_", " ").upper()


def _beats(concepts: list[Concept]) -> str:
    """One act per concept; one beat per objective, and one per misconception."""
    lines = [
        "# Generated from the concepts this episode teaches.",
        "#",
        "# Cues are TODO on purpose. `abs plan` will fail until every beat lands on a",
        "# word that is actually spoken — a beat on a guessed moment is what THE ONE",
        "# RULE forbids. Record the voiceover, transcribe it, then fill these in.",
        "acts:",
    ]
    for concept in concepts:
        act = concept.id
        lines.append(f"  - id: {act}")
        lines.append(f'    keyword: "{_keyword(concept)}"')
        lines.append("    beats:")
        for objective in concept.objectives:
            lines.append(f"      - id: {act}.{objective.id.lower().replace('-', '_')}")
            lines.append('        cue: "TODO@0"')
            lines.append(f"        concept: {concept.id}")
            lines.append(f"        objective: {objective.id}")
            lines.append(f"        intent: {objective.statement[:70]!r}")
        for misconception in concept.misconceptions[:1]:
            lines.append(f"      - id: {act}.refute")
            lines.append('        cue: "TODO@0"')
            lines.append(f"        concept: {concept.id}")
            lines.append(f"        refutes: {misconception.id}")
            lines.append(f"        intent: {('destroy: ' + misconception.wrong)[:70]!r}")
    return "\n".join(lines) + "\n"


def _shots(episode_id: str, concepts: list[Concept]) -> str:
    """One staging function per concept, cast from its declared participants."""
    acts = []
    for concept in concepts:
        participants = (
            list(concept.between) if isinstance(concept, InteractionConcept) else [concept.id]
        )
        template = (
            concept.staging.get("template", "journey")
            if isinstance(concept, InteractionConcept)
            else "reveal"
        )
        motion_name = (
            concept.motion_grammar.get("primary", "packet.travel")
            if isinstance(concept, InteractionConcept)
            else "packet.travel"
        )
        first_beat = (
            f"{concept.id}.{concept.objectives[0].id.lower().replace('-', '_')}"
            if concept.objectives
            else f"{concept.id}.open"
        )
        cast = "\n".join(
            f"    scene.add(\n"
            f'        draw(ACTORS["{p}"].spawn("1"), layout.boxes["{p}"], '
            f"scene.target, scene.theme)\n"
            f"    )"
            for p in participants
        )
        acts.append(
            f'''

def stage_{concept.id}(scene: StudioScene) -> None:
    """{concept.title or concept.id}.

    Staging template: {template}.
    Motion: {motion_name} — {concept.objectives[0].statement[:64] if concept.objectives else ""}
    """
    layout = scene.solve_shot(SHOT_{concept.id.upper()})
    scene.at("{first_beat}")
    scene.keyword("{_keyword(concept)}", role="packet", run_time=0.4)
{cast}
    # REFINE FROM HERE. The scaffold is correct and plain; the episode is not made
    # by what is generated but by what you do next.
    scene.wait(0.5)'''
        )

    shots = "\n".join(
        f"SHOT_{c.id.upper()} = Stack(\n"
        f'    id="{episode_id}.{c.id}",\n'
        f'    children=(Chain(id="{c.id}", items=('
        + ", ".join(
            f'"{p}"' for p in (list(c.between) if isinstance(c, InteractionConcept) else [c.id])
        )
        + ")),),\n)"
        for c in concepts
    )

    return f'''"""{episode_id} — the shots.

Scaffolded from the concepts this episode teaches. Each act casts the participants
its concept declares and opens on that concept's first objective; the staging is a
plain, correct default. What makes the episode is what you write after that.
"""

from __future__ import annotations

from pathlib import Path

from axiobyte_studio.actors import LIBRARY as ACTORS
from axiobyte_studio.backends.manim import StudioScene, build_episode_scenes, draw
from axiobyte_studio.layout import Chain, Stack

EPISODE_ROOT = Path(__file__).resolve().parents[1]

{shots}
{"".join(acts)}


SCENES = build_episode_scenes(
    globals(),
    EPISODE_ROOT,
    acts=({", ".join(f"stage_{c.id}" for c in concepts)},),
)
'''


def new_episode(
    episode_id: str,
    concepts: list[str],
    *,
    into: str | Path = "episodes",
    pillar: str = "",
    targets: list[str] | None = None,
    sdk: ConceptRegistry | None = None,
) -> Scaffold:
    """Scaffold an episode from the concepts it will teach.

    Args:
        episode_id: ``sNNeNN-kebab-slug``.
        concepts: Concept ids, in teaching order.
        into: The episodes directory.
        pillar: Which content pillar.
        targets: Formats to declare. Others stay renderable on demand anyway.
        sdk: The concept SDK. Defaults to the shipped registry.

    Returns:
        What was written, and what the author still owes.

    Raises:
        StudioError: The id is malformed, a concept is unknown, or the directory
            already exists — scaffolding over an authored episode would be the
            worst possible thing this command could do.
    """
    resolved = _validate(episode_id, concepts, sdk or registry())
    root = Path(into) / episode_id
    if root.exists():
        raise StudioError(
            f"{root} already exists",
            fix="Scaffolding would overwrite authored work. Delete it first, or pick another id.",
        )

    # Everything a participant needs must already be known, or the first beat
    # carries more than one new idea.
    assumed = sorted({p for c in resolved for p in getattr(c, "between", ())})

    (root / "storyboard").mkdir(parents=True)
    (root / "shots").mkdir()

    manifest = root / "episode.yaml"
    manifest.write_text(
        f"""id: {episode_id}
title: "TODO"
pillar: {pillar or "TODO"}

targets: [{", ".join(targets or ["16x9", "9x16"])}]
platforms: {{ 9x16: reels }}
theme: systems

# Every participant of every interaction taught here. `abs plan` refuses an
# interaction taught before its participants are known.
assumed: [{", ".join(assumed)}]

voiceover: "timeline/words.json"
""",
        encoding="utf-8",
    )
    picture = root / "picture.md"
    picture.write_text(_picture(episode_id, resolved), encoding="utf-8")
    beats = root / "storyboard" / "beats.yaml"
    beats.write_text(_beats(resolved), encoding="utf-8")
    shots = root / "shots" / "episode.py"
    shots.write_text(_shots(episode_id, resolved), encoding="utf-8")

    return Scaffold(
        root=root,
        files=(picture, beats, shots, manifest),
        todo=(
            "Record and transcribe the voiceover into timeline/words.json.",
            "Replace every TODO cue with the word its beat lands on.",
            "Write THE ONE PICTURE — the scaffold seeded it from objectives, "
            "but the thesis is the one thing nothing can generate.",
            "Refine the staging. The scaffold is correct and plain; plain is not the goal.",
        ),
    )
