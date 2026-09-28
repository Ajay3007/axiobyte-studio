"""The render pipeline — plan, then render, and never the other way round.

One rule governs this module:

> **Nothing renders until ``abs plan`` passes.**

Not as advice. :func:`render_episode` runs the cascade itself and refuses on any
error, so there is no path to a frame that skipped validation. A wrong
visualization should cost seconds of planning, not an hour of rendering followed by
a viewer noticing.

Each target renders in its own subprocess, because Manim's ``config`` is
process-global: two aspect ratios in one process would fight over the same canvas.

Renderers are chosen per shot (ARCHITECTURE.md §8.0a). An episode whose shots are
all Manim renders exactly as it always has: one generated scene per target. Any
other episode is rendered shot by shot — each backend produces raw material for
the shots it owns (Manim its whole scene, Three.js one clip per shot window) —
and ``abs compose`` assembles the film from it.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

from axiobyte_studio.backends.three import ThreeShotJob
from axiobyte_studio.core.errors import StudioError
from axiobyte_studio.render import cache
from axiobyte_studio.storyboard.episode import Episode
from axiobyte_studio.storyboard.plan import Plan, plan, require_ok
from axiobyte_studio.storyboard.windows import shot_windows

#: Formats the Three.js backend can render today: its overlay is laid out in
#: absolute 1920x1080 pixels.
THREE_TARGETS = frozenset({"16x9"})

#: Draft first. A quality flag is the one place guessing is cheap.
QUALITY = {"draft": "-ql", "medium": "-qm", "high": "-qh", "production": "-qk"}

#: What counts as a deliverable. Manim also writes cached text SVGs and partial
#: movie fragments into the same tree; those are working files, not output.
MEDIA_SUFFIXES = frozenset({".png", ".mp4", ".mov", ".gif", ".webm"})


@dataclass(frozen=True, slots=True)
class RenderJob:
    """One target, one scene, one subprocess.

    Attributes:
        target: Which format profile.
        scene: The scene class to render.
        module: The file it lives in.
        quality: Which quality preset.
        still: Render a single frame rather than video.
    """

    target: str
    scene: str
    module: Path
    quality: str = "draft"
    still: bool = False

    def command(self, media_dir: Path, fps: int) -> list[str]:
        """The Manim invocation for this job.

        Args:
            media_dir: Where Manim should write.
            fps: Frame rate.

        Returns:
            The argv to run.
        """
        # The interpreter running us is the one with the Studio installed, so its
        # own manim is the right one. Falling back to PATH first would pick up a
        # system install that may not share this environment at all.
        #
        # `which` rather than a bare `.exists()`, because the executable is
        # `bin/manim` on POSIX and `Scripts/manim.exe` on Windows. Testing the
        # extensionless path finds nothing on Windows and silently hands the
        # render to whatever PATH offers — the exact failure this prefers to avoid.
        scripts = Path(sys.executable).parent
        local = shutil.which("manim", path=str(scripts))
        manim = local or shutil.which("manim") or "manim"
        argv = [manim, QUALITY[self.quality]]
        if self.still:
            argv += ["-s", "--format=png"]
        else:
            argv += ["--fps", str(fps)]
        argv += ["--media_dir", str(media_dir), str(self.module), self.scene]
        return argv


@dataclass
class RenderResult:
    """What a render produced, or why it did not.

    Attributes:
        plan: The cascade that gated it.
        jobs: The jobs that were run.
        outputs: Files produced, per target.
        failures: Targets that failed, with the tail of their output.
        cached: Targets served from a previous identical render, by digest.
        shot_jobs: Per-shot jobs for backends that render shot windows.
        shots: The clip each of those shots produced.
        shot_failures: Shots that failed, with the reason.
        cached_shots: Shots served from a previous identical render.
    """

    plan: Plan
    jobs: list[RenderJob] = field(default_factory=list)
    outputs: dict[str, list[Path]] = field(default_factory=dict)
    failures: dict[str, str] = field(default_factory=dict)
    cached: dict[str, str] = field(default_factory=dict)
    shot_jobs: list[ThreeShotJob] = field(default_factory=list)
    shots: dict[str, Path] = field(default_factory=dict)
    shot_failures: dict[str, str] = field(default_factory=dict)
    cached_shots: set[str] = field(default_factory=set)

    @property
    def ok(self) -> bool:
        """Whether every target and every shot rendered."""
        return not self.failures and not self.shot_failures

    def report(self) -> str:
        """Render the outcome for a terminal.

        Returns:
            A multi-line report.
        """
        lines = [f"{self.plan.episode.id}"]
        for job in self.jobs:
            produced = self.outputs.get(job.target, [])
            if job.target in self.failures:
                lines.append(f"  FAIL  {job.target:<8} {self.failures[job.target]}")
            elif job.target in self.cached:
                where = produced[0].parent if produced else "?"
                lines.append(f"  cached {job.target:<7} {job.scene}  →  {where}")
            else:
                where = produced[0].parent if produced else "?"
                lines.append(f"  ok    {job.target:<8} {job.scene}  →  {where}")
        for shot_job in self.shot_jobs:
            shot = shot_job.window.shot
            where = self.shots.get(shot.id, shot_job.out)
            span = f"{shot_job.window.start:7.2f} → {shot_job.window.end:7.2f}s"
            if shot.id in self.shot_failures:
                lines.append(f"  FAIL  {shot.renderer:<8} {shot.id}  {self.shot_failures[shot.id]}")
            elif shot.id in self.cached_shots:
                lines.append(f"  cached {shot.renderer:<7} {shot.id:<28} {span}  →  {where}")
            else:
                lines.append(f"  ok    {shot.renderer:<8} {shot.id:<28} {span}  →  {where}")
        lines.append("")
        reused = len(self.cached) + len(self.cached_shots)
        failed = len(self.failures) + len(self.shot_failures)
        rendered = len(self.jobs) + len(self.shot_jobs) - failed - reused
        summary = f"render: {rendered} rendered, {reused} cached"
        if failed:
            summary += f", {failed} failed — see output above"
        lines.append(summary)
        if self.shot_jobs and self.ok:
            lines.append(f"next: abs compose {self.plan.episode.root}")
        return "\n".join(lines)


def scene_module(episode: Episode) -> Path:
    """Locate an episode's scene module.

    Args:
        episode: The episode.

    Returns:
        The module path.

    Raises:
        StudioError: The episode has no shots module.
    """
    candidate = episode.root / "shots" / "episode.py"
    if not candidate.exists():
        raise StudioError(
            f"{episode.id} has no shots module",
            context={"expected": str(candidate)},
            fix="Add shots/episode.py defining a StudioScene subclass per target.",
        )
    return candidate


def scene_name(target: str) -> str:
    """The scene class name generated for a target.

    Args:
        target: A target profile id, e.g. ``"9x16"``.

    Returns:
        The class name, e.g. ``"Episode9x16"``.
    """
    from axiobyte_studio.backends.manim.episode_scene import scene_class_name

    return scene_class_name(target)


def verify_staging(episode: Episode) -> list[str]:
    """Check the shots module actually provides staging for every shot.

    The plan's coverage step verifies the *storyboard* is complete — every teaching
    beat belongs to a shot. It cannot verify the *code* is, because it must not
    import a renderer. This can, and it is the check that bites: a derived shot list
    covers every beat by construction, so a whole act can be planned, cued and
    silently never drawn.

    Args:
        episode: The episode to check.

    Returns:
        The names of staging functions the shots module does not expose.

    Raises:
        StudioError: The module cannot be imported.
    """
    import importlib.util

    if episode.shotlist is None:
        return []
    module_path = scene_module(episode)
    spec = importlib.util.spec_from_file_location(f"_shots_{episode.id}", module_path)
    if spec is None or spec.loader is None:
        raise StudioError(f"Cannot import {module_path}")
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
    except Exception as exc:
        raise StudioError(
            f"{module_path.name} could not be imported",
            context={"error": f"{type(exc).__name__}: {exc}"},
        ) from exc
    return [
        shot.stage_function
        for shot in episode.shotlist.by_renderer("manim")
        if not hasattr(module, shot.stage_function)
    ]


def available_scenes(episode: Episode) -> list[str]:
    """Every format this episode can render, whether or not it declares them.

    An episode's ``targets:`` decides what a plain ``abs render`` produces. This is
    what is *possible* — and the two differing is the point: a format the episode
    never mentioned still costs nothing.

    Args:
        episode: The episode.

    Returns:
        Target ids, sorted.
    """
    from axiobyte_studio.layout.frame import available_targets

    return available_targets()


def render_episode(
    episode: Episode,
    *,
    targets: list[str] | None = None,
    quality: str = "draft",
    fps: int = 30,
    still: bool = False,
    media_dir: Path | None = None,
    dry_run: bool = False,
    use_cache: bool = True,
    headless: bool = False,
    shots: list[str] | None = None,
) -> RenderResult:
    """Validate an episode, then render every declared target.

    Args:
        episode: The episode to render.
        targets: Which formats. Defaults to everything the episode declares.
        quality: One of ``draft``, ``medium``, ``high``, ``production``.
        fps: Frame rate for video.
        still: Render one frame per target instead of video.
        media_dir: Where to write. Defaults to the episode's ``out/``.
        dry_run: Plan and build the jobs, but run nothing.
        use_cache: Reuse a previous render when nothing that affects the output
            has changed. Conservative — a needless render costs minutes, a wrongly
            reused one costs trust.
        headless: For the Three.js backend: run Chrome without a window.
        shots: Render only shots whose id contains one of these (e.g. ``"0120"``).
            Applies to per-shot backends; a Manim scene always renders whole.

    Returns:
        The result, whose ``ok`` says whether every target succeeded.

    Raises:
        StudioError: The plan failed, or the quality preset is unknown. Nothing is
            rendered in either case.
    """
    if quality not in QUALITY:
        raise StudioError(
            f"Unknown quality {quality!r}",
            context={"available": ", ".join(QUALITY)},
            fix="Draft first; it is the only quality worth guessing at.",
        )

    # THE GATE. There is no path past this that reaches a frame.
    checked = plan(episode)
    require_ok(checked)

    if episode.shotlist and set(episode.shotlist.renderers) != {"manim"}:
        return _render_shots(
            episode,
            checked,
            targets=targets,
            quality=quality,
            fps=fps,
            still=still,
            media_dir=media_dir,
            dry_run=dry_run,
            use_cache=use_cache,
            headless=headless,
            only=shots,
        )

    module = scene_module(episode)
    missing = verify_staging(episode)
    if missing:
        raise StudioError(
            f"{episode.id}: {len(missing)} shot(s) have no staging: {', '.join(missing)}",
            context={"module": str(module)},
            fix=(
                "The storyboard declares these shots and the plan passed, but nothing "
                "draws them. Define each function in the shots module, or remove the "
                "act from beats.yaml. An act that is cued and never drawn is the "
                "quietest way for an episode to be wrong."
            ),
        )
    out = media_dir or episode.root / "out"
    result = RenderResult(plan=checked)

    for target in targets or list(episode.targets):
        result.jobs.append(
            RenderJob(
                target=target,
                scene=scene_name(target),
                module=module,
                quality=quality,
                still=still,
            )
        )

    if dry_run:
        return result

    out.mkdir(parents=True, exist_ok=True)
    for job in result.jobs:
        _run_manim(
            job, episode, out, result, quality=quality, still=still, fps=fps, use_cache=use_cache
        )
    return result


def _run_manim(
    job: RenderJob,
    episode: Episode,
    out: Path,
    result: RenderResult,
    *,
    quality: str,
    still: bool,
    fps: int,
    use_cache: bool,
) -> None:
    """Run one Manim target job, or reuse an identical previous render."""
    print_ = cache.fingerprint(episode, job.target, quality=quality, still=still)
    previous = cache.lookup(out, job.target)
    reusable = (
        use_cache and previous is not None and previous.intact and previous.digest == print_.digest
    )
    if reusable and previous is not None:
        result.cached[job.target] = print_.digest
        result.outputs[job.target] = list(previous.outputs)
        return

    completed = subprocess.run(
        job.command(out, fps),
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        tail = (completed.stderr or completed.stdout).strip().splitlines()
        result.failures[job.target] = tail[-1] if tail else "manim exited non-zero"
        return

    # Manim decorates filenames with its own version, so match on the prefix
    # and filter to real deliverables rather than its working files.
    produced = sorted(
        path
        for path in out.rglob(f"{job.scene}*")
        if path.suffix in MEDIA_SUFFIXES and "partial_movie_files" not in path.parts
    )
    # Manim exits 0 even when it rendered nothing — "There are no scenes inside
    # that module" is an ERROR log and a clean exit. Trusting the exit code
    # alone reports success for an empty render, which is the quietest possible
    # failure. A render that produced no file did not succeed.
    if not produced:
        result.failures[job.target] = (
            f"produced no output — manim found no scene named {job.scene!r}"
        )
        return
    result.outputs[job.target] = produced
    cache.record(
        out,
        job.target,
        print_,
        produced,
        episode_id=episode.id,
        scene=job.scene,
    )


def _render_shots(
    episode: Episode,
    checked: Plan,
    *,
    targets: list[str] | None,
    quality: str,
    fps: int,
    still: bool,
    media_dir: Path | None,
    dry_run: bool,
    use_cache: bool,
    headless: bool,
    only: list[str] | None = None,
) -> RenderResult:
    """Render an episode shot by shot, each on the backend its shot names.

    Manim shots come from the episode's generated scene, rendered whole per target
    (the composer trims each Manim shot's window out of it). Three.js shots render
    one clip per window. Nothing here joins them — that is ``abs compose``.
    """
    assert episode.shotlist is not None and checked.cues is not None  # the plan passed
    wanted = targets or list(episode.targets)
    three = episode.shotlist.by_renderer("three")
    unsupported = sorted(set(wanted) - THREE_TARGETS) if three else []
    if unsupported:
        raise StudioError(
            f"{episode.id}: the Three.js backend cannot render {', '.join(unsupported)} yet",
            context={"three.js shots": str(len(three))},
            fix="Render --target 16x9, or re-stage those shots in Manim (it lays out per target).",
        )

    out = media_dir or episode.root / "out"
    result = RenderResult(plan=checked)
    windows = shot_windows(episode, checked.cues)

    if episode.shotlist.by_renderer("manim"):
        missing = verify_staging(episode)
        if missing:
            raise StudioError(
                f"{episode.id}: {len(missing)} Manim shot(s) have no staging: {', '.join(missing)}",
                fix="Define each function in shots/episode.py, or render the shot with three.",
            )
        module = scene_module(episode)
        for target in wanted:
            result.jobs.append(
                RenderJob(
                    target=target,
                    scene=scene_name(target),
                    module=module,
                    quality=quality,
                    still=still,
                )
            )

    for window in windows:
        if only and not any(key in window.shot.id for key in only):
            continue
        if window.shot.renderer == "three":
            clip = out / "shots" / f"{window.shot.id}.mp4"
            result.shot_jobs.append(
                ThreeShotJob(episode.root, window, clip, fps=fps, headless=headless, still=still)
            )

    if dry_run:
        return result

    out.mkdir(parents=True, exist_ok=True)
    for job in result.jobs:
        _run_manim(
            job, episode, out, result, quality=quality, still=still, fps=fps, use_cache=use_cache
        )
    for shot_job in result.shot_jobs:
        _run_three(shot_job, result, use_cache=use_cache)
    return result


def _run_three(job: ThreeShotJob, result: RenderResult, *, use_cache: bool) -> None:
    """Render one Three.js shot, or reuse an identical previous clip."""
    shot_id = job.window.shot.id
    sidecar = job.out.with_suffix(".json")
    digest = job.fingerprint()
    if job.still:
        completed = subprocess.run(job.command(), check=False)
        if completed.returncode != 0:
            result.shot_failures[shot_id] = "three.js still failed — see output above"
        else:
            result.shots[shot_id] = job.episode_root / "out" / "stills"
        return
    if (
        use_cache
        and job.out.exists()
        and sidecar.exists()
        and json.loads(sidecar.read_text(encoding="utf-8")).get("digest") == digest
    ):
        result.cached_shots.add(shot_id)
        result.shots[shot_id] = job.out
        return
    job.out.parent.mkdir(parents=True, exist_ok=True)
    # Not captured: a Three.js render reports frame progress, and a shot can
    # take minutes. The exit code and the file on disk decide success.
    completed = subprocess.run(job.command(), check=False)
    if completed.returncode != 0 or not job.out.exists():
        result.shot_failures[shot_id] = "three.js render failed — see output above"
        return
    first, last = job.window.frames(job.fps)
    sidecar.write_text(
        json.dumps(
            {
                "shot": shot_id,
                "renderer": "three",
                "digest": digest,
                "frames": [first, last],
                "fps": job.fps,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    result.shots[shot_id] = job.out
