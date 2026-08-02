"""``abs`` — one command, verb-first and discoverable.

Every subcommand is idempotent, and every one that could take more than a moment
says where it is writing. ``plan`` renders nothing at all, which is the point: it is
the gate that runs before a frame is drawn.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from axiobyte_studio import __version__
from axiobyte_studio.concepts.base import ConceptKind, InteractionConcept
from axiobyte_studio.concepts.registry import registry
from axiobyte_studio.core.errors import StudioError
from axiobyte_studio.layout.frame import available_targets
from axiobyte_studio.render.jobs import QUALITY, render_episode
from axiobyte_studio.storyboard import contact_sheet
from axiobyte_studio.storyboard.episode import Episode
from axiobyte_studio.storyboard.plan import plan, summarise_concepts
from axiobyte_studio.timeline.drift import compare
from axiobyte_studio.timeline.timeline import Timeline


def _cmd_plan(args: argparse.Namespace) -> int:
    """Validate an episode without rendering anything."""
    episode = Episode.load(args.episode)
    result = plan(episode)
    print(result.report())
    if args.concepts:
        print("\nconcepts taught, in order:")
        print(summarise_concepts(episode))
    return 0 if result.ok else 1


def _cmd_render(args: argparse.Namespace) -> int:
    """Validate, then render. The plan runs first and refuses on any error."""
    episode = Episode.load(args.episode)
    result = render_episode(
        episode,
        targets=args.target or None,
        quality=args.quality,
        fps=args.fps,
        still=args.still,
        dry_run=args.dry_run,
    )
    if args.dry_run:
        print(f"{episode.id}: plan passed; {len(result.jobs)} job(s) would run")
        for job in result.jobs:
            print(f"  {job.target:<8} {job.scene}  {' '.join(job.command(Path('out'), args.fps))}")
        return 0
    print(result.report())
    return 0 if result.ok else 1


def _cmd_sheet(args: argparse.Namespace) -> int:
    """Write the contact sheet — the board you approve before animating."""
    episode = Episode.load(args.episode)
    result = plan(episode)
    path = contact_sheet.write(episode, result.cues)
    beats = len(episode.beatmap.beats) if episode.beatmap else 0
    print(f"wrote {path}  ({beats} beats)")
    if not result.ok:
        print(f"  note: the plan has {len(result.errors)} error(s); run `abs plan` for detail")
    return 0


def _cmd_drift(args: argparse.Namespace) -> int:
    """Report what a re-cut voiceover did to an episode's beats."""
    episode = Episode.load(args.episode)
    if episode.beatmap is None or episode.timeline is None:
        print("episode has no beat map or no voiceover", file=sys.stderr)
        return 1
    drift = compare(
        episode.beatmap.cues,
        Timeline.load(args.since),
        episode.timeline,
        tolerance=args.tolerance,
    )
    print(drift.report(verbose=args.verbose))
    return 0 if drift.ok else 1


def _cmd_concept_list(args: argparse.Namespace) -> int:
    """List the SDK, by kind."""
    sdk = registry()
    kinds = [ConceptKind(args.kind)] if args.kind else list(ConceptKind)
    for kind in kinds:
        concepts = sdk.of_kind(kind)
        print(f"\n{kind.value}  ({len(concepts)})")
        for concept in concepts:
            detail = ""
            if isinstance(concept, InteractionConcept):
                detail = f"  ⟷ {', '.join(concept.between)}"
            print(f"  {concept.id:<22}{concept.title or ''}{detail}")
    return 0


def _cmd_concept_show(args: argparse.Namespace) -> int:
    """Show one concept in full."""
    concept = registry().get(args.id)
    print(f"{concept.id}  [{concept.kind.value}]  v{concept.version}")
    if concept.title:
        print(f"  {concept.title}")
    if isinstance(concept, InteractionConcept):
        print(f"\n  between: {', '.join(concept.between)}")
        print("  removal test:")
        for participant, residue in concept.removal_test.items():
            print(f"    without {participant}: {residue}")
    if concept.objectives:
        print("\n  objectives:")
        for objective in concept.objectives:
            print(f"    {objective.id}  {objective.statement}")
    if concept.misconceptions:
        print("\n  misconceptions destroyed:")
        for misconception in concept.misconceptions:
            mark = " (draft — no source)" if misconception.is_draft else ""
            print(f"    {misconception.id}  “{misconception.wrong}”{mark}")
    if concept.requires:
        print(f"\n  requires: {', '.join(concept.requires)}")
    if concept.contrasts_with:
        print(f"  defined against: {', '.join(concept.contrasts_with)}")
    return 0


def _cmd_concept_stats(args: argparse.Namespace) -> int:
    """Report the shape of the SDK."""
    stats = registry().stats()
    print(f"concepts: {stats['total']}")
    for kind, count in sorted(stats["by_kind"].items()):
        print(f"  {kind:<12} {count}")
    ratio = stats["interaction_ratio"]
    verdict = "healthy" if stats["healthy"] else "TOO MANY — see CONCEPT-ARCHITECTURE.md §5.5"
    print(f"\ninteraction ratio: {ratio}  ({verdict})")
    return 0


def _cmd_targets(args: argparse.Namespace) -> int:
    """List the formats the Studio can render."""
    from axiobyte_studio.layout.frame import target as load

    for name in available_targets():
        profile = load(name)
        print(
            f"  {profile.id:<8} {profile.canvas_w}x{profile.canvas_h}"
            f"  density {profile.density_budget}"
            f"  chain runs {profile.axis_for('chain')}"
        )
    return 0


def build_parser() -> argparse.ArgumentParser:
    """Build the argument parser.

    Returns:
        The configured parser.
    """
    parser = argparse.ArgumentParser(
        prog="abs",
        description="AxioByte Studio — a systems visualization framework.",
    )
    parser.add_argument("--version", action="version", version=f"axiobyte-studio {__version__}")
    sub = parser.add_subparsers(dest="command", required=True)

    plan_cmd = sub.add_parser("plan", help="validate an episode; render nothing")
    plan_cmd.add_argument("episode", type=Path)
    plan_cmd.add_argument(
        "--concepts", action="store_true", help="also list what the episode teaches"
    )
    plan_cmd.set_defaults(func=_cmd_plan)

    render_cmd = sub.add_parser("render", help="validate, then render every target")
    render_cmd.add_argument("episode", type=Path)
    render_cmd.add_argument("--target", action="append", help="render only this target")
    render_cmd.add_argument("--quality", default="draft", choices=sorted(QUALITY))
    render_cmd.add_argument("--fps", type=int, default=30)
    render_cmd.add_argument("--still", action="store_true", help="one frame per target")
    render_cmd.add_argument("--dry-run", action="store_true", help="plan and show the jobs")
    render_cmd.set_defaults(func=_cmd_render)

    sheet_cmd = sub.add_parser("storyboard", help="storyboard tools")
    sheet_sub = sheet_cmd.add_subparsers(dest="subcommand", required=True)
    board_cmd = sheet_sub.add_parser("sheet", help="write the one-page contact sheet")
    board_cmd.add_argument("episode", type=Path)
    board_cmd.set_defaults(func=_cmd_sheet)

    timeline_cmd = sub.add_parser("timeline", help="voiceover tools")
    timeline_sub = timeline_cmd.add_subparsers(dest="subcommand", required=True)
    drift_cmd = timeline_sub.add_parser(
        "drift", help="what a re-cut voiceover did to this episode's beats"
    )
    drift_cmd.add_argument("episode", type=Path)
    drift_cmd.add_argument("--since", type=Path, required=True, help="the previous words.json")
    drift_cmd.add_argument("--tolerance", type=float, default=0.05)
    drift_cmd.add_argument("--verbose", action="store_true", help="also show cues that held")
    drift_cmd.set_defaults(func=_cmd_drift)

    concept_cmd = sub.add_parser("concept", help="inspect the concept SDK")
    concept_sub = concept_cmd.add_subparsers(dest="subcommand", required=True)

    list_cmd = concept_sub.add_parser("list", help="list concepts")
    list_cmd.add_argument("--kind", choices=[k.value for k in ConceptKind])
    list_cmd.set_defaults(func=_cmd_concept_list)

    show_cmd = concept_sub.add_parser("show", help="show one concept in full")
    show_cmd.add_argument("id")
    show_cmd.set_defaults(func=_cmd_concept_show)

    stats_cmd = concept_sub.add_parser("stats", help="report the shape of the SDK")
    stats_cmd.set_defaults(func=_cmd_concept_stats)

    targets_cmd = sub.add_parser("targets", help="list the formats the Studio renders")
    targets_cmd.set_defaults(func=_cmd_targets)
    return parser


def main(argv: list[str] | None = None) -> int:
    """Run the CLI.

    Args:
        argv: Arguments, defaulting to ``sys.argv``.

    Returns:
        A process exit code.
    """
    args = build_parser().parse_args(argv)
    try:
        code: int = args.func(args)
        return code
    except StudioError as exc:
        print(f"\n{exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
