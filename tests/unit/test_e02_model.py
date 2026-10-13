"""s01e02's scene model, held to the current semantics.

DMA is an interaction between the NIC and a memory buffer (concepts/interaction/dma.yaml): the
NIC writes the packet into a BUFFER — one the mempool provides — never into the mempool, the
allocation structure itself. The copy tax is the CPU copying; the NIC's own write is not a copy.
And the model's actions happen when THIS episode's voiceover says them, not at another
recording's timestamps.
"""

from __future__ import annotations

import importlib.util
import re
from pathlib import Path
from typing import Any

import pytest

from axiobyte_studio.storyboard import Episode
from axiobyte_studio.testing import snapshot_scene
from axiobyte_studio.timeline import CueTable

REPO = Path(__file__).resolve().parents[2]
EPISODE = REPO / "episodes" / "s01e02-zero-copy"


def _module() -> Any:
    path = EPISODE / "shots" / "episode.py"
    if not path.exists():
        pytest.skip("the worked episode is not present")
    spec = importlib.util.spec_from_file_location("_e02_model", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def e02() -> tuple[Any, Episode, dict[str, Any]]:
    module = _module()
    episode = Episode.load(EPISODE)
    assert episode.beatmap is not None and episode.timeline is not None
    cues = CueTable.resolve(episode.beatmap.cues, episode.timeline)
    return module, episode, snapshot_scene(module.build_scene(turn=cues[module.TURN]))


def _actions(snap: dict[str, Any], actor: str) -> list[tuple[str, float]]:
    return [(e["action"], e["at"]) for e in snap["log"] if e["actor"] == actor]


def test_dma_writes_the_packet_into_the_buffer_never_into_the_mempool(e02):
    _, _, snap = e02
    packet = snap["actors"]["packet#1"]
    assert next(a for a, _ in _actions(snap, "packet#1")) == "dma_write"
    assert packet["props"]["into"] == "memory_buffer#1"
    assert packet["props"]["into"] != "mempool#1"
    # The buffer it lands in is the one the mbuf names: same address, so the lesson holds.
    buffer, mbuf = snap["actors"]["memory_buffer#1"], snap["actors"]["mbuf#1"]
    assert buffer["concept"] == "memory_buffer"
    assert packet["props"]["address"] == buffer["props"]["address"] == mbuf["props"]["buf_addr"]
    # The pool is still in the scene: the structure that provides the buffer.
    assert snap["actors"]["mempool#1"]["concept"] == "mempool"


def test_act_one_receives_by_dma_and_only_then_copies_twice(e02):
    _, _, snap = e02
    assert [a for a, _ in _actions(snap, "packet#trad")] == ["dma_write", "copy", "copy"]
    targets = [e for e in snap["log"] if e["actor"] == "packet#trad"]
    assert [e["state"] for e in targets] == [
        "on_wire->in_buffer",
        "in_buffer->in_buffer",
        "in_buffer->in_buffer",
    ]
    # buffer_a is where the NIC's DMA lands; buffer_b and the application are the two copies.
    src = (EPISODE / "shots" / "episode.py").read_text(encoding="utf-8")
    assert 'into="kernel_buffer"' in src and 'into="buffer_b"' in src and 'into="app"' in src


def test_red_is_drawn_only_for_the_cpu_copy(e02):
    # Act one's arrows: the NIC's write in the packet's colour, labelled DMA; the copy in red.
    src = (EPISODE / "shots" / "episode.py").read_text(encoding="utf-8")
    # (What is actually drawn is checked on the dry-run film in test_e02_staging.py.)
    assert re.search(r'_transfer\(stages\["nic"\], stages\["buffer_a"\], dma_hue, "DMA"', src)
    assert re.search(r"stages\[source\], stages\[destination\], copy_hue, \"copy\"", src)
    # The two copies are A → B and B → the application, on sentences 6 and 7.
    assert '("buffer_a", "buffer_b", "traditional.copy",' in src
    assert '("buffer_b", "app", "traditional.copy_again",' in src
    assert 'dma_hue = scene.theme.role("packet").hue' in src
    # And in the model nothing after the turn copies the zero-copy packet.
    _, _, snap = e02
    assert all(a != "copy" for a, _ in _actions(snap, "packet#1"))
    (invariant,) = snap["invariants"]
    assert invariant["actor"] == "packet#1" and "copy" in invariant["forbids"]


def test_the_model_runs_on_this_episodes_own_voiceover(e02):
    module, episode, snap = e02
    times = CueTable.resolve(module.ACTION_CUES, episode.timeline)
    expected = {
        "packet#trad": [times["receive"], times["copy"], times["copy_again"]],
        "packet#1": [times["dma"], times["reference"], times["forward"]],
    }
    for actor, ats in expected.items():
        assert [at for _, at in _actions(snap, actor)] == pytest.approx(ats)
    # Each action lands inside the sentence that narrates it.
    for name, spec in module.ACTION_CUES.items():
        sentence = episode.timeline.sentence(int(spec.split("@")[1]))
        assert sentence.start <= times[name] <= sentence.end, name
    # In narrated order: receive, copy, copy; then DMA, reference, forward.
    for actor in expected:
        ats = [at for _, at in _actions(snap, actor)]
        assert ats == sorted(ats)


def test_no_ring_no_host_memory_and_no_new_structure(e02):
    _, _, snap = e02
    concepts = {a["concept"] for a in snap["actors"].values()}
    assert "descriptor_ring" not in concepts
    assert "host_memory" not in concepts
    assert concepts == {"nic", "mempool", "mbuf", "packet", "pointer", "memory_buffer"}
    assert set(snap) == {"actors", "focus", "id", "invariants", "log"}
