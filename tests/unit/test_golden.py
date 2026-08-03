"""Golden tests — the layer that would have caught what shipped.

Every visual defect this project has had was found by a human looking at a PNG
while the suite stayed green. These are the tests that look instead.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import ClassVar

import pytest

from axiobyte_studio.backends.svg import render as render_svg
from axiobyte_studio.layout import Chain, Pair, Stack, solve, target
from axiobyte_studio.testing import Golden, hamming, image_hash, snapshot_scene

REPO = Path(__file__).resolve().parents[2]
GOLDEN = REPO / "tests" / "golden"
EPISODE = REPO / "episodes" / "s01e02-zero-copy"
TARGETS = ["16x9", "9x16", "1x1"]


def _episode_module():
    """Import the worked episode's shots module."""
    path = EPISODE / "shots" / "episode.py"
    if not path.exists():
        pytest.skip("the worked episode is not present")
    spec = importlib.util.spec_from_file_location("_golden_ep02", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class TestSemanticSnapshot:
    """The layer that catches "the address on screen is wrong"."""

    def test_the_episode_scene_matches_its_golden(self):
        from axiobyte_studio.storyboard import Episode
        from axiobyte_studio.timeline import CueTable

        module = _episode_module()
        episode = Episode.load(EPISODE)
        assert episode.beatmap is not None and episode.timeline is not None
        cues = CueTable.resolve(episode.beatmap.cues, episode.timeline)
        scene = module.build_scene(turn=cues[module.TURN])
        Golden(GOLDEN / "scene" / "s01e02.json").check_json(snapshot_scene(scene))

    def test_the_payload_address_survives_the_whole_episode(self):
        # The bug that shipped: the zero-copy payload rendered at the post-copy
        # address, so it no longer matched the mbuf's buf_addr — and that identity
        # IS the lesson. Asserted explicitly, not only via the snapshot, because
        # this one deserves to fail by name.
        from axiobyte_studio.storyboard import Episode
        from axiobyte_studio.timeline import CueTable

        module = _episode_module()
        episode = Episode.load(EPISODE)
        assert episode.beatmap is not None and episode.timeline is not None
        cues = CueTable.resolve(episode.beatmap.cues, episode.timeline)
        scene = module.build_scene(turn=cues[module.TURN])

        payload = scene.actors["packet#1"].props["address"]
        buf_addr = scene.actors["mbuf#1"].props["buf_addr"]
        assert payload == buf_addr, (
            f"the payload is at {payload} but the mbuf points at {buf_addr} — "
            "the episode's whole argument is that these are the same address"
        )

    def test_a_changed_prop_fails_the_snapshot(self, tmp_path, monkeypatch):
        from axiobyte_studio.actions import DMA_WRITE, Scene
        from axiobyte_studio.actors import PACKET, Salience
        from axiobyte_studio.testing.golden import UPDATE_ENV

        # This test asserts the CHECKING behaviour, so it must not inherit an
        # update flag from the run that invoked it.
        monkeypatch.delenv(UPDATE_ENV, raising=False)
        golden = Golden(tmp_path / "s.json")
        scene = Scene(id="s")
        scene.cast(PACKET, "1", salience=Salience.PRIMARY, address="0xAAAA")
        scene.apply(DMA_WRITE, "packet#1", at=1.0)
        with pytest.raises(AssertionError, match="Created a new golden"):
            golden.check_json(snapshot_scene(scene))

        moved = Scene(id="s")
        moved.cast(PACKET, "1", salience=Salience.PRIMARY, address="0xBBBB")
        moved.apply(DMA_WRITE, "packet#1", at=1.0)
        with pytest.raises(AssertionError) as exc:
            golden.check_json(snapshot_scene(moved))
        assert "0xAAAA" in str(exc.value)
        assert "UPDATE_GOLDEN=1" in str(exc.value)


class TestLayoutGoldens:
    """Deterministic markup, committed as text, so a diff shows what moved."""

    SHOT = Stack(
        id="gallery",
        children=(
            Chain(id="machine", items=("nic", "mempool", "mbuf"), weight=3.0),
            Pair(id="evidence", a="packet", b="pointer", weight=2.0),
        ),
    )
    ROLES: ClassVar[dict[str, str]] = {
        "nic": "nic",
        "mempool": "memory",
        "mbuf": "mbuf",
        "packet": "packet",
        "pointer": "pointer",
    }

    @pytest.mark.parametrize("target_id", TARGETS)
    def test_the_shot_matches_its_golden_in_every_format(self, target_id):
        platform = "reels" if target_id == "9x16" else None
        layout = solve(self.SHOT, target(target_id), platform=platform)
        svg = render_svg(layout, title="gallery", roles=self.ROLES)
        Golden(GOLDEN / "layout" / f"gallery.{target_id}.svg").check_text(svg)


class TestPerceptualHash:
    def test_identical_images_hash_identically(self, tmp_path):
        from PIL import Image

        path = tmp_path / "a.png"
        Image.new("RGB", (64, 64), (12, 34, 56)).save(path)
        assert hamming(image_hash(path), image_hash(path)) == 0

    def test_a_moved_shape_changes_the_hash(self, tmp_path):
        from PIL import Image, ImageDraw

        def box(at: int, name: str) -> Path:
            image = Image.new("RGB", (128, 128), (10, 10, 10))
            ImageDraw.Draw(image).rectangle([at, 20, at + 40, 60], fill=(200, 200, 200))
            path = tmp_path / name
            image.save(path)
            return path

        assert hamming(image_hash(box(10, "l.png")), image_hash(box(70, "r.png"))) > 4

    def test_hashes_of_different_resolutions_refuse_to_compare(self, tmp_path):
        from PIL import Image

        path = tmp_path / "a.png"
        Image.new("RGB", (64, 64), (0, 0, 0)).save(path)
        with pytest.raises(ValueError, match="different"):
            hamming(image_hash(path, size=8), image_hash(path, size=16))
