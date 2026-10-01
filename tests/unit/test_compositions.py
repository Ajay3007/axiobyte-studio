"""Compositions (``assets/compositions/*.yaml``) hold true of the asset registry and the concepts.

A composition names instances of library assets, places them, connects their ports and declares
interactions (docs/asset-library/composition.md). Everything it names is checked here against
``assets/library.yaml`` and the concept library, and its Three.js runtime copy (the contract plus
the registry ports it uses) must be identical to what the two sources say. Regenerate a copy with
``python tests/unit/test_compositions.py``.
"""

from __future__ import annotations

import json
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


def test_there_is_a_composition_and_ids_are_unique():
    ids = [_load(p)["id"] for p in COMPOSITIONS]
    assert ids and len(ids) == len(set(ids))
    assert not set(ids) & set(ASSETS), "a composition is not an asset"


@pytest.mark.parametrize("path", COMPOSITIONS, ids=lambda p: p.stem)
class TestEveryComposition:
    def test_its_file_is_named_by_its_id(self, path):
        assert _load(path)["id"] == path.stem

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
        for link in c["connections"]:
            assert link["kind"] in {"mate", "route"}
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
        c = _load(path)
        concepts = ConceptRegistry.load()
        ports = {p["id"] for a in ASSETS.values() for p in a["ports"]}
        for i in c["interactions"]:
            assert concepts.get(i["concept"]).kind is ConceptKind.INTERACTION
            assert i["concept"] not in ports, "an interaction is never a port"
            for ref in [i["from"], i["to"], *i["via"]]:
                inst, _, part = ref.partition(".")
                assert inst in c["instances"]
                if part:
                    assert part in ASSETS[c["instances"][inst]]["parts"], f"{ref}: no such part"

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


if __name__ == "__main__":
    for p in COMPOSITIONS:
        c = _load(p)
        out = _runtime_path(c)
        out.write_text(json.dumps(runtime_contract(c), indent=2) + "\n", encoding="utf-8")
        sys.stdout.write(f"wrote {out.relative_to(REPO)}\n")
