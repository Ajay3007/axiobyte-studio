"""The Asset Library registry (``assets/library.yaml``) holds true of the repository.

The registry is only worth having if it cannot drift: every id, route, part, port and path it
names is checked here against the code, the concept library and the experiences it points at.
The standard these rules come from is ``docs/asset-library/README.md``.
"""

from __future__ import annotations

import ast
import json
import re
from pathlib import Path
from typing import Any

import pytest
import yaml

from axiobyte_studio import actors
from axiobyte_studio.actors.base import ActorDefinition
from axiobyte_studio.concepts.registry import ConceptRegistry

REPO = Path(__file__).resolve().parents[2]
LIBRARY = REPO / "assets" / "library.yaml"

STATUSES = {"concept", "prototype", "production", "released", "deprecated"}
QUALITIES = {"hero", "standard", "micro"}
FIDELITIES = {"flat", "iso", "plate", "live"}
RENDERERS = {"three", "manim", "blender"}
#: The fields every entry carries (docs/asset-library/README.md §9), and those a page adds.
REQUIRED = {
    "id", "title", "summary", "version", "status", "quality", "concept",
    "parts", "ports", "implementations", "episodes", "known_limitations",
}  # fmt: skip
REQUIRED_PUBLISHED = {"route", "experience"}
#: A port's facing (docs/asset-library/composition.md): a signed axis of the asset's own frame.
AXES = {"+x", "-x", "+y", "-y", "+z", "-z"}
#: An asset with a public page, and therefore a route, a domain and an experience.
PUBLISHED = {"production", "released", "deprecated"}

ID = re.compile(r"^[a-z][a-z0-9]*(_[a-z0-9]+)*$")
SLUG = re.compile(r"^[a-z][a-z0-9]*(-[a-z0-9]+)*$")
SEMVER = re.compile(r"^\d+\.\d+\.\d+$")


def _library() -> dict[str, Any]:
    with LIBRARY.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


ASSETS: list[dict[str, Any]] = _library()["assets"]


def _slug(asset_id: str) -> str:
    return asset_id.replace("_", "-")


def _episodes_using(asset: dict[str, Any]) -> set[str]:
    """The episodes that render one of the asset's implementations, read from their code.

    A Manim episode uses the asset when its shots import the asset's actor; a Three.js episode
    when its scene imports from the asset's Three.js domain. An episode that only assumes the
    asset's concept, or names it in a caption, does not use the asset.
    """
    actor = asset["implementations"].get("manim", {}).get("actor")
    constants = {
        name
        for name in dir(actors)
        if isinstance(getattr(actors, name), ActorDefinition)
        and getattr(actors, name).concept == actor
    }
    used = _three_episodes(asset)
    for episode in (REPO / "episodes").iterdir():
        for shot in episode.glob("shots/*.py"):
            tree = ast.parse(shot.read_text(encoding="utf-8"))
            imported = {
                alias.name
                for node in ast.walk(tree)
                if isinstance(node, ast.ImportFrom) and node.module == "axiobyte_studio.actors"
                for alias in node.names
            }
            if imported & constants:
                used.add(episode.name)
    return used


def _three_episodes(asset: dict[str, Any]) -> set[str]:
    """The episodes whose Three.js scene imports from the asset's Three.js domain."""
    three = asset["implementations"].get("three")
    if three is None:
        return set()
    domain = "@axiobyte/three/" + three["path"].removeprefix("renderers/three/src/") + "/"
    return {
        episode.name
        for episode in (REPO / "episodes").iterdir()
        if any(domain in js.read_text(encoding="utf-8") for js in episode.glob("three/**/*.js"))
    }


@pytest.fixture(scope="module")
def concepts() -> set[str]:
    return set(ConceptRegistry.load().ids)


def test_the_registry_has_a_schema_version_and_unique_ids():
    library = _library()
    assert library["version"] == 1
    ids = [a["id"] for a in ASSETS]
    assert len(ids) == len(set(ids)), "asset ids must be unique"


@pytest.mark.parametrize("asset", ASSETS, ids=lambda a: a["id"])
class TestEveryAsset:
    def test_it_declares_every_field_the_standard_requires(self, asset: dict[str, Any]):
        required = REQUIRED | (REQUIRED_PUBLISHED if asset["status"] in PUBLISHED else set())
        assert not required - set(asset), f"missing: {sorted(required - set(asset))}"
        assert asset["parts"] and asset["known_limitations"]

    def test_its_parts_and_ports_are_well_formed(self, asset):
        parts = asset["parts"]
        assert len(parts) == len(set(parts)), "part ids must be unique"
        assert all(SLUG.match(p) for p in parts), "part ids are kebab-case"
        ports = [p["id"] for p in asset["ports"]]
        assert len(ports) == len(set(ports)), "port ids must be unique"
        assert all(p["at"] for p in asset["ports"]), "every port attaches somewhere"
        for p in asset["ports"]:
            assert p.get("facing", "+x") in AXES, f"{p['id']}: facing is a signed axis"

    def test_identity(self, asset: dict[str, Any]):
        assert ID.match(asset["id"]), "ids are snake_case, like concept ids"
        assert SEMVER.match(asset["version"])
        assert asset["status"] in STATUSES
        assert asset["quality"] in QUALITIES
        assert asset["title"] and asset["summary"]

    def test_it_names_the_release_that_shipped_it_exactly_when_released(self, asset):
        shipped = asset.get("released_in")
        assert (shipped is not None) == (asset["status"] == "released")
        if shipped:
            assert re.match(r"^experiences-v\d+\.\d+\.\d+$", shipped)

    def test_it_realises_a_concept_the_knowledge_model_defines(self, asset, concepts):
        assert asset["concept"] in concepts

    def test_its_route_is_the_slug_of_its_id_under_a_declared_domain(self, asset):
        if asset["status"] not in PUBLISHED:
            return
        domain, slug = asset["route"].split("/")
        assert SLUG.match(domain) and slug == _slug(asset["id"])
        domains = json.loads((REPO / "experiences" / "domains.json").read_text(encoding="utf-8"))
        assert domain in domains, f"route domain {domain!r} is not in experiences/domains.json"

    def test_a_published_asset_has_its_own_page(self, asset):
        if asset["status"] not in PUBLISHED:
            return
        page = REPO / asset["experience"]
        assert asset["experience"] == f"experiences/{asset['route']}"
        assert (page / "index.html").is_file() and (page / "experience.json").is_file()

    def test_every_implementation_exists_and_declares_a_known_fidelity(self, asset):
        for renderer, impl in asset["implementations"].items():
            assert renderer in RENDERERS, f"unknown renderer {renderer!r}"
            assert (REPO / impl["path"]).exists(), f"{renderer}: {impl['path']} is missing"
            assert impl["fidelity"] in FIDELITIES

    def test_its_renderer_entry_points_exist(self, asset):
        impls = asset["implementations"]
        if "three" in impls:
            three = impls["three"]
            for key in ("entry", "metadata"):
                assert (REPO / three["path"] / three[key]).is_file(), f"three.{key} is missing"
            assert "overview" in three["presets"], "the overview preset is mandatory"
        if "manim" in impls:
            assert impls["manim"]["actor"] in actors.LIBRARY, "the Manim actor must exist"

    def test_every_part_has_metadata_in_the_three_implementation(self, asset):
        three = asset["implementations"].get("three")
        if three is None:
            return
        source = (REPO / three["path"] / three["metadata"]).read_text(encoding="utf-8")
        for part in asset["parts"]:
            key = re.compile(rf"^\s*['\"]?{re.escape(part)}['\"]?\s*:\s*\{{", re.MULTILINE)
            assert key.search(source), f"part {part!r} has no metadata entry"

    def test_ports_attach_to_declared_parts_and_connect_to_known_things(self, asset, concepts):
        parts = set(asset["parts"])
        known = concepts | {a["id"] for a in ASSETS}
        three = asset["implementations"].get("three")
        sources = (
            "\n".join(p.read_text(encoding="utf-8") for p in (REPO / three["path"]).glob("*.js"))
            if three
            else ""
        )
        for port in asset["ports"]:
            assert ID.match(port["id"])
            assert port.get("connects_to", asset["id"]) in known, "connects_to must be known"
            for ref in port["at"]:
                part, anchor = ref.split(".")
                assert part in parts, f"port {port['id']} names unknown part {part!r}"
                if three:
                    assert re.search(rf"\b{re.escape(anchor)}\s*:\s*new THREE\.Vector3", sources), (
                        f"no part in the Three.js implementation defines an anchor {anchor!r}"
                    )

    def test_every_episode_it_names_exists(self, asset):
        for episode in asset["episodes"]:
            assert (REPO / "episodes" / episode / "episode.yaml").is_file()

    def test_its_page_names_only_an_episode_it_is_the_interactive_side_of(self, asset):
        # experience.json's `episode` tells the website which film the page is the interactive
        # side of: one rendering this asset's own Three.js scene — not any film that uses it.
        if asset["status"] not in PUBLISHED:
            return
        page = json.loads((REPO / asset["experience"] / "experience.json").read_text("utf-8"))
        if "episode" in page:
            assert page["episode"] in asset["episodes"]
            assert page["episode"] in _three_episodes(asset), "not this page's scene"

    def test_its_asset_ports_are_answered_by_the_counterpart(self, asset):
        # A composition joins ports in pairs. When a port names another asset, that asset must
        # have a port naming it back, or one that deliberately names no counterpart (a PCIe slot's
        # endpoint takes any card).
        by_id = {a["id"]: a for a in ASSETS}
        for port in asset["ports"]:
            other = by_id.get(port.get("connects_to", ""))
            if other is None:
                continue
            answers = [p.get("connects_to") for p in other["ports"]]
            assert asset["id"] in answers or None in answers, (
                f"{asset['id']}.{port['id']} names {other['id']}, which has no port for it"
            )

    def test_it_lists_exactly_the_episodes_that_render_it(self, asset):
        # The reverse index ARCHITECTURE.md's asset rules need: complete, and nothing more.
        assert set(asset["episodes"]) == _episodes_using(asset)
