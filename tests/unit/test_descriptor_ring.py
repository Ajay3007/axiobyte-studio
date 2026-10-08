"""The Descriptor Ring asset (``descriptor_ring`` in ``assets/library.yaml``) holds to its entry.

It is the first asset that declares residence and references (``resides_in``, ``refers_to``),
and the first registered after a concept already had an actor. The registry tests check it like
every asset; these check what is particular to it: one part with head and tail as anchors, no
ports, the two relationships it allows — and their one use, the RX ring in nic_host — and a
Manim drawing that never shows packet bytes.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
import yaml
from test_compositions import SCHEMA_VERSION, reference_errors, residence_errors

from axiobyte_studio.actors import LIBRARY as ACTORS
from axiobyte_studio.concepts.registry import ConceptRegistry

REPO = Path(__file__).resolve().parents[2]
ASSETS = {
    a["id"]: a
    for a in yaml.safe_load((REPO / "assets" / "library.yaml").read_text(encoding="utf-8"))[
        "assets"
    ]
}
RING = ASSETS["descriptor_ring"]


def test_it_realises_the_existing_descriptor_ring_concept_at_its_first_version():
    concept = ConceptRegistry.load().get("descriptor_ring")
    assert RING["concept"] == concept.id
    assert RING["version"] == "1.0.0"
    assert RING["quality"] == "standard"
    # Built, paged and shipped in the experiences release that first carries it.
    assert RING["status"] == "released" and RING["released_in"] == "experiences-v1.3.0"


def test_its_one_part_is_the_descriptors_and_head_and_tail_are_anchors_not_parts():
    assert RING["parts"] == ["descriptors"]
    assert {"head", "tail", "slot"} <= set(ConceptRegistry.load().get("descriptor_ring").anchors)
    assert {"head", "tail"} <= set(ACTORS["descriptor_ring"].anchors)
    metadata = (REPO / RING["implementations"]["three"]["path"] / "metadata.js").read_text("utf-8")
    assert "export const ANCHOR_METADATA" in metadata  # head and tail: explained, never parts


def test_nothing_attaches_to_it_and_it_may_live_in_and_refer_to_host_memory():
    assert RING["ports"] == []
    assert RING["resides_in"] == ["host_memory"]
    assert RING["refers_to"] == ["host_memory"]


def _composition(**sections: Any) -> dict[str, Any]:
    """A test-only composition of the real registry entries: a ring and host memory."""
    instances = {"memory": "host_memory", "cpu": "cpu", "rx_ring": "descriptor_ring"}
    return {
        "version": SCHEMA_VERSION,
        "id": "test_descriptor_ring",
        "title": "Descriptor ring fixture",
        "route": "memory/test-descriptor-ring",
        "instances": instances,
        "placement": {i: {"position": [0, 0, 0], "rotation": [0, 0, 0]} for i in instances},
        "connections": [],
        "interactions": [],
        **sections,
    }


def test_a_composition_can_place_it_in_the_descriptor_region_referring_to_the_buffers():
    c = _composition(
        residence={"rx_ring": "memory.descriptor-region"},
        references=[{"from": "rx_ring.descriptors", "to": "memory.packet-buffer-region"}],
    )
    assert residence_errors(c, ASSETS) == []
    assert reference_errors(c, ASSETS) == []


@pytest.mark.parametrize(
    ("sections", "error"),
    [
        ({"residence": {"rx_ring": "cpu.cache"}}, "descriptor_ring may not reside in cpu"),
        (
            {"references": [{"from": "rx_ring.descriptors", "to": "cpu.cache"}]},
            "descriptor_ring may not refer to cpu",
        ),
        (
            {"references": [{"from": "rx_ring.head", "to": "memory.packet-buffer-region"}]},
            "rx_ring.head is no part of descriptor_ring",
        ),
    ],
    ids=["resides-in-cpu", "refers-to-cpu", "head-is-not-a-part"],
)
def test_a_composition_cannot_misplace_it(sections, error):
    c = _composition(**sections)
    errors = residence_errors(c, ASSETS) + reference_errors(c, ASSETS)
    assert any(error in e for e in errors), errors


# ------------------------------------------------------------------ in nic_host
NIC_HOST = REPO / "assets" / "compositions" / "nic_host.yaml"
RUNTIME = REPO / "renderers" / "three" / "src" / "compositions" / "nic_host" / "contract.json"


def _nic_host() -> dict[str, Any]:
    composition: dict[str, Any] = yaml.safe_load(NIC_HOST.read_text(encoding="utf-8"))
    return composition


def test_nic_host_composes_one_ring_resident_in_memory_and_referring_to_its_buffers():
    c = _nic_host()
    assert [i for i, a in c["instances"].items() if a == "descriptor_ring"] == ["rx_ring"]
    assert set(c["placement"]["rx_ring"]) == {"position", "rotation"}
    assert c["residence"]["rx_ring"] == "memory.descriptor-region"
    assert c["references"] == [{"from": "rx_ring.descriptors", "to": "memory.packet-buffer-region"}]
    assert "descriptors" in RING["parts"]
    assert {"descriptor-region", "packet-buffer-region"} <= set(ASSETS["host_memory"]["parts"])
    assert residence_errors(c, ASSETS) == [] and reference_errors(c, ASSETS) == []
    no_composition_uses_it_elsewhere = [
        p.name
        for p in (REPO / "assets" / "compositions").glob("*.yaml")
        if p != NIC_HOST
        and "descriptor_ring" in yaml.safe_load(p.read_text("utf-8"))["instances"].values()
    ]
    assert not no_composition_uses_it_elsewhere


def test_the_runtime_copy_carries_the_ring_its_residence_and_its_reference_as_declared():
    runtime = json.loads(RUNTIME.read_text(encoding="utf-8"))
    c = _nic_host()
    for key in ("instances", "placement", "residence", "references"):
        assert runtime[key] == c[key], key


def test_nic_host_keeps_its_released_connections_and_dma():
    # As released in experiences-v1.2.0: the ring adds no connection and is not on the DMA path.
    c = _nic_host()
    assert c["connections"] == [
        {"kind": "mate", "a": "nic.pcie_connector", "b": "pcie.endpoint", "gap": 1.02},
        {
            "kind": "route",
            "a": "pcie.root_complex",
            "b": "cpu.pcie_root_complex",
            "label": "PCIe x8",
        },
        {
            "kind": "route",
            "a": "cpu.memory_interface",
            "b": "memory.memory_interface",
            "label": "memory channels",
        },
    ]
    assert c["interactions"] == [
        {
            "concept": "dma",
            "from": "nic",
            "to": "memory.packet-buffer-region",
            "via": ["pcie", "cpu.io", "cpu.memory-controller"],
        }
    ]


@pytest.mark.parametrize(
    ("section", "value", "error"),
    [
        ("residence", {"rx_ring": "memory.descriptor-ring"}, "is no part of host_memory"),
        ("residence", {"rx_ring": "memory.memory_interface"}, "is a port, not a part"),
        ("residence", {"rx_ring": "pcie.slot"}, "descriptor_ring may not reside in pcie"),
        (
            "references",
            [{"from": "rx_ring.descriptors", "to": "memory.packet-buffers"}],
            "is no part of host_memory",
        ),
        (
            "references",
            [{"from": "rx_ring.slot", "to": "memory.packet-buffer-region"}],
            "rx_ring.slot is no part of descriptor_ring",
        ),
        (
            "references",
            [{"from": "rx_ring.descriptors", "to": "nic.nic-controller"}],
            "descriptor_ring may not refer to nic",
        ),
    ],
    ids=[
        "residence-unknown-part",
        "residence-port",
        "residence-wrong-asset",
        "reference-unknown-target",
        "reference-anchor-as-source",
        "reference-wrong-asset",
    ],
)
def test_nic_host_rejects_a_misplaced_ring(section, value, error):
    c = _nic_host()
    c[section] = value
    errors = residence_errors(c, ASSETS) + reference_errors(c, ASSETS)
    assert any(error in e for e in errors), errors


def test_its_page_is_its_concept_in_the_memory_domain():
    assert RING["route"] == "memory/descriptor-ring"
    assert ConceptRegistry.load().get("descriptor_ring").domain == "memory"
    page = json.loads((REPO / RING["experience"] / "experience.json").read_text("utf-8"))
    assert page["concept"] == "descriptor_ring"
    assert "episode" not in page


def test_the_manim_actor_draws_slots_in_a_ring_never_packet_bytes():
    pytest.importorskip("manim", reason="the Manim backend needs manim installed")
    from axiobyte_studio.backends.manim import draw
    from axiobyte_studio.backends.manim.space import configure
    from axiobyte_studio.design import theme
    from axiobyte_studio.layout import Box, target

    fmt = target("16x9")
    configure(fmt)
    active = theme()
    group = draw(ACTORS["descriptor_ring"].spawn("1"), Box(0.2, 0.1, 0.6, 0.8), fmt, active)
    _, slots, marks, _ = group
    assert len(slots) == 8
    centres = [s.get_center() for s in slots]
    middle = sum(centres) / len(centres)
    radii = [float(((c - middle) ** 2).sum() ** 0.5) for c in centres]
    assert max(radii) - min(radii) < 0.02 * max(radii)  # one ring, not a row
    assert len(marks) == 4  # head and tail: a label and a pointer each
    colours = {m.get_fill_color().to_hex().upper() for m in group.family_members_with_points()}
    colours |= {m.get_stroke_color().to_hex().upper() for m in group.family_members_with_points()}
    assert active.role("memory").hue.upper() in colours
    assert active.role("packet").hue.upper() not in colours
