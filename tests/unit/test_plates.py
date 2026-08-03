"""Tier-2 plates — baked once, replayed for free.

The bake itself needs Blender and is marked accordingly. Everything else — specs,
manifests, fitting, replay — must work without it, because that is the whole point:
Blender is a build-time dependency, not a runtime one.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from axiobyte_studio.backends.blender import MOVES, Plate, PlateSpec, bake, blender_binary
from axiobyte_studio.core import StudioError
from axiobyte_studio.layout import Box, target

REPO = Path(__file__).resolve().parents[2]
BAKED = REPO / "assets" / "plates" / "nic_board__turntable@1.0.0"


def _has_blender() -> bool:
    try:
        blender_binary()
    except StudioError:
        return False
    return True


@pytest.fixture
def plate() -> Plate:
    if not BAKED.exists():
        pytest.skip("no baked plate present")
    return Plate.load(BAKED)


class TestSpec:
    def test_the_id_names_the_subject_and_the_move(self):
        assert PlateSpec(asset="nic_board", move="push_in").id == "nic_board__push_in"

    def test_an_unknown_move_is_refused(self):
        with pytest.raises(StudioError) as exc:
            PlateSpec(asset="nic_board", move="barrel_roll")
        assert "shared across the catalogue" in str(exc.value)
        for move in MOVES:
            assert move in str(exc.value)

    def test_a_plate_needs_at_least_one_frame(self):
        with pytest.raises(StudioError, match="at least one frame"):
            PlateSpec(asset="nic_board", frames=0)

    def test_the_digest_is_stable_and_specific(self):
        one = PlateSpec(asset="nic_board", frames=16)
        same = PlateSpec(asset="nic_board", frames=16)
        other = PlateSpec(asset="nic_board", frames=17)
        assert one.digest() == same.digest()
        assert one.digest() != other.digest()

    def test_the_palette_is_part_of_the_identity(self):
        # A plate lit by a different theme is a different plate.
        assert (
            PlateSpec(asset="nic_board").digest()
            != PlateSpec(asset="nic_board", theme_name="other").digest()
        )


class TestManifest:
    def test_a_baked_plate_round_trips(self, plate: Plate):
        assert plate.id == "nic_board__turntable"
        assert len(plate.frames) == plate.spec.frames
        assert plate.digest

    def test_the_manifest_records_how_to_re_bake_it(self, plate: Plate):
        raw = json.loads(plate.manifest_path.read_text(encoding="utf-8"))
        assert raw["spec"]["asset"] == "nic_board"
        assert raw["spec"]["move"] == "turntable"
        assert raw["digest"] == plate.digest

    def test_an_absent_plate_names_the_command(self, tmp_path):
        with pytest.raises(StudioError) as exc:
            Plate.load(tmp_path)
        assert "abs asset bake" in str(exc.value)

    def test_a_partial_plate_is_refused(self, plate: Plate, tmp_path):
        copy = tmp_path / plate.root.name
        shutil.copytree(plate.root, copy)
        next(copy.glob("frame_0003.png")).unlink()
        with pytest.raises(StudioError) as exc:
            Plate.load(copy)
        assert "drop frames mid-move" in str(exc.value)


class TestReplay:
    """Replay must work with no Blender anywhere near it."""

    def test_a_frame_fits_inside_its_box(self, plate: Plate):
        from axiobyte_studio.backends.manim import plate_frame
        from axiobyte_studio.backends.manim.space import configure, size_of

        fmt = target("16x9")
        configure(fmt)
        box = Box(0.1, 0.15, 0.5, 0.4)
        image = plate_frame(plate, 0, box, fmt)
        width, height = size_of(box, fmt)
        assert image.width <= width + 1e-6
        assert image.height <= height + 1e-6

    def test_frames_wrap_so_a_turntable_loops(self, plate: Plate):
        from axiobyte_studio.backends.manim import plate_frame
        from axiobyte_studio.backends.manim.space import configure

        fmt = target("16x9")
        configure(fmt)
        box = Box(0.1, 0.1, 0.4, 0.4)
        first = plate_frame(plate, 0, box, fmt)
        wrapped = plate_frame(plate, len(plate.frames), box, fmt)
        assert first.width == pytest.approx(wrapped.width)

    def test_a_plate_sits_below_the_diagram_layer(self, plate: Plate):
        from axiobyte_studio.backends.manim import plate_frame
        from axiobyte_studio.backends.manim.plates import Z_PLATE
        from axiobyte_studio.backends.manim.space import configure

        # Hardware is the stage, not the argument.
        fmt = target("16x9")
        configure(fmt)
        assert plate_frame(plate, 0, Box(0.1, 0.1, 0.4, 0.4), fmt).z_index == Z_PLATE
        assert Z_PLATE < 7  # below the packet band

    def test_a_plate_with_no_frames_is_refused(self, plate: Plate):
        from axiobyte_studio.backends.manim import plate_frame

        empty = Plate(id="x", version="1.0.0", root=plate.root, frames=(), spec=plate.spec)
        with pytest.raises(StudioError, match="no frames"):
            plate_frame(empty, 0, Box(0, 0, 1, 1), target("16x9"))


@pytest.mark.blender
class TestBake:
    def test_baking_is_idempotent_when_the_spec_is_unchanged(self, tmp_path):
        if not _has_blender():
            pytest.skip("Blender is not installed")
        if not BAKED.exists():
            pytest.skip("no baked plate to compare against")
        # Copy the existing plate, then bake the same spec — it should be reused
        # rather than re-rendered, which is what the digest is for.
        plate = Plate.load(BAKED)
        destination = tmp_path / "plates"
        destination.mkdir()
        shutil.copytree(BAKED, destination / BAKED.name)
        again = bake(plate.spec, destination, version=plate.version)
        assert again.digest == plate.digest

    def test_blender_is_found(self):
        if not _has_blender():
            pytest.skip("Blender is not installed")
        assert blender_binary().exists()
