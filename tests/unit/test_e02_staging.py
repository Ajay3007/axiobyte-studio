"""s01e02's staging, observed: the real generated scene, run dry, with every beat snapshotted.

What is on screen just before each beat is recorded — the named presentation groups (``e02:…``,
names for these tests only, never identities in the model), every text and every colour — so the
film's claims can be checked directly: the NIC's DMA is never red; red is the CPU copying, and only
that; the bytes are drawn in the buffer, never in the mbuf; DMA ends on the buffer, never the pool;
the buffer never moves while the handle visits the stages; transmit reads the same buffer; and no
runtime state, no SmartNIC, no descriptor ring and no host memory appear.
"""

from __future__ import annotations

import importlib.util
import re
from pathlib import Path
from typing import Any

import pytest

REPO = Path(__file__).resolve().parents[2]
EPISODE = REPO / "episodes" / "s01e02-zero-copy"
STATES = re.compile(r"\b(free|in use|allocated|owned|returned|posted|consumed|ready)\b", re.I)


def _summary(scene: Any) -> dict[str, Any]:
    from manim import Text

    named: dict[str, Any] = {}
    counts: dict[str, int] = {}
    texts: set[str] = set()
    colours: set[str] = set()
    for top in scene.mobjects:
        for mob in top.get_family():
            name = getattr(mob, "name", "")
            if isinstance(name, str) and name.startswith("e02:"):
                counts[name] = counts.get(name, 0) + 1
            if isinstance(name, str) and name.startswith("e02:") and name not in named:
                named[name] = {
                    "centre": tuple(round(float(v), 4) for v in mob.get_center()),
                    "box": (
                        mob.get_left()[0],
                        mob.get_right()[0],
                        mob.get_bottom()[1],
                        mob.get_top()[1],
                    ),
                    "mob": mob,
                }
            if isinstance(mob, Text):
                texts.add(mob.original_text)
            if mob.has_points():
                if mob.get_stroke_opacity() > 0.05 and mob.get_stroke_width() > 0:
                    colours.add(mob.get_stroke_color().to_hex().upper())
                if mob.get_fill_opacity() > 0.05:
                    colours.add(mob.get_fill_color().to_hex().upper())
    return {"named": named, "counts": counts, "texts": texts, "colours": colours}


@pytest.fixture(scope="module")
def film() -> dict[str, Any]:
    pytest.importorskip("manim", reason="the Manim backend needs manim installed")
    import tempfile

    from manim import tempconfig

    from axiobyte_studio.design import theme

    spec = importlib.util.spec_from_file_location("_e02_staging", EPISODE / "shots" / "episode.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    snapshots: list[tuple[str, dict[str, Any]]] = []

    class Probe(module.SCENES["16x9"]):  # type: ignore[misc,name-defined]
        def at(self, cue: str) -> None:
            snapshots.append((cue, _summary(self)))
            super().at(cue)

        def clear_stage(self, run_time: float = 0.4) -> None:
            snapshots.append(("clear", _summary(self)))
            super().clear_stage(run_time)

    with tempfile.TemporaryDirectory() as media:
        options = {
            "dry_run": True,
            "write_to_movie": False,
            "disable_caching": True,
            "frame_rate": 2,
            "pixel_width": 320,
            "pixel_height": 180,
            "verbosity": "ERROR",
            "progress_bar": "none",
            "media_dir": media,
        }
        with tempconfig(options):
            probe = Probe()
            probe.render()
            snapshots.append(("end", _summary(probe)))
    active = theme()
    return {
        "module": module,
        "snaps": snapshots,
        "before": dict(snapshots),
        "copy": active.role("copy").hue.upper(),
        "packet": active.role("packet").hue.upper(),
    }


def _named(snap: dict[str, Any], name: str) -> Any:
    return snap["named"].get(name)


def _colours(mob: Any) -> set[str]:
    found = set()
    for m in mob.family_members_with_points():
        if m.get_stroke_width() > 0:
            found.add(m.get_stroke_color().to_hex().upper())
        if m.get_fill_opacity() > 0.05:
            found.add(m.get_fill_color().to_hex().upper())
    return found


def _inside(inner: tuple[float, ...], outer: tuple[float, ...], slack: float = 0.02) -> bool:
    return (
        inner[0] >= outer[0] - slack
        and inner[1] <= outer[1] + slack
        and inner[2] >= outer[2] - slack
        and inner[3] <= outer[3] + slack
    )


def test_every_beat_is_staged(film):
    from axiobyte_studio.storyboard import Episode

    episode = Episode.load(EPISODE)
    assert episode.beatmap is not None
    staged = {cue for cue, _ in film["snaps"]}
    assert {b.id for b in episode.beatmap.beats} <= staged


def test_sentence_five_is_dma_and_six_and_seven_are_red_copies(film):
    before = film["before"]
    after_receive = before["traditional.copy"]
    dma = _named(after_receive, "e02:dma")
    assert dma is not None and _named(after_receive, "e02:copy") is None
    assert film["packet"] in _colours(dma["mob"]) and film["copy"] not in _colours(dma["mob"])
    assert "DMA" in after_receive["texts"]
    # One red copy after sentence 6, a second after sentence 7 — and still the one DMA.
    after_copy = before["traditional.copy_again"]
    assert after_copy["counts"].get("e02:copy") == 1
    assert film["copy"] in _colours(_named(after_copy, "e02:copy")["mob"])
    end_of_act = film["before"]["clear"]
    assert end_of_act["counts"].get("e02:copy") == 2
    assert end_of_act["counts"].get("e02:dma") == 1
    # Before sentence 5 nothing has crossed: no arrow of either kind.
    setup = before["traditional.receive"]
    assert _named(setup, "e02:dma") is None and _named(setup, "e02:copy") is None


def test_the_nics_dma_is_never_red_and_red_is_only_the_copy(film):
    for _, snap in film["snaps"]:
        for name in ("e02:dma", "e02:dma_read"):
            found = _named(snap, name)
            if found:
                assert film["copy"] not in _colours(found["mob"]), name
    # After the turn's "no copy" stamp is gone, nothing red is on screen at all.
    turned = False
    for cue, snap in film["snaps"]:
        if cue == "zerocopy.mbuf":
            turned = True
        if turned:
            assert film["copy"] not in snap["colours"], cue


def test_zero_copy_dma_ends_on_the_buffer_never_the_pool_or_the_mbuf(film):
    snap = film["before"]["zerocopy.no_cpu"]
    dma, buffer = _named(snap, "e02:dma"), _named(snap, "e02:buffer")
    pool, mbuf = _named(snap, "e02:mempool"), _named(snap, "e02:mbuf")
    assert dma and buffer and pool and mbuf
    tip = dma["mob"][0].get_end()
    left, right, bottom, top = buffer["box"]
    # The arrow lands at the buffer's edge.
    gap = max(left - tip[0], tip[0] - right, bottom - tip[1], tip[1] - top, 0.0)
    assert gap < 0.3
    for other in (pool, mbuf):
        ol, orr, ob, ot = other["box"]
        assert not (ol <= tip[0] <= orr and ob <= tip[1] <= ot)


def test_the_bytes_are_in_the_buffer_and_never_in_the_mbuf(film):
    snap = film["before"]["zerocopy.no_cpu"]
    buffer, mbuf, landed = (_named(snap, n) for n in ("e02:buffer", "e02:mbuf", "e02:landed"))
    assert buffer and mbuf and landed
    in_buffer = landed["mob"][0]
    assert _inside(
        (
            in_buffer.get_left()[0],
            in_buffer.get_right()[0],
            in_buffer.get_bottom()[1],
            in_buffer.get_top()[1],
        ),
        buffer["box"],
    )
    # The pool shows the same bytes in its element's buffer half, and the mbuf holds none.
    assert film["packet"] not in _colours(mbuf["mob"])
    ml, mr, mb, mt = mbuf["box"]
    for cell in landed["mob"].family_members_with_points():
        x, y, _ = cell.get_center()
        assert not (ml <= x <= mr and mb <= y <= mt)


def test_the_representative_element_is_disclosed_as_an_example(film):
    snap = film["before"]["zerocopy.dma"]
    assert _named(snap, "e02:illustrative") is not None
    assert any("one element" in t and "for example" in t for t in snap["texts"])
    # It clears when the narration returns the buffer: no state, just no more emphasis.
    assert _named(film["before"]["zerocopy.once"], "e02:illustrative") is None


def test_the_stages_are_episode_local_and_only_the_handle_moves(film):
    from axiobyte_studio.actors import LIBRARY as ACTORS

    assert not {"parser", "classifier", "firewall", "routing"} & set(ACTORS)
    stage_beats = [
        "zerocopy.classifier",
        "zerocopy.firewall",
        "zerocopy.routing",
        "zerocopy.handle",
    ]
    buffers = {_named(film["before"][c], "e02:buffer")["centre"] for c in stage_beats}
    bytes_ = {_named(film["before"][c], "e02:landed")["centre"] for c in stage_beats}
    handles = [_named(film["before"][c], "e02:handle")["centre"] for c in stage_beats]
    assert len(buffers) == 1 and len(bytes_) == 1  # the buffer and its bytes never move
    assert len(set(handles)) == 4  # the handle is at a different stage each time
    assert {"parser", "classifier", "firewall", "routing"} <= film["before"]["zerocopy.handle"][
        "texts"
    ]
    # A visited stage is left exactly as it was drawn: same colours, same size — no "visited" mark.
    drawn = _named(film["before"]["zerocopy.parser"], "e02:stages")
    after = _named(film["snaps"][-1][1], "e02:stages")
    assert drawn and after
    from axiobyte_studio.design import theme

    stage_hue = theme().role("cpu").hue.upper()
    assert all(stage_hue in _colours(node) for node in after["mob"])
    assert after["box"] == pytest.approx(drawn["box"], abs=1e-3)


def test_the_buffer_never_moves_from_dma_to_payoff(film):
    order = [cue for cue, _ in film["snaps"]]
    after_dma = order[order.index("zerocopy.no_cpu") :]
    centres = {
        _named(film["before"].get(c, film["snaps"][-1][1]), "e02:buffer")["centre"]
        for c in after_dma
    }
    assert len(centres) == 1


def test_transmit_reads_the_same_buffer(film):
    snap = film["before"]["zerocopy.reuse"]
    out, buffer = _named(snap, "e02:dma_read"), _named(snap, "e02:buffer")
    assert out and buffer
    start = out["mob"][0].get_start()
    left, right, bottom, top = buffer["box"]
    assert max(left - start[0], start[0] - right, bottom - start[1], start[1] - top, 0.0) < 0.3
    assert film["copy"] not in _colours(out["mob"])


def test_no_state_labels_no_smartnic_no_ring_and_no_host_memory(film):
    texts = set().union(*(snap["texts"] for _, snap in film["snaps"]))
    assert not [t for t in texts if STATES.search(t)], texts
    assert "SmartNIC" not in " ".join(texts)
    assert not [t for t in texts if re.search(r"descriptor|ring\b|host memory", t, re.I)]
    assert "NIC" in film["before"]["zerocopy.dma"]["texts"]


def test_the_payoff_is_one_buffer_one_handle_and_no_red(film):
    end = film["snaps"][-1][1]
    assert _named(end, "e02:buffer") and _named(end, "e02:handle") and _named(end, "e02:landed")
    assert film["copy"] not in end["colours"]
    # The handle is an address: it carries the pointer's yellow, never the mbuf's own colour.
    from axiobyte_studio.design import theme

    pointer = theme().role("pointer").hue.upper()
    assert pointer in _colours(_named(end, "e02:handle")["mob"])
    assert theme().role("mbuf").hue.upper() not in _colours(_named(end, "e02:handle")["mob"])
    assert _named(end, "e02:dma") is None and _named(end, "e02:dma_read") is None
