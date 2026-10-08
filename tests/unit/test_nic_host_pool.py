"""The mempool in ``nic_host``: one pool, resident in host memory's packet-buffer region.

Residence is semantic: the pool lives in the region and is drawn beside it. The descriptor
reference and the DMA interaction still name the region, not the pool, and no mbuf or buffer is
instantiated — the pool's tiles illustrate its one part, ``elements``.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import pytest
import yaml
from test_compositions import connection_errors, reference_errors, residence_errors

REPO = Path(__file__).resolve().parents[2]
NIC_HOST = REPO / "assets" / "compositions" / "nic_host.yaml"
RUNTIME = REPO / "renderers" / "three" / "src" / "compositions" / "nic_host" / "contract.json"
ASSETS = {
    a["id"]: a
    for a in yaml.safe_load((REPO / "assets" / "library.yaml").read_text(encoding="utf-8"))[
        "assets"
    ]
}


def _nic_host() -> dict[str, Any]:
    composition: dict[str, Any] = yaml.safe_load(NIC_HOST.read_text(encoding="utf-8"))
    return composition


def test_nic_host_has_one_mempool_resident_in_the_packet_buffer_region():
    c = _nic_host()
    assert [i for i, a in c["instances"].items() if a == "mempool"] == ["pool"]
    assert set(c["placement"]["pool"]) == {"position", "rotation"}
    assert c["residence"]["pool"] == "memory.packet-buffer-region"
    assert c["residence"]["rx_ring"] == "memory.descriptor-region"
    assert residence_errors(c, ASSETS) == []
    assert reference_errors(c, ASSETS) == []
    assert connection_errors(c, ASSETS) == []


def test_the_descriptor_reference_and_the_dma_still_name_the_region():
    c = _nic_host()
    assert c["references"] == [{"from": "rx_ring.descriptors", "to": "memory.packet-buffer-region"}]
    assert [(i["concept"], i["from"], i["to"]) for i in c["interactions"]] == [
        ("dma", "nic", "memory.packet-buffer-region")
    ]


def test_no_mbuf_and_no_buffer_is_instantiated():
    c = _nic_host()
    assert "mbuf" not in c["instances"].values()
    assert not any("buffer" in a for a in c["instances"].values())
    assert not any(i.startswith(("mbuf", "buffer", "packet_buffer")) for i in c["instances"])


def test_the_runtime_copy_carries_the_pool_as_declared():
    runtime = json.loads(RUNTIME.read_text(encoding="utf-8"))
    c = _nic_host()
    for key in ("instances", "placement", "residence", "references", "interactions"):
        assert runtime[key] == c[key], key


def test_residence_is_optional_so_the_contract_must_declare_the_pool_one():
    # The validator does not require a resident asset to declare residence (resides_in allows a
    # parent, it does not demand one); nic_host declares it, and this test holds it to that.
    c = _nic_host()
    del c["residence"]["pool"]
    assert residence_errors(c, ASSETS) == []
    assert "pool" in _nic_host()["residence"]


@pytest.mark.parametrize(
    ("mutate", "error"),
    [
        (
            lambda c: c["instances"].update(pool="cpu"),
            "pool: cpu may not reside in host_memory",
        ),
        (
            lambda c: c["residence"].update(pool="cpu.cache"),
            "pool: mempool may not reside in cpu",
        ),
        (
            lambda c: c["residence"].update(pool="memory.memory_interface"),
            "is a port, not a part of host_memory",
        ),
        (
            lambda c: c["residence"].update(pool="memory.packet-buffers"),
            "is no part of host_memory",
        ),
        (
            lambda c: c["residence"].update(pool_b="memory.packet-buffer-region"),
            "pool_b: not an instance of this composition",
        ),
        (
            lambda c: c["references"].__setitem__(
                0, {"from": "rx_ring.descriptors", "to": "pool.elements"}
            ),
            "descriptor_ring may not refer to mempool",
        ),
        (
            lambda c: c["references"].append(
                {"from": "pool.elements", "to": "memory.packet-buffer-region"}
            ),
            "mempool may not refer to host_memory",
        ),
    ],
    ids=[
        "wrong-pool-asset",
        "wrong-residence-parent",
        "residence-on-a-port",
        "unknown-region",
        "unknown-pool-instance",
        "descriptor-reference-to-pool",
        "pool-refers-to-anything",
    ],
)
def test_nic_host_rejects_a_misplaced_pool(mutate, error):
    c = _nic_host()
    mutate(c)
    errors = residence_errors(c, ASSETS) + reference_errors(c, ASSETS)
    assert any(error in e for e in errors), errors


def test_a_second_pool_would_be_valid_semantically_so_this_contract_holds_one():
    # Two pools are not an error to the validator — a system may have several — so nic_host's
    # single pool is held here, not by the schema.
    c = _nic_host()
    c["instances"]["pool_b"] = "mempool"
    c["placement"]["pool_b"] = {"position": [0, 0, 20], "rotation": [0, 0, 0]}
    c["residence"]["pool_b"] = "memory.packet-buffer-region"
    assert residence_errors(c, ASSETS) == []
    assert list(_nic_host()["instances"].values()).count("mempool") == 1


def test_the_pool_is_never_connected():
    c = _nic_host()
    c["connections"].append(
        {"kind": "route", "a": "pool.elements", "b": "memory.memory_interface", "label": "x"}
    )
    assert "pool.elements: not a port of an instance" in connection_errors(c, ASSETS)


def test_a_prototype_in_nic_host_is_disclosed_as_one():
    # The pool ships inside the released composition while its asset stays a prototype, so the
    # composition must say so (docs/asset-library/README.md §8) — and must not release it.
    page = REPO / "experiences" / "networking" / "nic-host"
    html = (page / "index.html").read_text(encoding="utf-8")
    readme = (page / "README.md").read_text(encoding="utf-8")
    meta = (RUNTIME.parent / "metadata.js").read_text(encoding="utf-8")
    instances = _nic_host()["instances"]
    prototypes = {i: a for i, a in instances.items() if ASSETS[a]["status"] == "prototype"}
    assert prototypes == {"pool": "mempool"}
    for inst, asset in prototypes.items():
        assert "released_in" not in ASSETS[asset]
        assert f"designator: 'Asset · {asset} · prototype'" in meta
        assert re.search(rf'data-part="{inst}">[^<]*</button>[^<]*prototype', html)
        assert f"{asset} asset (`status: prototype`" in readme
    assert ASSETS["mbuf"]["status"] == "prototype"
    assert "mbuf" not in instances.values()
