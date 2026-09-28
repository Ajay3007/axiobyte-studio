"""``abs compose`` — join per-shot clips into the film, then lay the voiceover under it.

Every shot owns a window of the film (:mod:`axiobyte_studio.storyboard.windows`),
and each backend has already rendered the material for its own shots:

* **Three.js** — one clip per shot, exactly its window (``out/shots/<shot>.mp4``).
* **Manim** — the episode's whole generated scene per target; the composer trims
  each Manim shot's window out of it.

Clips are joined by stream copy when every clip shares its codec parameters, and
re-encoded once, uniformly, when they do not — which is the normal case when two
backends meet. The voiceover goes on last, and only if it is the recording the
timeline was transcribed from: the file is local and gitignored, so its hash is
checked against the one pinned in ``episode.yaml``.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

from axiobyte_studio.core.errors import StudioError
from axiobyte_studio.render import cache
from axiobyte_studio.storyboard.episode import Episode
from axiobyte_studio.storyboard.plan import plan, require_ok
from axiobyte_studio.storyboard.windows import ShotWindow, shot_windows

#: What the voiceover is encoded as in the final film.
AUDIO_ARGS = ["-c:a", "aac", "-b:a", "192k", "-ar", "48000"]
#: The uniform encode used when clips from different backends must be re-encoded.
VIDEO_ARGS = ["-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p"]


@dataclass
class ComposeResult:
    """What the composer produced.

    Attributes:
        episode: The episode.
        film: The finished file.
        clips: The clip used for each shot, in narrated order.
        reencoded: Whether clips had to be re-encoded to be joined.
        frames: Frames in the film.
        expected_frames: Frames the shot windows add up to.
        audio: The voiceover laid under it, or ``None``.
    """

    episode: Episode
    film: Path
    clips: list[tuple[ShotWindow, Path]] = field(default_factory=list)
    reencoded: bool = False
    frames: int = 0
    expected_frames: int = 0
    audio: Path | None = None

    def report(self) -> str:
        """Render the outcome for a terminal.

        Returns:
            A multi-line report.
        """
        lines = [f"{self.episode.id}"]
        for window, clip in self.clips:
            lines.append(
                f"  {window.shot.renderer:<7} {window.shot.id:<28} "
                f"{window.start:7.2f} → {window.end:7.2f}s  {clip.name}"
            )
        how = "re-encoded (clips differed)" if self.reencoded else "stream copy"
        sound = f"voiceover {self.audio.name}" if self.audio else "no audio"
        lines += [
            "",
            f"compose: {len(self.clips)} shots, {self.frames} frames, {how}, {sound}",
            f"wrote {self.film}",
        ]
        return "\n".join(lines)


def _tool(name: str) -> str:
    found = shutil.which(name)
    if found is None:
        raise StudioError(f"{name} not found", fix=f"Install ffmpeg, which provides {name}.")
    return found


def _run(argv: list[str]) -> str:
    completed = subprocess.run(argv, capture_output=True, text=True, check=False)
    if completed.returncode != 0:
        tail = (completed.stderr or completed.stdout).strip().splitlines()
        raise StudioError(
            f"{Path(argv[0]).name} failed", context={"error": tail[-1] if tail else "?"}
        )
    return completed.stdout


def _probe(path: Path) -> dict[str, str]:
    """The stream parameters two clips must share to be joined without re-encoding."""
    raw = _run(
        [
            _tool("ffprobe"),
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-count_packets",
            "-show_entries",
            "stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_packets",
            "-of",
            "json",
            str(path),
        ]
    )
    stream = json.loads(raw)["streams"][0]
    return {key: str(value) for key, value in stream.items()}


def verify_audio(episode: Episode, audio: Path | None = None) -> Path:
    """Locate the voiceover and prove it is the recording the timeline came from.

    Args:
        episode: The episode.
        audio: An explicit file, overriding ``episode.yaml``'s ``audio.path``.

    Returns:
        The verified file.

    Raises:
        StudioError: No voiceover is declared or present, or its hash differs
            from the pinned one — a re-recorded take that was never
            re-transcribed would put every cue out of sync.
    """
    path = audio or episode.audio_path
    if path is None:
        raise StudioError(
            f"{episode.id} declares no voiceover audio",
            fix="Add `audio: {path: audio/voiceover.mpeg, sha256: …}` to episode.yaml, "
            "or pass --no-audio.",
        )
    if not path.exists():
        raise StudioError(
            f"Voiceover not found at {path}",
            fix="The recording is a local input and is never committed. Copy it there, "
            "pass --audio <file>, or compose with --no-audio.",
        )
    pinned = str(episode.audio.get("sha256", ""))
    if pinned:
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != pinned:
            raise StudioError(
                f"{path.name} is not the recording {episode.id}'s timeline was transcribed from",
                context={"pinned": pinned[:16], "actual": actual[:16]},
                fix="Re-transcribe (timeline/words.json) and update audio.sha256, or use "
                "the original recording.",
            )
    return path


def _manim_source(episode: Episode, out: Path, target: str) -> Path:
    record = cache.lookup(out, target)
    videos = [p for p in (record.outputs if record else []) if p.suffix == ".mp4"]
    if not videos:
        raise StudioError(
            f"{episode.id}: no Manim render for {target} to take Manim shots from",
            fix=f"Run `abs render {episode.root} --target {target}` first.",
        )
    return videos[0]


def compose_episode(
    episode: Episode,
    *,
    target: str = "16x9",
    fps: int = 30,
    media_dir: Path | None = None,
    film: Path | None = None,
    audio: Path | None = None,
    with_audio: bool = True,
) -> ComposeResult:
    """Assemble an episode's film from its rendered shots.

    Args:
        episode: The episode.
        target: Which format to assemble.
        fps: Frame rate the shots were rendered at.
        media_dir: Where the renders are. Defaults to the episode's ``out/``.
        film: Where to write. Defaults to ``out/<episode id>.mp4``.
        audio: Voiceover file, overriding ``episode.yaml``.
        with_audio: Lay the voiceover under the picture.

    Returns:
        The result.

    Raises:
        StudioError: The plan fails, a shot has not been rendered or is stale,
            the voiceover is missing or not the pinned recording, or ffmpeg fails.
    """
    checked = plan(episode)
    require_ok(checked)
    assert checked.cues is not None  # the plan passed
    out = media_dir or episode.root / "out"
    voiceover = verify_audio(episode, audio) if with_audio else None
    result = ComposeResult(episode=episode, film=film or out / f"{episode.id}.mp4", audio=voiceover)

    windows = shot_windows(episode, checked.cues)
    work = out / "shots"
    work.mkdir(parents=True, exist_ok=True)
    manim_source: Path | None = None
    for window in windows:
        first, last = window.frames(fps)
        result.expected_frames += last - first
        if window.shot.renderer == "three":
            clip = work / f"{window.shot.id}.mp4"
            sidecar = clip.with_suffix(".json")
            meta = json.loads(sidecar.read_text(encoding="utf-8")) if sidecar.exists() else {}
            if not clip.exists() or meta.get("frames") != [first, last]:
                raise StudioError(
                    f"{window.shot.id} has not been rendered for its current window",
                    fix=f"Run `abs render {episode.root}`.",
                )
        elif window.shot.renderer == "manim":
            manim_source = manim_source or _manim_source(episode, out, target)
            clip = work / f"{window.shot.id}.{target}.mp4"
            _run(
                [
                    _tool("ffmpeg"), "-y", "-v", "error",
                    "-ss", repr(first / fps), "-i", str(manim_source),
                    "-frames:v", str(last - first), "-an", *VIDEO_ARGS, str(clip),
                ]
            )  # fmt: skip
        else:
            raise StudioError(f"{window.shot.id}: no composer support for {window.shot.renderer!r}")
        result.clips.append((window, clip))

    params = [_probe(clip) for _, clip in result.clips]
    shape = [{k: v for k, v in p.items() if k != "nb_read_packets"} for p in params]
    result.reencoded = any(s != shape[0] for s in shape)

    listing = work / f".{episode.id}.{target}.concat.txt"
    listing.write_text(
        "".join(f"file '{clip.resolve().as_posix()}'\n" for _, clip in result.clips),
        encoding="utf-8",
    )
    joined = work / f".{episode.id}.{target}.joined.mp4"
    codec = VIDEO_ARGS if result.reencoded else ["-c", "copy"]
    _run(
        [_tool("ffmpeg"), "-y", "-v", "error", "-f", "concat", "-safe", "0",
         "-i", str(listing), "-an", *codec, str(joined)]
    )  # fmt: skip

    result.film.parent.mkdir(parents=True, exist_ok=True)
    if voiceover is not None:
        _run(
            [_tool("ffmpeg"), "-y", "-v", "error", "-i", str(joined), "-i", str(voiceover),
             "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-af", "apad", *AUDIO_ARGS,
             "-shortest", "-movflags", "+faststart", str(result.film)]
        )  # fmt: skip
    else:
        _run(
            [_tool("ffmpeg"), "-y", "-v", "error", "-i", str(joined), "-c", "copy",
             "-movflags", "+faststart", str(result.film)]
        )  # fmt: skip
    joined.unlink(missing_ok=True)
    listing.unlink(missing_ok=True)

    result.frames = int(_probe(result.film)["nb_read_packets"])
    if result.frames != result.expected_frames:
        raise StudioError(
            f"{result.film.name} has {result.frames} frames; its shots add up to "
            f"{result.expected_frames}",
            fix="A clip is stale or was cut on a different frame grid. Re-render with "
            "`abs render --no-cache`.",
        )
    return result
