"""A dependency-free SVG preview of a solved layout.

The reference episodes hand-write ``Still*`` scenes — geometry with no timing — so
a frame can be checked before committing to a render. This generalises that: any
solved layout, in any target, rendered to SVG with no Manim, no Blender, and no
third-party package.

That matters more than it sounds. Layout mistakes are the cheapest class of mistake
to catch and the most expensive to discover after a two-hour render, and this makes
catching them cost milliseconds. It is also how a shot gets reviewed in every format
at once, which is the whole point of having no master aspect ratio.
"""

from __future__ import annotations

from pathlib import Path
from xml.sax.saxutils import escape

from axiobyte_studio.chrome.pinned import all_slots, stage_box
from axiobyte_studio.design.theme import DEFAULT_THEME, Theme, theme
from axiobyte_studio.layout.frame import Box, Target
from axiobyte_studio.layout.solve import SolvedLayout
from axiobyte_studio.typography.style import style


def _rect(box: Box, target: Target, **attrs: str) -> str:
    """One SVG rect, converted from normalised coordinates to design pixels."""
    x, y, w, h = box.to_pixels(target)
    rendered = " ".join(f'{k.replace("_", "-")}="{v}"' for k, v in attrs.items())
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" {rendered}/>'


def _text(
    content: str,
    box: Box,
    target: Target,
    size: float,
    fill: str,
    *,
    family: str = "sans-serif",
    weight: str = "normal",
    dy: float = 0.0,
) -> str:
    """One centred SVG text run."""
    cx, cy = box.center
    x = cx * target.canvas_w
    y = cy * target.canvas_h + size * 0.35 + dy
    return (
        f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size:.0f}" fill="{fill}" '
        f'font-family="{family}" font-weight="{weight}" text-anchor="middle">'
        f"{escape(content)}</text>"
    )


def render(
    layout: SolvedLayout,
    *,
    title: str = "",
    theme_name: str = DEFAULT_THEME,
    roles: dict[str, str] | None = None,
    phase: int = 0,
    show_chrome: bool = True,
) -> str:
    """Render one solved layout to an SVG document.

    Args:
        layout: The layout to preview.
        title: Caption drawn in the corner, usually the shot id.
        theme_name: Which theme supplies the colours.
        roles: Optional slot-to-role mapping, so a preview reads in the episode's
            actual visual language rather than as anonymous boxes.
        phase: Which reveal to draw, for layouts that had to split.
        show_chrome: Whether to draw the pinned keyword and caption bands.

    Returns:
        A complete, self-contained SVG document.
    """
    target = layout.target
    active: Theme = theme(theme_name)
    roles = roles or {}
    parts: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{target.canvas_w}" '
        f'height="{target.canvas_h}" viewBox="0 0 {target.canvas_w} {target.canvas_h}">',
        f'<rect width="100%" height="100%" fill="{active.ground["bg"]}"/>',
    ]

    # The safe area and the stage, drawn faintly — a layout check is largely a
    # question of what is creeping toward an edge.
    parts.append(
        _rect(
            layout.content,
            target,
            fill="none",
            stroke=active.ground["border"],
            stroke_width="2",
            stroke_dasharray="12 10",
        )
    )
    parts.append(
        _rect(
            stage_box(target, layout.platform),
            target,
            fill="none",
            stroke=active.ground["border"],
            stroke_width="1",
            stroke_dasharray="4 8",
            opacity="0.6",
        )
    )

    # Platform occlusion, so a vertical preview shows what the app will cover.
    if layout.platform:
        for occluded in target.occluded(layout.platform):
            parts.append(_rect(occluded, target, fill=active.role("copy").hue, opacity="0.10"))

    label_style = style("row", target)
    mono_style = style("mono_s", target)

    for slot, box in sorted(layout.phases[phase].boxes.items()):
        role = active.role(roles.get(slot, "idle"))
        parts.append(
            _rect(
                box,
                target,
                rx="14",
                fill=role.surface or active.ground["surface"],
                fill_opacity="0.55",
                stroke=role.hue,
                stroke_width="3",
            )
        )
        parts.append(
            _text(
                slot,
                box,
                target,
                label_style.size_px,
                role.hue,
                family=label_style.faces[0],
                weight="bold",
            )
        )

    if show_chrome:
        for chrome in all_slots(target, layout.platform).values():
            chrome_style = style(chrome.rung, target)
            parts.append(
                _rect(
                    chrome.box,
                    target,
                    fill=active.ground["surface"],
                    fill_opacity="0.35",
                    rx="8",
                )
            )
            parts.append(
                _text(
                    chrome.name.upper(),
                    chrome.box,
                    target,
                    chrome_style.size_px * 0.8,
                    active.ink["secondary"],
                    family=chrome_style.faces[0],
                )
            )

    caption = title or layout.target.id
    phase_note = f"  ·  reveal {phase + 1}/{len(layout.phases)}" if layout.is_split else ""
    platform_note = f"  ·  {layout.platform}" if layout.platform else ""
    parts.append(
        f'<text x="24" y="{target.canvas_h - 20}" font-size="{mono_style.size_px}" '
        f'fill="{active.ink["secondary"]}" font-family="{mono_style.faces[0]}">'
        f"{escape(caption)}  ·  {target.id}  ·  {target.canvas_w}x{target.canvas_h}"
        f"{platform_note}{phase_note}</text>"
    )
    parts.append("</svg>")
    return "\n".join(parts)


def write_contact_sheet(
    layouts: dict[str, SolvedLayout],
    directory: str | Path,
    *,
    name: str,
    roles: dict[str, str] | None = None,
    theme_name: str = DEFAULT_THEME,
) -> list[Path]:
    """Write one preview per target, and per reveal where a layout was split.

    Args:
        layouts: Solved layouts, keyed by target id.
        directory: Where to write. Created if missing.
        name: Base filename, usually the shot id.
        roles: Slot-to-role mapping for the episode's visual language.
        theme_name: Which theme to preview in.

    Returns:
        The files written, in a stable order.
    """
    out = Path(directory)
    out.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for target_id, layout in sorted(layouts.items()):
        for index in range(len(layout.phases)):
            suffix = f"-{index + 1}" if layout.is_split else ""
            path = out / f"{name}.{target_id}{suffix}.svg"
            path.write_text(
                render(layout, title=name, theme_name=theme_name, roles=roles, phase=index),
                encoding="utf-8",
            )
            written.append(path)
    return written
