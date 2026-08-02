"""The contact sheet — one page showing the whole episode, before anything animates.

*Animation should never be created before the storyboard exists.* This is the
artifact that makes that rule enforceable rather than aspirational: every beat, at
its real time in the narration, with the concept it teaches and the misconception it
destroys, on one page you can look at in ten seconds.

It is deliberately dependency-free SVG. A review document that needs a render
pipeline to produce is a review document that gets skipped.

**A note on colour.** This is a production document, not a frame a viewer sees, so
it does not spend the visual language on itself. Atomic concepts show their own
role because they have one; interactions show their participants as dots in *their*
roles, which is both honest and more informative than inventing a hue for a
relationship that owns none.
"""

from __future__ import annotations

from pathlib import Path
from xml.sax.saxutils import escape

from axiobyte_studio.concepts.base import ConceptKind, InteractionConcept
from axiobyte_studio.concepts.registry import ConceptRegistry, registry
from axiobyte_studio.design.theme import DEFAULT_THEME, Theme, theme, visual_language
from axiobyte_studio.storyboard.episode import Episode
from axiobyte_studio.timeline.cues import CueTable

_W = 1400
_ROW = 96
_MARGIN = 48
_HEAD = 150


def _role_hue(concept_id: str, sdk: ConceptRegistry, active: Theme) -> str | None:
    """The hue an atomic concept owns, or ``None`` for anything that owns no role."""
    if concept_id in sdk and sdk.get(concept_id).kind is ConceptKind.ATOMIC:
        try:
            return active.role(visual_language().concept(concept_id).role).hue
        except Exception:
            return None
    return None


def render(
    episode: Episode,
    cues: CueTable | None = None,
    *,
    theme_name: str = DEFAULT_THEME,
    concepts: ConceptRegistry | None = None,
) -> str:
    """Render an episode's beats to a one-page SVG board.

    Args:
        episode: The episode to board.
        cues: Resolved cues, so each beat can show its real time. When omitted,
            times are left blank rather than guessed.
        theme_name: Which theme to draw in.
        concepts: The concept SDK. Defaults to the shipped registry.

    Returns:
        A complete, self-contained SVG document.
    """
    sdk = concepts or registry()
    active = theme(theme_name)
    beatmap = episode.beatmap
    beats = beatmap.beats if beatmap else []
    height = _HEAD + len(beats) * _ROW + (len(beatmap.acts) if beatmap else 0) * 46 + _MARGIN

    out: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{_W}" height="{height}" '
        f'viewBox="0 0 {_W} {height}">',
        f'<rect width="100%" height="100%" fill="{active.ground["bg"]}"/>',
    ]

    def text(
        content: str,
        x: float,
        y: float,
        size: int,
        fill: str,
        *,
        mono: bool = False,
        bold: str = "",
    ) -> None:
        family = "ui-monospace, monospace" if mono else "system-ui, sans-serif"
        weight = f' font-weight="{bold}"' if bold else ""
        out.append(
            f'<text x="{x:.0f}" y="{y:.0f}" font-size="{size}" fill="{fill}" '
            f'font-family="{family}"{weight}>{escape(content)}</text>'
        )

    # -- header: the thesis, because the board exists to serve it ------------
    text(episode.id, _MARGIN, 52, 30, active.ink["primary"], bold="600")
    text(episode.title, _MARGIN + 320, 52, 20, active.ink["secondary"])
    if episode.picture:
        thesis = episode.picture.thesis.splitlines()[0]
        text(f"“{thesis}”", _MARGIN, 88, 22, active.role("pointer").hue)
    text(
        f"{len(beats)} beats · {len(episode.concepts)} concepts · "
        f"{episode.duration:.1f}s · {', '.join(episode.targets)}",
        _MARGIN,
        118,
        16,
        active.ink["secondary"],
        mono=True,
    )
    out.append(
        f'<line x1="{_MARGIN}" y1="132" x2="{_W - _MARGIN}" y2="132" '
        f'stroke="{active.ground["border"]}" stroke-width="1"/>'
    )

    y = _HEAD
    for act in beatmap.acts if beatmap else []:
        y += 34
        text(
            (act.keyword or act.id).upper(),
            _MARGIN,
            y,
            18,
            active.ink["primary"],
            bold="600",
        )
        if act.title:
            text(act.title, _MARGIN + 300, y, 16, active.ink["secondary"])
        y += 12

        for beat in act.beats:
            card_y = y
            out.append(
                f'<rect x="{_MARGIN}" y="{card_y}" width="{_W - 2 * _MARGIN}" '
                f'height="{_ROW - 14}" rx="8" fill="{active.ground["surface"]}" '
                f'stroke="{active.ground["border"]}" stroke-width="1"/>'
            )
            when = f"{cues[beat.id]:7.2f}s" if cues and beat.id in cues else "   —   "
            text(when, _MARGIN + 16, card_y + 32, 18, active.ink["primary"], mono=True)
            text(beat.id, _MARGIN + 120, card_y + 32, 17, active.ink["primary"], mono=True)
            text(
                f"“{beat.cue}”", _MARGIN + 120, card_y + 58, 14, active.ink["secondary"], mono=True
            )

            if beat.concept:
                cx = _MARGIN + 470
                hue = _role_hue(beat.concept, sdk, active) or active.ink["primary"]
                text(beat.concept, cx, card_y + 32, 17, hue, mono=True, bold="600")
                if beat.concept in sdk:
                    concept = sdk.get(beat.concept)
                    text(
                        concept.kind.value,
                        cx,
                        card_y + 58,
                        13,
                        active.ink["secondary"],
                        mono=True,
                    )
                    # An interaction owns no hue, so it shows its participants'.
                    if isinstance(concept, InteractionConcept):
                        for index, participant in enumerate(concept.between):
                            dot = _role_hue(participant, sdk, active) or active.ink["secondary"]
                            out.append(
                                f'<circle cx="{cx + 96 + index * 22}" cy="{card_y + 53}" '
                                f'r="6" fill="{dot}"/>'
                            )

            marks = []
            if beat.objective:
                marks.append(f"↳ {beat.objective}")
            if beat.refutes:
                marks.append(f"✗ {beat.refutes}")
            if marks:
                text(
                    "   ".join(marks),
                    _MARGIN + 760,
                    card_y + 32,
                    14,
                    active.role("nic").hue if beat.refutes else active.ink["secondary"],
                    mono=True,
                )
            if beat.intent:
                text(beat.intent, _MARGIN + 760, card_y + 58, 14, active.ink["secondary"])
            y += _ROW

    out.append("</svg>")
    return "\n".join(out)


def write(
    episode: Episode,
    cues: CueTable | None = None,
    *,
    path: str | Path | None = None,
    theme_name: str = DEFAULT_THEME,
) -> Path:
    """Write the board next to the episode's storyboard.

    Args:
        episode: The episode to board.
        cues: Resolved cues, so beats show their real times.
        path: Where to write. Defaults to ``storyboard/board.svg``.
        theme_name: Which theme to draw in.

    Returns:
        The file written.
    """
    destination = Path(path) if path else episode.root / "storyboard" / "board.svg"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(render(episode, cues, theme_name=theme_name), encoding="utf-8")
    return destination
