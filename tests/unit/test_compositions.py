"""Compositions (``assets/compositions/*.yaml``) hold true of the asset registry and the concepts.

A composition names instances of library assets, places them, connects their ports and declares
interactions (docs/asset-library/composition.md). Everything it names is checked here against
``assets/library.yaml`` and the concept library, and its Three.js runtime copy (the contract plus
the registry ports it uses) must be identical to what the two sources say. Regenerate a copy with
``python tests/unit/test_compositions.py``.
"""

from __future__ import annotations

import copy
import json
import re
import sys
from pathlib import Path
from typing import Any

import pytest
import yaml

from axiobyte_studio.concepts import ConceptKind
from axiobyte_studio.concepts.registry import ConceptRegistry

REPO = Path(__file__).resolve().parents[2]
COMPOSITIONS = sorted((REPO / "assets" / "compositions").glob("*.yaml"))
LIBRARY = yaml.safe_load((REPO / "assets" / "library.yaml").read_text(encoding="utf-8"))
ASSETS = {a["id"]: a for a in LIBRARY["assets"]}
AXES = {"+x", "-x", "+y", "-y", "+z", "-z"}
#: The contract's file format (composition.md). `residence` and `references` are optional
#: sections of it.
SCHEMA_VERSION = 1
SECTIONS = {
    "version",
    "id",
    "title",
    "route",
    "instances",
    "placement",
    "connections",
    "interactions",
}
OPTIONAL_SECTIONS = {"residence", "references"}
#: The two kinds of structural connection. Residence and references are neither, and never written
#: as one.
CONNECTION_KINDS = {"mate", "route"}
#: Residence and references name `instance.part`: an instance id, a dot, one name (checked to be a
#: part).
PART_REF = re.compile(r"^([a-z][a-z0-9_]*)\.([a-z][a-z0-9_-]*)$")
#: A reference is exactly these two fields: no address, slot, capacity, owner or transform.
REFERENCE_FIELDS = {"from", "to"}


def _load(path: Path) -> dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def runtime_contract(composition: dict[str, Any]) -> dict[str, Any]:
    """The contract as the Three.js implementation reads it: itself, plus the registry's
    definition of every port its connections use, keyed ``asset.port``."""
    ports = {}
    for c in composition["connections"]:
        for end in (c["a"], c["b"]):
            inst, name = end.split(".")
            asset = composition["instances"][inst]
            [port] = [p for p in ASSETS[asset]["ports"] if p["id"] == name]
            ports[f"{asset}.{name}"] = {k: port[k] for k in ("at", "facing") if k in port}
    return {**composition, "ports": ports}


def _runtime_path(composition: dict[str, Any]) -> Path:
    return REPO / "renderers/three/src/compositions" / composition["id"] / "contract.json"


def _port(composition: dict[str, Any], end: str) -> dict[str, Any]:
    inst, name = end.split(".")
    matches = [p for p in ASSETS[composition["instances"][inst]]["ports"] if p["id"] == name]
    assert matches, f"{end}: no such port on {composition['instances'][inst]}"
    return matches[0]


def section_errors(composition: dict[str, Any]) -> list[str]:
    """The schema version, every required section, and nothing the schema does not define."""
    errors = (
        [] if composition.get("version") == SCHEMA_VERSION else [f"version is not {SCHEMA_VERSION}"]
    )
    errors += [f"missing section {s!r}" for s in sorted(SECTIONS - set(composition))]
    errors += [
        f"unknown section {s!r}" for s in sorted(set(composition) - SECTIONS - OPTIONAL_SECTIONS)
    ]
    return errors


def connection_errors(composition: dict[str, Any], assets: dict[str, Any]) -> list[str]:
    """Each connection is a structural kind joining two `instance.port` ends that exist."""
    errors = []
    for link in composition["connections"]:
        if link.get("kind") not in CONNECTION_KINDS:
            errors.append(
                f"{link.get('kind')!r} is not a connection kind; residence and references have"
                " their own sections"
            )
        for end in (link.get("a"), link.get("b")):
            inst, _, name = str(end).partition(".")
            asset = assets.get(composition["instances"].get(inst, ""))
            if asset is None or name not in {p["id"] for p in asset["ports"]}:
                errors.append(f"{end}: not a port of an instance")
    return errors


def residence_errors(composition: dict[str, Any], assets: dict[str, Any]) -> list[str]:
    """`residence` (optional): child instance → the `instance.part` it resides in.

    Semantic only: where an asset instance lives (a ring in a host-memory region). It places
    nothing, attaches nothing, and is not a connection: it names a part, never a port, and the
    two instances it relates are not also joined structurally.
    """
    residence = composition.get("residence")
    if residence is None:
        return []
    if not isinstance(residence, dict):
        return ["residence maps a child instance to the instance.part it resides in"]
    instances = composition["instances"]
    errors = []
    for child, ref in residence.items():
        if child not in instances:
            errors.append(f"{child}: not an instance of this composition")
            continue
        match = PART_REF.match(ref) if isinstance(ref, str) else None
        if match is None:
            errors.append(f"{child}: {ref!r} is not an instance.part reference")
            continue
        parent, part = match.groups()
        if parent == child:
            errors.append(f"{child}: an instance cannot reside in itself")
            continue
        if parent not in instances:
            errors.append(f"{child}: {parent!r} is not an instance of this composition")
            continue
        parent_asset = assets[instances[parent]]
        if part not in parent_asset["parts"]:
            ports = {p["id"] for p in parent_asset["ports"]}
            kind = "a port, not a part" if part in ports else "no part"
            errors.append(f"{child}: {parent}.{part} is {kind} of {instances[parent]}")
        allowed = assets[instances[child]].get("resides_in", [])
        if instances[parent] not in allowed:
            errors.append(f"{child}: {instances[child]} may not reside in {instances[parent]}")
        for link in composition["connections"]:
            ends = {str(link.get(k)).partition(".")[0] for k in ("a", "b")}
            if ends == {child, parent}:
                errors.append(f"{child}: also connected to {parent}; residence is not a connection")
    return errors


def interaction_errors(
    composition: dict[str, Any], assets: dict[str, Any], concepts: ConceptRegistry
) -> list[str]:
    """Each interaction is an interaction concept — never a port, and never a reference or a
    residence written as one — between this composition's instances and their parts."""
    errors = []
    ports = {p["id"] for a in assets.values() for p in a["ports"]}
    for i in composition["interactions"]:
        name = i.get("concept")
        if name not in concepts or concepts.get(name).kind is not ConceptKind.INTERACTION:
            errors.append(f"{name!r} is not an interaction concept")
        if name in ports:
            errors.append(f"{name!r}: an interaction is never a port")
        for ref in [i.get("from"), i.get("to"), *i.get("via", [])]:
            inst, _, part = str(ref).partition(".")
            if inst not in composition["instances"]:
                errors.append(f"{ref}: not an instance of this composition")
            elif part and part not in assets[composition["instances"][inst]]["parts"]:
                errors.append(f"{ref}: no such part")
    return errors


def reference_errors(composition: dict[str, Any], assets: dict[str, Any]) -> list[str]:
    """`references` (optional): a part of one instance holds references to what a part of another
    instance represents — the descriptors of a ring refer to buffers in a host-memory region.

    Static and aggregate: which descriptor names which buffer is runtime state, not declared here.
    It is not ownership, allocation, residence, attachment, DMA or a drawn link; it names parts,
    never ports, and the source asset's `refers_to` must allow the target asset.
    """
    references = composition.get("references")
    if references is None:
        return []
    if not isinstance(references, list):
        return ["references is a list of {from, to} entries"]
    instances = composition["instances"]
    errors: list[str] = []
    seen = set()
    for n, ref in enumerate(references):
        where = f"references[{n}]"
        if not isinstance(ref, dict):
            errors.append(f"{where}: not a {{from, to}} entry")
            continue
        missing = sorted(REFERENCE_FIELDS - set(ref))
        errors += [f"{where}: missing {f!r}" for f in missing]
        errors += [
            f"{where}: unknown field {f!r}; a reference is only from and to"
            for f in sorted(set(ref) - REFERENCE_FIELDS)
        ]
        if missing:
            continue
        ends = {}
        for key in ("from", "to"):
            match = PART_REF.match(ref[key]) if isinstance(ref[key], str) else None
            if match is None:
                errors.append(f"{where}.{key}: {ref[key]!r} is not an instance.part reference")
                continue
            inst, part = match.groups()
            if inst not in instances:
                errors.append(f"{where}.{key}: {inst!r} is not an instance of this composition")
                continue
            asset = assets[instances[inst]]
            if part not in asset["parts"]:
                kind = (
                    "a port, not a part" if part in {p["id"] for p in asset["ports"]} else "no part"
                )
                errors.append(f"{where}.{key}: {inst}.{part} is {kind} of {instances[inst]}")
                continue
            ends[key] = inst
        if len(ends) < 2:
            continue
        source, target = ends["from"], ends["to"]
        if source == target:
            errors.append(f"{where}: {source} cannot refer to itself")
            continue
        if instances[target] not in assets[instances[source]].get("refers_to", []):
            errors.append(f"{where}: {instances[source]} may not refer to {instances[target]}")
        if (ref["from"], ref["to"]) in seen:
            errors.append(f"{where}: {ref['from']} → {ref['to']} is declared twice")
        seen.add((ref["from"], ref["to"]))
    return errors


def test_there_is_a_composition_and_ids_are_unique():
    ids = [_load(p)["id"] for p in COMPOSITIONS]
    assert ids and len(ids) == len(set(ids))
    assert not set(ids) & set(ASSETS), "a composition is not an asset"


@pytest.mark.parametrize("path", COMPOSITIONS, ids=lambda p: p.stem)
class TestEveryComposition:
    def test_its_file_is_named_by_its_id(self, path):
        assert _load(path)["id"] == path.stem

    def test_it_is_written_to_the_schema_with_no_unknown_section(self, path):
        assert section_errors(_load(path)) == []

    def test_its_instances_are_registry_assets_each_placed_explicitly(self, path):
        c = _load(path)
        assert set(c["instances"].values()) <= set(ASSETS)
        assert set(c["placement"]) == set(c["instances"]), "place every instance, and only them"
        for place in c["placement"].values():
            assert set(place) == {"position", "rotation"}, "position and rotation only; scale is 1"
            assert all(len(place[k]) == 3 for k in place)
            assert all(isinstance(v, int | float) for k in place for v in place[k])

    def test_its_connections_join_real_ports_that_answer_each_other(self, path):
        c = _load(path)
        assert connection_errors(c, ASSETS) == []
        for link in c["connections"]:
            a, b = _port(c, link["a"]), _port(c, link["b"])
            asset_a = c["instances"][link["a"].split(".")[0]]
            asset_b = c["instances"][link["b"].split(".")[0]]
            # Each side names the other, or is deliberately generic (a slot takes any card).
            assert a.get("connects_to", asset_b) == asset_b
            assert b.get("connects_to", asset_a) == asset_a

    def test_mates_touch_one_to_one_and_face_each_other(self, path):
        c = _load(path)
        for link in (x for x in c["connections"] if x["kind"] == "mate"):
            a, b = _port(c, link["a"]), _port(c, link["b"])
            assert len(a["at"]) == len(b["at"]) == 1, "a mate joins one anchor to one"
            assert a.get("facing") in AXES, "a mated port declares its facing"
            assert b.get("facing") in AXES, "a mated port declares its facing"
            assert link.get("gap", 0) >= 0

    def test_routes_follow_the_many_to_one_rule_and_are_labelled(self, path):
        c = _load(path)
        for link in (x for x in c["connections"] if x["kind"] == "route"):
            na, nb = len(_port(c, link["a"])["at"]), len(_port(c, link["b"])["at"])
            assert na == nb or 1 in (na, nb), f"{na} anchors cannot meet {nb}"
            assert link["label"]

    def test_interactions_are_interaction_concepts_between_its_instances(self, path):
        assert interaction_errors(_load(path), ASSETS, ConceptRegistry.load()) == []

    def test_its_residences_name_allowed_parts_of_its_instances(self, path):
        assert residence_errors(_load(path), ASSETS) == []

    def test_its_references_name_allowed_parts_of_its_instances(self, path):
        assert reference_errors(_load(path), ASSETS) == []

    def test_its_page_exists_under_a_declared_domain(self, path):
        c = _load(path)
        domain, _ = c["route"].split("/")
        domains = json.loads((REPO / "experiences" / "domains.json").read_text(encoding="utf-8"))
        assert domain in domains
        page = REPO / "experiences" / c["route"]
        assert (page / "index.html").is_file() and (page / "experience.json").is_file()

    def test_its_runtime_copy_is_the_contract_and_the_registry(self, path):
        c = _load(path)
        runtime = json.loads(_runtime_path(c).read_text(encoding="utf-8"))
        assert runtime == runtime_contract(c), "regenerate: python tests/unit/test_compositions.py"


# ------------------------------------------------------------- residence, mutated
# A test-only resident asset and composition, held in memory: no registry entry, contract or
# renderer is created. `host_memory` and `cpu` are the real registry entries.

_RESIDENT = {"id": "test_resident", "parts": ["body"], "ports": [], "resides_in": ["host_memory"]}


def _fixture(residence: Any = None, **asset_changes: Any) -> tuple[dict[str, Any], dict[str, Any]]:
    composition = {
        "version": SCHEMA_VERSION,
        "id": "test_residence",
        "title": "Residence fixture",
        "route": "memory/test-residence",
        "instances": {"memory": "host_memory", "cpu": "cpu", "rx_ring": "test_resident"},
        "placement": {
            i: {"position": [0, 0, 0], "rotation": [0, 0, 0]} for i in ("memory", "cpu", "rx_ring")
        },
        "connections": [
            {
                "kind": "route",
                "a": "cpu.memory_interface",
                "b": "memory.memory_interface",
                "label": "memory channels",
            }
        ],
        "interactions": [],
    }
    if residence is not None:
        composition["residence"] = residence
    return composition, {**ASSETS, "test_resident": {**copy.deepcopy(_RESIDENT), **asset_changes}}


def test_a_valid_residence_names_an_allowed_part_of_another_instance():
    composition, assets = _fixture({"rx_ring": "memory.descriptor-region"})
    assert residence_errors(composition, assets) == []
    assert connection_errors(composition, assets) == []


@pytest.mark.parametrize(
    ("residence", "error"),
    [
        ({"tx_ring": "memory.descriptor-region"}, "tx_ring: not an instance"),
        ({"rx_ring": "dram.descriptor-region"}, "'dram' is not an instance"),
        ({"rx_ring": "memory.descriptor-ring"}, "memory.descriptor-ring is no part of host_memory"),
        ({"rx_ring": "cpu.cache"}, "test_resident may not reside in cpu"),
        ({"rx_ring": "rx_ring.body"}, "cannot reside in itself"),
        ({"rx_ring": "memory"}, "is not an instance.part reference"),
        ({"rx_ring": "memory.descriptor-region.head"}, "is not an instance.part reference"),
        (
            {"rx_ring": {"parent": "memory", "part": "descriptor-region"}},
            "is not an instance.part reference",
        ),
        (["rx_ring", "memory.descriptor-region"], "residence maps a child instance"),
    ],
    ids=[
        "unknown-child",
        "unknown-parent",
        "unknown-part",
        "parent-not-allowed",
        "self",
        "no-part",
        "anchor",
        "mapping",
        "not-a-map",
    ],
)
def test_an_invalid_residence_is_rejected(residence, error):
    composition, assets = _fixture(residence)
    errors = residence_errors(composition, assets)
    assert any(error in e for e in errors), errors


def test_an_asset_without_resides_in_may_not_reside_anywhere():
    composition, assets = _fixture({"rx_ring": "memory.descriptor-region"})
    del assets["test_resident"]["resides_in"]
    assert residence_errors(composition, assets) == [
        "rx_ring: test_resident may not reside in host_memory"
    ]


def test_residence_names_a_part_never_a_port():
    composition, assets = _fixture({"rx_ring": "memory.memory_interface"})
    assert residence_errors(composition, assets) == [
        "rx_ring: memory.memory_interface is a port, not a part of host_memory"
    ]


def test_residence_is_never_written_as_a_connection():
    composition, assets = _fixture()
    composition["connections"].append(
        {"kind": "residence", "a": "rx_ring.body", "b": "memory.descriptor-region"}
    )
    errors = connection_errors(composition, assets)
    assert (
        "'residence' is not a connection kind; residence and references have their own sections"
        in errors
    )
    assert "rx_ring.body: not a port of an instance" in errors


def test_a_resident_is_not_also_connected_to_its_parent():
    composition, assets = _fixture(
        {"rx_ring": "memory.descriptor-region"}, ports=[{"id": "host", "at": ["body.center"]}]
    )
    composition["connections"].append(
        {"kind": "route", "a": "rx_ring.host", "b": "memory.memory_interface", "label": "x"}
    )
    assert residence_errors(composition, assets) == [
        "rx_ring: also connected to memory; residence is not a connection"
    ]


def test_an_unknown_section_is_caught_so_a_misspelt_residence_is_not_ignored():
    composition, _ = _fixture()
    assert section_errors(composition) == []
    composition["residense"] = {"rx_ring": "memory.descriptor-region"}
    assert section_errors(composition) == ["unknown section 'residense'"]


def test_the_runtime_copy_carries_residence_unchanged():
    composition, _ = _fixture({"rx_ring": "memory.descriptor-region"})
    runtime = json.loads(json.dumps(runtime_contract(composition)))
    assert runtime["residence"] == {"rx_ring": "memory.descriptor-region"}
    assert "rx_ring" not in {
        end.split(".")[0] for c in runtime["connections"] for end in (c["a"], c["b"])
    }


# ------------------------------------------------------------ references, mutated
# A test-only source asset standing in for the future descriptor ring: its `descriptors` part
# refers to buffers in the real host_memory's packet-buffer-region. Held in memory only; no
# registry entry, contract or renderer is created.

_SOURCE = {
    "id": "test_reference_source",
    "parts": ["descriptors"],
    "ports": [],
    "refers_to": ["host_memory"],
}
_DESCRIPTORS_TO_BUFFERS = {"from": "rx_ring.descriptors", "to": "memory.packet-buffer-region"}


def _reference_fixture(
    references: Any = None, **asset_changes: Any
) -> tuple[dict[str, Any], dict[str, Any]]:
    composition, assets = _fixture()
    composition["id"] = "test_references"
    composition["instances"]["rx_ring"] = "test_reference_source"
    if references is not None:
        composition["references"] = references
    return composition, {
        **assets,
        "test_reference_source": {**copy.deepcopy(_SOURCE), **asset_changes},
    }


@pytest.fixture(scope="module")
def concepts() -> ConceptRegistry:
    return ConceptRegistry.load()


def test_a_valid_reference_names_a_part_of_an_allowed_target():
    composition, assets = _reference_fixture([dict(_DESCRIPTORS_TO_BUFFERS)])
    assert reference_errors(composition, assets) == []
    assert section_errors(composition) == []
    assert connection_errors(composition, assets) == []


def test_references_are_optional():
    composition, assets = _reference_fixture()
    assert "references" not in composition
    assert reference_errors(composition, assets) == []


def test_a_reference_needs_no_port():
    composition, assets = _reference_fixture([dict(_DESCRIPTORS_TO_BUFFERS)])
    assert assets["test_reference_source"]["ports"] == []
    assert reference_errors(composition, assets) == []


def test_a_ring_resides_in_one_region_and_refers_to_another():
    composition, assets = _reference_fixture(
        [dict(_DESCRIPTORS_TO_BUFFERS)], resides_in=["host_memory"]
    )
    composition["residence"] = {"rx_ring": "memory.descriptor-region"}
    assert residence_errors(composition, assets) == []
    assert reference_errors(composition, assets) == []


@pytest.mark.parametrize(
    ("reference", "error"),
    [
        (
            {"from": "tx_ring.descriptors", "to": "memory.packet-buffer-region"},
            "references[0].from: 'tx_ring' is not an instance",
        ),
        (
            {"from": "rx_ring.descriptors", "to": "dram.packet-buffer-region"},
            "references[0].to: 'dram' is not an instance",
        ),
        (
            {"from": "rx_ring.slots", "to": "memory.packet-buffer-region"},
            "references[0].from: rx_ring.slots is no part of test_reference_source",
        ),
        (
            {"from": "rx_ring.descriptors", "to": "memory.packet-buffers"},
            "references[0].to: memory.packet-buffers is no part of host_memory",
        ),
        (
            {"from": "rx_ring.descriptors", "to": "memory.memory_interface"},
            "references[0].to: memory.memory_interface is a port, not a part of host_memory",
        ),
        (
            {"from": "rx_ring.descriptors", "to": "cpu.cache"},
            "references[0]: test_reference_source may not refer to cpu",
        ),
        (
            {"from": "rx_ring.descriptors", "to": "rx_ring.descriptors"},
            "references[0]: rx_ring cannot refer to itself",
        ),
        ({"to": "memory.packet-buffer-region"}, "references[0]: missing 'from'"),
        ({"from": "rx_ring.descriptors"}, "references[0]: missing 'to'"),
        (
            {"from": "rx_ring", "to": "memory.packet-buffer-region"},
            "references[0].from: 'rx_ring' is not an instance.part reference",
        ),
        (
            {"from": "rx_ring.descriptors", "to": "memory.packet-buffer-region.buffer"},
            "is not an instance.part reference",
        ),
        (["rx_ring.descriptors", "memory.packet-buffer-region"], "not a {from, to} entry"),
    ],
    ids=[
        "unknown-source-instance",
        "unknown-target-instance",
        "unknown-source-part",
        "unknown-target-part",
        "target-is-a-port",
        "target-not-allowed",
        "self",
        "missing-from",
        "missing-to",
        "no-part",
        "anchor",
        "not-a-mapping",
    ],
)
def test_an_invalid_reference_is_rejected(reference, error):
    composition, assets = _reference_fixture([reference])
    errors = reference_errors(composition, assets)
    assert any(error in e for e in errors), errors


@pytest.mark.parametrize(
    "field",
    [
        "address", "slot", "index", "capacity", "ownership", "allocation",
        "lifetime", "queue", "dma", "position", "anchor", "transform",
    ],
)  # fmt: skip
def test_a_reference_carries_nothing_but_from_and_to(field):
    composition, assets = _reference_fixture([{**_DESCRIPTORS_TO_BUFFERS, field: 1}])
    assert reference_errors(composition, assets) == [
        f"references[0]: unknown field {field!r}; a reference is only from and to"
    ]


def test_references_are_a_list_and_each_is_declared_once():
    composition, assets = _reference_fixture({"rx_ring.descriptors": "memory.packet-buffer-region"})
    assert reference_errors(composition, assets) == ["references is a list of {from, to} entries"]
    composition, assets = _reference_fixture([dict(_DESCRIPTORS_TO_BUFFERS)] * 2)
    assert reference_errors(composition, assets) == [
        "references[1]: rx_ring.descriptors → memory.packet-buffer-region is declared twice"
    ]


def test_an_asset_without_refers_to_may_not_refer_to_anything():
    composition, assets = _reference_fixture([dict(_DESCRIPTORS_TO_BUFFERS)])
    del assets["test_reference_source"]["refers_to"]
    assert reference_errors(composition, assets) == [
        "references[0]: test_reference_source may not refer to host_memory"
    ]


def test_a_reference_is_never_written_as_a_connection():
    composition, assets = _reference_fixture()
    composition["connections"].append({"kind": "references", **_DESCRIPTORS_TO_BUFFERS})
    errors = connection_errors(composition, assets)
    assert (
        "'references' is not a connection kind; residence and references have their own sections"
        in errors
    )
    assert "None: not a port of an instance" in errors


def test_a_reference_is_never_written_as_a_residence():
    # refers_to allows a reference, not residence: the two capabilities are separate.
    composition, assets = _reference_fixture()
    composition["residence"] = {"rx_ring": "memory.packet-buffer-region"}
    assert residence_errors(composition, assets) == [
        "rx_ring: test_reference_source may not reside in host_memory"
    ]


@pytest.mark.parametrize("concept", ["pointer", "references"])
def test_a_reference_is_never_written_as_an_interaction(concept, concepts):
    composition, assets = _reference_fixture()
    composition["interactions"].append(
        {"concept": concept, "from": "rx_ring", "to": "memory.packet-buffer-region", "via": []}
    )
    assert interaction_errors(composition, assets, concepts) == [
        f"{concept!r} is not an interaction concept"
    ]


def test_an_unknown_section_is_caught_so_a_misspelt_references_is_not_ignored():
    composition, _ = _reference_fixture()
    composition["refrences"] = [dict(_DESCRIPTORS_TO_BUFFERS)]
    assert section_errors(composition) == ["unknown section 'refrences'"]


def test_the_runtime_copy_carries_references_unchanged():
    composition, _ = _reference_fixture([dict(_DESCRIPTORS_TO_BUFFERS)])
    runtime = json.loads(json.dumps(runtime_contract(composition)))
    assert runtime["references"] == [
        {"from": "rx_ring.descriptors", "to": "memory.packet-buffer-region"}
    ]
    assert runtime["ports"] == runtime_contract(_fixture()[0])["ports"]  # no ports added


if __name__ == "__main__":
    for p in COMPOSITIONS:
        c = _load(p)
        out = _runtime_path(c)
        out.write_text(json.dumps(runtime_contract(c), indent=2) + "\n", encoding="utf-8")
        sys.stdout.write(f"wrote {out.relative_to(REPO)}\n")
