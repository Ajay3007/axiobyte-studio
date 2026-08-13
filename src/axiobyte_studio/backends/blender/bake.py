"""Tier-2 3D — baking hero hardware once, so episodes replay it for free.

The tier most people skip, and the one with the best return. A hero hardware shot
does not need interactivity; it needs **one beautiful camera move, rendered once,
and reused for five years**. So a NIC board with a turntable becomes an *asset*:
versioned, hashed, dropped into any episode by any actor, at zero render cost.

The Studio side never imports ``bpy``. It builds a spec, runs Blender headless
against a script, and records what came out. That keeps Blender a build-time
dependency rather than a runtime one — episodes render without it installed.

Four requirements, each of which ``ep02/nic_3d.png`` missed:

1. **Transparent background.** RGBA, never a white plate.
2. **Lit from the token palette.** The PCB green is ``color.nic``. A plate lit to
   its own taste always reads as pasted on.
3. **A canonical camera move**, shared across the catalogue, so hardware behaves
   consistently wherever it appears.
4. **A manifest**, so a plate can be re-baked identically in three years.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from dataclasses import asdict, dataclass, field
from pathlib import Path

from axiobyte_studio.core.errors import StudioError
from axiobyte_studio.design.theme import DEFAULT_THEME, theme

_SCRIPT = Path(__file__).parent / "scripts" / "bake_plate.py"

#: Where Blender lives on macOS when installed as an app bundle.
_MAC_BLENDER = Path("/Applications/Blender.app/Contents/MacOS/Blender")

#: Where the Windows installer puts Blender. It adds nothing to PATH and the
#: directory carries the version, so the only way to find it is to look.
_WINDOWS_BLENDER_ROOTS = (
    Path("C:/Program Files/Blender Foundation"),
    Path("C:/Program Files (x86)/Blender Foundation"),
)


def _windows_blenders() -> list[Path]:
    """Every Blender the Windows installer left under Program Files.

    Returns:
        Executables, highest version directory first. Empty off Windows.
    """
    found = [
        exe
        for root in _WINDOWS_BLENDER_ROOTS
        if root.is_dir()
        for exe in root.glob("Blender*/blender.exe")
    ]
    return sorted(found, key=lambda exe: exe.parent.name, reverse=True)


#: Camera moves the catalogue shares. Hardware behaves the same wherever it
#: appears, which is half of what makes a catalogue look like one catalogue.
MOVES = ("still", "turntable", "push_in")


def blender_binary() -> Path:
    """Locate Blender.

    Returns:
        The executable.

    Raises:
        StudioError: Blender is not installed. Baking needs it; *rendering* does
            not, because a baked plate is just an image sequence.
    """
    found = shutil.which("blender")
    if found:
        return Path(found)
    if _MAC_BLENDER.exists():
        return _MAC_BLENDER
    installed = _windows_blenders()
    if installed:
        return installed[0]
    roots = ", ".join(str(root) for root in _WINDOWS_BLENDER_ROOTS)
    raise StudioError(
        "Blender is not installed",
        context={"looked in": f"PATH, {_MAC_BLENDER}, {roots}"},
        fix=(
            "Install Blender to bake plates. Episodes that only *use* already-baked "
            "plates do not need it — that is the point of baking."
        ),
    )


@dataclass(frozen=True, slots=True)
class PlateSpec:
    """What to bake, and how.

    Attributes:
        asset: Which parametric asset, e.g. ``"nic_board"``.
        move: One of :data:`MOVES`.
        frames: How many frames. One for a still.
        width: Output width in pixels.
        height: Output height in pixels.
        distance: Camera distance from the origin.
        elevation: Camera elevation in degrees.
        azimuth: Camera azimuth in degrees, for moves that hold it.
        theme_name: Which theme's palette lights and colours it.
    """

    asset: str
    move: str = "turntable"
    frames: int = 24
    width: int = 960
    height: int = 540
    distance: float = 7.2
    elevation: float = 30.0
    azimuth: float = 35.0
    theme_name: str = DEFAULT_THEME

    def __post_init__(self) -> None:
        """Refuse a spec that cannot produce a plate."""
        if self.move not in MOVES:
            raise StudioError(
                f"Unknown camera move {self.move!r}",
                context={"available": ", ".join(MOVES)},
                fix="Moves are shared across the catalogue so hardware behaves the same.",
            )
        if self.frames < 1:
            raise StudioError(f"A plate needs at least one frame, not {self.frames}")

    @property
    def id(self) -> str:
        """The asset id, ``<subject>__<move>``."""
        return f"{self.asset}__{self.move}"

    def digest(self) -> str:
        """A hash of everything that affects the output.

        Re-baking with an unchanged spec produces an unchanged plate, and this is
        how that is known without re-rendering.
        """
        payload = json.dumps(asdict(self), sort_keys=True).encode()
        return hashlib.sha256(payload).hexdigest()[:16]


@dataclass(frozen=True, slots=True)
class Plate:
    """A baked plate on disk.

    Attributes:
        id: The asset id.
        version: Semver. Immutable once published.
        root: Where its frames and manifest live.
        frames: The frame files, in order.
        spec: What produced it.
        digest: The spec hash it was baked from.
    """

    id: str
    version: str
    root: Path
    frames: tuple[Path, ...]
    spec: PlateSpec
    digest: str = ""
    meta: dict[str, int] = field(default_factory=dict)

    @property
    def manifest_path(self) -> Path:
        """Where its manifest lives."""
        return self.root / "manifest.json"

    def write_manifest(self) -> None:
        """Record everything needed to re-bake this plate identically."""
        self.manifest_path.write_text(
            json.dumps(
                {
                    "id": self.id,
                    "version": self.version,
                    "digest": self.digest,
                    "frames": [f.name for f in self.frames],
                    "spec": asdict(self.spec),
                    **self.meta,
                },
                indent=2,
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )

    @classmethod
    def load(cls, root: str | Path) -> Plate:
        """Load a baked plate from disk.

        Args:
            root: The plate directory.

        Returns:
            The plate.

        Raises:
            StudioError: There is no manifest, or its frames are missing.
        """
        root = Path(root)
        manifest = root / "manifest.json"
        if not manifest.exists():
            raise StudioError(
                f"No baked plate at {root}",
                fix="Run `abs asset bake <asset> --move <move>` to produce one.",
            )
        raw = json.loads(manifest.read_text(encoding="utf-8"))
        frames = tuple(root / name for name in raw["frames"])
        missing = [f.name for f in frames if not f.exists()]
        if missing:
            raise StudioError(
                f"{root.name} is missing {len(missing)} frame(s)",
                context={"first missing": missing[0]},
                fix="Re-bake it; a partial plate will drop frames mid-move.",
            )
        return cls(
            id=str(raw["id"]),
            version=str(raw["version"]),
            root=root,
            frames=frames,
            spec=PlateSpec(**raw["spec"]),
            digest=str(raw.get("digest", "")),
            # Measured from disk rather than trusted from the manifest: a loaded
            # plate reported zero bytes when this was left to the recorded value.
            meta={"bytes": sum(f.stat().st_size for f in frames)},
        )


def bake(
    spec: PlateSpec,
    destination: str | Path,
    *,
    version: str = "1.0.0",
    force: bool = False,
    timeout: float = 900.0,
) -> Plate:
    """Bake a plate, or return the existing one when nothing changed.

    Args:
        spec: What to bake.
        destination: The ``assets/plates/`` directory.
        version: Semver for this bake. Immutable once published.
        force: Re-bake even when the digest matches.
        timeout: Seconds to allow Blender.

    Returns:
        The baked plate.

    Raises:
        StudioError: Blender is missing, or the bake failed.
    """
    root = Path(destination) / f"{spec.id}@{version}"
    digest = spec.digest()

    if not force and (root / "manifest.json").exists():
        existing = Plate.load(root)
        if existing.digest == digest:
            return existing

    binary = blender_binary()
    root.mkdir(parents=True, exist_ok=True)
    for stale in root.glob("frame_*.png"):
        stale.unlink()

    active = theme(spec.theme_name)
    palette = {name: role.hue for name, role in active.roles.items()}
    payload = {
        **asdict(spec),
        "palette": palette,
        "lighting": active.lighting,
        "out": str(root),
    }

    completed = subprocess.run(
        [
            str(binary),
            "--background",
            "--factory-startup",
            "--python",
            str(_SCRIPT),
            "--",
            "--spec",
            json.dumps(payload),
        ],
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )
    if completed.returncode != 0 or "BAKED" not in completed.stdout:
        tail = (completed.stderr or completed.stdout).strip().splitlines()[-6:]
        raise StudioError(
            f"Baking {spec.id} failed",
            context={"blender": "\n      ".join(tail) or "no output"},
        )

    frames = tuple(sorted(root.glob("frame_*.png")))
    if len(frames) != spec.frames:
        raise StudioError(
            f"{spec.id}: expected {spec.frames} frames, got {len(frames)}",
            fix="A partial plate drops frames mid-move. Re-bake with --force.",
        )

    plate = Plate(
        id=spec.id,
        version=version,
        root=root,
        frames=frames,
        spec=spec,
        digest=digest,
        meta={"bytes": sum(f.stat().st_size for f in frames)},
    )
    plate.write_manifest()
    return plate
