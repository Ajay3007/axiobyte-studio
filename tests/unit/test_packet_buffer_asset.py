"""The packet buffer and the mbuf, held to the buffer-family decision.

`memory_buffer` is the Studio's one concept for the buffer that holds a packet's bytes; "packet
buffer" is its name in use (docs/architecture/buffer-family-decision.md). The `packet_buffer` asset
is a qualified, packet-oriented 3D depiction of that concept — never a second concept. An mbuf's
buf_addr refers to the packet buffer; host memory is where a buffer lives, not what buf_addr names.
Nothing here touches the episodes, interactions or goldens that already use `memory_buffer`.
"""

from __future__ import annotations

import copy
from pathlib import Path
from typing import Any

import pytest
import yaml
from test_compositions import connection_errors, reference_errors, residence_errors

from axiobyte_studio.actors import LIBRARY as ACTORS
from axiobyte_studio.concepts import ConceptKind
from axiobyte_studio.concepts.registry import ConceptRegistry

REPO = Path(__file__).resolve().parents[2]
LIBRARY = yaml.safe_load((REPO / "assets" / "library.yaml").read_text(encoding="utf-8"))
ASSETS: dict[str, dict[str, Any]] = {a["id"]: a for a in LIBRARY["assets"]}


@pytest.fixture(scope="module")
def concepts() -> ConceptRegistry:
    return ConceptRegistry.load()


def _composition(**sections: Any) -> dict[str, Any]:
    """A test-only composition of the four assets; nothing here is written anywhere."""
    return {
        "id": "test_packet_buffer",
        "instances": {
            "memory": "host_memory",
            "pool": "mempool",
            "m": "mbuf",
            "buf": "packet_buffer",
        },
        "connections": [],
        **sections,
    }


# ------------------------------------------------------------------ one concept, not two


def test_memory_buffer_is_the_only_buffer_concept(concepts):
    atomic = {c.id for c in concepts.of_kind(ConceptKind.ATOMIC)}
    assert "memory_buffer" in atomic
    assert "packet_buffer" not in set(concepts.ids)
    assert not (REPO / "src/axiobyte_studio/concepts/library/atomic/packet_buffer.yaml").exists()


def test_no_second_actor_competes_with_memory_buffer():
    assert "packet_buffer" not in ACTORS
    assert ACTORS["memory_buffer"].concept == "memory_buffer"


def test_the_packet_buffer_asset_depicts_memory_buffer():
    asset = ASSETS["packet_buffer"]
    assert asset["concept"] == "memory_buffer"
    assert (asset["status"], asset["quality"], asset["version"]) == ("prototype", "micro", "1.0.0")
    assert not {"route", "experience", "released_in"} & set(asset)
    assert set(asset["implementations"]) == {"three"}
    assert asset["parts"] == ["header", "payload"]
    # It is the only asset realising memory_buffer, under its qualified id.
    assert [a["id"] for a in ASSETS.values() if a["concept"] == "memory_buffer"] == [
        "packet_buffer"
    ]


# ------------------------------------------------------------------ reference and residence


def test_the_mbuf_refers_to_the_packet_buffer_not_to_host_memory():
    mbuf = ASSETS["mbuf"]
    assert mbuf["refers_to"] == ["packet_buffer"]
    assert (mbuf["status"], mbuf["quality"], mbuf["version"]) == ("prototype", "micro", "1.0.0")
    assert mbuf["resides_in"] == ["mempool"]
    assert set(mbuf["implementations"]) == {"three", "manim"}


def test_buf_addr_is_expressible_as_a_reference_to_the_buffer():
    ok = _composition(references=[{"from": "m.fields", "to": "buf.header"}])
    assert reference_errors(ok, ASSETS) == []
    # And no longer to host memory directly: buf_addr names the buffer, not where it lives.
    old = _composition(references=[{"from": "m.fields", "to": "memory.packet-buffer-region"}])
    assert reference_errors(old, ASSETS) == ["references[0]: mbuf may not refer to host_memory"]


@pytest.mark.parametrize("parent", ["memory.packet-buffer-region", "pool.elements"])
def test_a_packet_buffer_may_reside_in_host_memory_or_a_mempool(parent):
    assert ASSETS["packet_buffer"]["resides_in"] == ["host_memory", "mempool"]
    composition = _composition(residence={"buf": parent})
    assert residence_errors(composition, ASSETS) == []
    assert connection_errors(composition, ASSETS) == []


def test_residence_is_one_parent_at_a_time():
    # resides_in lists allowed parents; a composition names one region per instance — a mapping
    # from the instance, so one buffer cannot be declared to live in both at once.
    composition = _composition(residence={"buf": "pool.elements"})
    assert isinstance(composition["residence"], dict) and len(composition["residence"]) == 1


def test_the_buffer_refers_to_nothing():
    assert "refers_to" not in ASSETS["packet_buffer"]
    composition = _composition(references=[{"from": "buf.header", "to": "m.fields"}])
    assert reference_errors(composition, ASSETS) == [
        "references[0]: packet_buffer may not refer to mbuf"
    ]


# ------------------------------------------------------------------ nothing else moved


def test_the_memory_buffer_interactions_are_unchanged(concepts):
    between = {i: tuple(concepts.get(i).between) for i in ("dma", "zero_copy", "copy_based")}
    assert between == {
        "dma": ("nic", "memory_buffer"),
        "zero_copy": ("pointer", "memory_buffer"),
        "copy_based": ("packet", "memory_buffer"),
    }
    for concept in ("mbuf", "mempool", "descriptor_ring"):
        assert "memory_buffer" in concepts.get(concept).requires, concept


def test_the_mempool_is_unchanged():
    pool = copy.deepcopy(ASSETS["mempool"])
    assert (pool["status"], pool["quality"], pool["parts"]) == (
        "prototype",
        "standard",
        ["elements"],
    )
    assert pool["resides_in"] == ["host_memory"]
    assert "refers_to" not in pool
