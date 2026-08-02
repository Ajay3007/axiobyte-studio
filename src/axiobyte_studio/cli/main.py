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
from axiobyte_studio.storyboard.episode import Episode
from axiobyte_studio.storyboard.plan import plan, summarise_concepts


def _cmd_plan(args: argparse.Namespace) -> int:
    """Validate an episode without rendering anything."""
    episode = Episode.load(args.episode)
    result = plan(episode)
    print(result.report())
    if args.concepts:
        print("\nconcepts taught, in order:")
        print(summarise_concepts(episode))
    return 0 if result.ok else 1


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
