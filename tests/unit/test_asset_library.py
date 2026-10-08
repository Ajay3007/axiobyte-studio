"""The Asset Library registry (``assets/library.yaml``) holds true of the repository.

The registry is only worth having if it cannot drift: every id, route, part, port and path it
names is checked here against the code, the concept library and the experiences it points at.
The standard these rules come from is ``docs/asset-library/README.md``.
"""

from __future__ import annotations

import ast
import copy
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
#: Every field an entry may carry: the required ones and the optional ones. Anything else is a
#: misspelling, which would otherwise be ignored silently.
KNOWN = REQUIRED | REQUIRED_PUBLISHED | {"released_in", "resides_in", "refers_to"}
PORT_FIELDS = {"id", "at", "facing", "connects_to"}
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


def field_errors(asset: dict[str, Any]) -> list[str]:
    """Fields the standard does not define, on the entry or on its ports."""
    errors = [f"unknown field {f!r}" for f in sorted(set(asset) - KNOWN)]
    for port in asset.get("ports", []):
        errors += [
            f"port {port.get('id')!r}: unknown field {f!r}" for f in sorted(set(port) - PORT_FIELDS)
        ]
    return errors


def _allowed_assets_errors(asset: dict[str, Any], field: str, asset_ids: set[str]) -> list[str]:
    """An optional list of registry asset ids: non-empty, known, each named once."""
    if field not in asset:
        return []
    allowed = asset[field]
    if not isinstance(allowed, list) or not allowed or not all(isinstance(a, str) for a in allowed):
        return [f"{field} is a non-empty list of asset ids"]
    errors = [
        f"{field} names {a!r}, which is not a registry asset" for a in allowed if a not in asset_ids
    ]
    if len(allowed) != len(set(allowed)):
        errors.append(f"{field} names an asset twice")
    return errors


def resides_in_errors(asset: dict[str, Any], asset_ids: set[str]) -> list[str]:
    """``resides_in``, when declared: the registry assets an instance of this asset may reside in
    (docs/asset-library/composition.md, Residence) — allowed parents, not a requirement."""
    return _allowed_assets_errors(asset, "resides_in", asset_ids)


def refers_to_errors(asset: dict[str, Any], asset_ids: set[str]) -> list[str]:
    """``refers_to``, when declared: the registry assets this asset's parts may hold references
    to (docs/asset-library/composition.md, References) — allowed targets; it creates no reference
    and requires none."""
    return _allowed_assets_errors(asset, "refers_to", asset_ids)


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

    def test_it_declares_no_field_the_standard_does_not_define(self, asset):
        assert field_errors(asset) == []

    def test_its_allowed_parents_are_registry_assets(self, asset):
        assert resides_in_errors(asset, {a["id"] for a in ASSETS}) == []

    def test_its_allowed_reference_targets_are_registry_assets(self, asset):
        assert refers_to_errors(asset, {a["id"] for a in ASSETS}) == []

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

    def test_an_unpublished_asset_has_no_page_of_its_own(self, asset):
        # A prototype may appear inside a released composition, disclosed there, but it is never
        # given a route or a page of its own (docs/asset-library/README.md §8).
        if asset["status"] in PUBLISHED:
            return
        assert not {"route", "experience", "released_in"} & set(asset)
        slug = _slug(asset["id"])
        assert not list((REPO / "experiences").glob(f"*/{slug}/index.html"))

    def test_its_page_states_the_status_the_registry_records(self, asset):
        if asset["status"] not in PUBLISHED:
            return
        html = (REPO / asset["experience"] / "index.html").read_text(encoding="utf-8")
        stated = re.search(r"<dt>Status</dt><dd>([^<]*)</dd>", html)
        if stated is None:
            return  # the page has no asset block (the NIC's)
        if asset["status"] == "released":
            version = asset["released_in"].removeprefix("experiences-v")
            expected = f"released in experiences v{version} · {asset['quality']}"
        else:
            expected = f"{asset['status']} · {asset['quality']}"
        assert stated.group(1) == expected

    def test_it_was_released_no_later_than_the_experiences_package(self, asset):
        if "released_in" not in asset:
            return
        package = json.loads((REPO / "experiences" / "package.json").read_text(encoding="utf-8"))
        shipped = asset["released_in"].removeprefix("experiences-v")
        as_tuple = lambda v: tuple(int(n) for n in v.split("."))  # noqa: E731
        assert as_tuple(shipped) <= as_tuple(package["version"])

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


# ------------------------------------------------------------------ the field rules, mutated
# In-memory copies of a real entry, changed one way each; nothing here is written to the registry.


def _entry(**changes: Any) -> dict[str, Any]:
    asset = copy.deepcopy(next(a for a in ASSETS if a["id"] == "nic"))
    asset.update(changes)
    return asset


def test_a_valid_resides_in_is_accepted():
    asset = _entry(resides_in=["host_memory"])
    assert field_errors(asset) == []
    assert resides_in_errors(asset, {a["id"] for a in ASSETS}) == []


def test_a_misspelt_resides_in_is_rejected_not_ignored():
    assert field_errors(_entry(reside_in=["host_memory"])) == ["unknown field 'reside_in'"]


def test_a_misspelt_port_field_is_rejected():
    asset = _entry()
    asset["ports"][1]["facng"] = asset["ports"][1].pop("facing")
    assert field_errors(asset) == ["port 'pcie_connector': unknown field 'facng'"]


@pytest.mark.parametrize(
    "parents",
    [[], "host_memory", [None], ["no_such_asset"], ["host_memory", "host_memory"]],
    ids=["empty", "not-a-list", "not-an-id", "unknown-asset", "duplicate"],
)
def test_a_malformed_resides_in_is_rejected(parents):
    assert resides_in_errors(_entry(resides_in=parents), {a["id"] for a in ASSETS})


def test_a_valid_refers_to_is_accepted_and_absent_is_fine():
    ids = {a["id"] for a in ASSETS}
    asset = _entry(refers_to=["host_memory"])
    assert field_errors(asset) == [] and refers_to_errors(asset, ids) == []
    assert refers_to_errors(_entry(), ids) == []


def test_a_misspelt_refers_to_is_rejected_not_ignored():
    assert field_errors(_entry(refer_to=["host_memory"])) == ["unknown field 'refer_to'"]


@pytest.mark.parametrize(
    ("targets", "error"),
    [
        ([], "refers_to is a non-empty list of asset ids"),
        ("host_memory", "refers_to is a non-empty list of asset ids"),
        (["no_such_asset"], "refers_to names 'no_such_asset', which is not a registry asset"),
        (["host_memory", "host_memory"], "refers_to names an asset twice"),
    ],
    ids=["empty", "not-a-list", "unknown-asset", "duplicate"],
)
def test_a_malformed_refers_to_is_rejected(targets, error):
    assert refers_to_errors(_entry(refers_to=targets), {a["id"] for a in ASSETS}) == [error]
