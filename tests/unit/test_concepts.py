from __future__ import annotations

from pathlib import Path

import pytest

from axiobyte_studio.actions import Scene
from axiobyte_studio.actors import CPU, MBUF, MEMORY_BUFFER, NIC, PACKET, POINTER, Salience
from axiobyte_studio.concepts import (
    REQUIRED_INTERACTION_BLOCKS,
    CompositeConcept,
    ConceptKind,
    ConceptRegistry,
    Depth,
    InteractionConcept,
    concept,
    registry,
)
from axiobyte_studio.core import ConceptError
from axiobyte_studio.design import visual_language


class TestTheShippedSDK:
    def test_loads_and_validates(self):
        assert len(registry()) > 0

    def test_populates_all_three_kinds(self):
        for kind in ConceptKind:
            assert registry().of_kind(kind), f"no {kind} concepts"

    def test_interactions_stay_a_minority(self):
        # A catalogue that is mostly interactions has stopped distinguishing
        # relationships from crowded frames.
        stats = registry().stats()
        assert stats["healthy"], stats

    def test_unknown_concept_suggests_near_matches(self):
        with pytest.raises(ConceptError) as exc:
            concept("zero_cpy")
        assert "did you mean" in str(exc.value)
        assert "zero_copy" in str(exc.value)


class TestDrawability:
    """Only atomic concepts can be drawn. This is the whole tier distinction."""

    def test_atomic_concepts_are_drawable(self):
        assert concept("packet").drawable

    def test_interactions_are_not_drawable(self):
        assert not concept("zero_copy").drawable
        assert not concept("false_sharing").drawable

    def test_composites_are_not_drawable(self):
        assert not concept("dpdk_rx_pipeline").drawable

    def test_every_drawable_concept_has_a_visual_identity(self):
        # The registries must agree: anything the SDK calls drawable must have an
        # entry in the visual language, and vice versa.
        drawable = {c.id for c in registry().of_kind(ConceptKind.ATOMIC)}
        drawn = set(visual_language().concepts)
        assert drawn <= drawable, f"drawn but not atomic: {drawn - drawable}"

    def test_no_interaction_leaked_into_the_visual_language(self):
        # The §17.4 migration: dma and copy used to be registered as drawable.
        for c in registry().of_kind(ConceptKind.INTERACTION):
            assert c.id not in visual_language().concepts, f"{c.id} has a silhouette"


class TestInteractionGates:
    """The five mechanical gates from §5.5."""

    def _interaction(self, **overrides) -> dict:
        base = {
            "id": "test_interaction",
            "kind": "interaction",
            "version": "1.0.0",
            "domain": "test",
            "between": ["packet", "pointer"],
            "pedagogy": {
                "objectives": [{"id": "T-1", "statement": "something relational"}],
                "removal_test": {"packet": "not the lesson", "pointer": "not the lesson"},
                "misconceptions": [{"id": "T-M1", "wrong": "x", "refute_by": "y"}],
            },
            "visual_grammar": {"participants": {}},
            "motion_grammar": {"primary": "pointer.snap"},
            "camera": {"move": "orbit"},
            "staging": {"template": "race"},
            "assessment": {"after_this_the_viewer_can": ["do a thing"]},
            "relations": {"requires": ["packet", "pointer"]},
        }
        base.update(overrides)
        return base

    def _write(self, tmp_path: Path, *concepts: dict) -> ConceptRegistry:
        import yaml

        for spec in concepts:
            (tmp_path / f"{spec['id']}.yaml").write_text(yaml.safe_dump(spec), encoding="utf-8")
        return ConceptRegistry.load(tmp_path)

    def _atomic(self, name: str) -> dict:
        return {"id": name, "kind": "atomic", "version": "1.0.0", "domain": "test"}

    def test_a_well_formed_interaction_loads(self, tmp_path):
        r = self._write(
            tmp_path, self._atomic("packet"), self._atomic("pointer"), self._interaction()
        )
        assert isinstance(r.get("test_interaction"), InteractionConcept)

    def test_gate1_needs_at_least_two_participants(self, tmp_path):
        spec = self._interaction(between=["packet"])
        spec["pedagogy"]["removal_test"] = {"packet": "x"}
        spec["relations"]["requires"] = ["packet"]
        with pytest.raises(ConceptError) as exc:
            self._write(tmp_path, self._atomic("packet"), spec)
        assert "at least two" in str(exc.value)

    def test_gate1_participants_must_be_atomic(self, tmp_path):
        # An interaction joins THINGS. Building on another relationship is
        # `requires`, or it is a composite.
        inner = self._interaction(id="inner")
        outer = self._interaction(id="outer", between=["packet", "inner"])
        outer["pedagogy"]["removal_test"] = {"packet": "x", "inner": "y"}
        outer["relations"]["requires"] = ["packet", "inner"]
        with pytest.raises(ConceptError) as exc:
            self._write(tmp_path, self._atomic("packet"), self._atomic("pointer"), inner, outer)
        assert "not atomic" in str(exc.value)

    def test_gate2_participants_must_be_prerequisites(self, tmp_path):
        # This is what keeps the beat to ONE new idea.
        spec = self._interaction()
        spec["relations"]["requires"] = ["packet"]  # pointer omitted
        with pytest.raises(ConceptError) as exc:
            self._write(tmp_path, self._atomic("packet"), self._atomic("pointer"), spec)
        assert "not in `requires:`" in str(exc.value)
        assert "two new ideas" in str(exc.value)

    def test_gate3_every_participant_needs_a_removal_test(self, tmp_path):
        spec = self._interaction()
        del spec["pedagogy"]["removal_test"]["pointer"]
        with pytest.raises(ConceptError) as exc:
            self._write(tmp_path, self._atomic("packet"), self._atomic("pointer"), spec)
        assert "removal_test" in str(exc.value)
        assert "If the lesson survives" in str(exc.value)

    @pytest.mark.parametrize("block", REQUIRED_INTERACTION_BLOCKS)
    def test_gate4_all_seven_blocks_are_mandatory(self, tmp_path, block):
        spec = self._interaction()
        if block in ("objectives", "misconceptions"):
            spec["pedagogy"][block] = []
        elif block == "assessment":
            spec["assessment"] = {"after_this_the_viewer_can": []}
        else:
            spec[block] = {}
        with pytest.raises(ConceptError) as exc:
            self._write(tmp_path, self._atomic("packet"), self._atomic("pointer"), spec)
        assert block in str(exc.value)

    def test_gate5_contrast_defined_must_name_its_contrast(self, tmp_path):
        spec = self._interaction()
        spec["staging"] = {"template": "contrast_then_invariance", "contrast_defined": True}
        with pytest.raises(ConceptError) as exc:
            self._write(tmp_path, self._atomic("packet"), self._atomic("pointer"), spec)
        assert "contrast-defined" in str(exc.value)

    def test_unknown_kind_is_rejected(self, tmp_path):
        with pytest.raises(ConceptError) as exc:
            self._write(tmp_path, {"id": "x", "kind": "vibe", "version": "1.0.0", "domain": "t"})
        assert "a thing, a relationship, or a story" in str(exc.value)


class TestTheShippedInteractions:
    """Every interaction in the SDK, held to its own rules."""

    @pytest.mark.parametrize(
        "concept_id",
        [c.id for c in registry().of_kind(ConceptKind.INTERACTION)],
    )
    def test_removal_test_is_written_for_every_participant(self, concept_id):
        c = registry().get(concept_id)
        assert isinstance(c, InteractionConcept)
        for participant in c.between:
            assert c.removal_test.get(participant, "").strip()

    def test_zero_copy_joins_a_pointer_and_a_buffer(self):
        c = registry().get("zero_copy")
        assert isinstance(c, InteractionConcept)
        assert set(c.between) == {"pointer", "memory_buffer"}
        assert c.participants == c.between

    def test_polling_is_contrast_defined(self):
        # Validation §17.3: its lesson only exists against interrupts.
        c = registry().get("polling")
        assert isinstance(c, InteractionConcept)
        assert c.contrast_defined
        assert "interrupt_driven" in c.contrasts_with

    def test_zero_copy_is_not_contrast_defined_but_still_contrasts(self):
        c = registry().get("zero_copy")
        assert isinstance(c, InteractionConcept)
        assert not c.contrast_defined
        assert "copy_based" in c.contrasts_with

    def test_false_sharing_owns_its_misconceptions(self):
        wrongs = [m.wrong for m in registry().get("false_sharing").misconceptions]
        assert any("race condition" in w for w in wrongs)


class TestComposites:
    def test_a_composite_stages_nothing_and_sequences_members(self):
        c = registry().get("dpdk_rx_pipeline")
        assert isinstance(c, CompositeConcept)
        assert not c.drawable
        assert "zero_copy" in c.members

    def test_depth_is_declared_per_member(self):
        c = registry().get("dpdk_rx_pipeline")
        assert isinstance(c, CompositeConcept)
        assert c.depth_of("packet") is Depth.ASSUMED
        assert c.depth_of("zero_copy") is Depth.FULL

    def test_an_unknown_member_is_reported(self):
        c = registry().get("dpdk_rx_pipeline")
        assert isinstance(c, CompositeConcept)
        with pytest.raises(ConceptError) as exc:
            c.depth_of("kafka")
        assert "not a member" in str(exc.value)

    def test_reuse_is_the_measure(self):
        # zero_copy is composed, not re-implemented.
        composites = registry().of_kind(ConceptKind.COMPOSITE)
        reused = [c for c in composites if "zero_copy" in c.members]  # type: ignore[attr-defined]
        assert reused


class TestGraph:
    def test_closure_is_transitive(self):
        assert "memory_buffer" in registry().closure("zero_copy")
        assert "cpu" in registry().closure("polling")

    def test_teaching_order_accepts_a_sound_order(self):
        order = ["packet", "memory_buffer", "pointer", "mbuf", "zero_copy"]
        assert registry().check_teaching_order(order) == []

    def test_an_interaction_may_not_precede_its_participants(self):
        # THE mechanism behind one-new-idea-per-beat (§5.4, §12.5).
        found = registry().check_teaching_order(["zero_copy"])
        assert found
        assert any("taught before its participant" in f.message for f in found)

    def test_assumed_knowledge_satisfies_prerequisites(self):
        assumed = {"packet", "memory_buffer", "pointer", "mbuf"}
        assert registry().check_teaching_order(["zero_copy"], assumed=assumed) == []

    def test_a_prerequisite_cycle_is_rejected(self, tmp_path):
        import yaml

        for name, other in (("a", "b"), ("b", "a")):
            (tmp_path / f"{name}.yaml").write_text(
                yaml.safe_dump(
                    {
                        "id": name,
                        "kind": "atomic",
                        "version": "1.0.0",
                        "domain": "t",
                        "relations": {"requires": [other]},
                    }
                ),
                encoding="utf-8",
            )
        with pytest.raises(ConceptError) as exc:
            ConceptRegistry.load(tmp_path).closure("a")
        assert "cycle" in str(exc.value)


class TestSalienceFollowsTheFocusedConcept:
    """The rule got stricter: primaries == the focused concept's participants."""

    def test_an_atomic_focus_permits_exactly_one_primary(self):
        scene = Scene(id="s", focus="packet")
        scene.cast(PACKET, "1", salience=Salience.PRIMARY)
        scene.cast(MBUF, "1")
        assert scene.check_salience() == []

    def test_an_atomic_focus_rejects_two_primaries(self):
        scene = Scene(id="s", focus="packet")
        scene.cast(PACKET, "1", salience=Salience.PRIMARY)
        scene.cast(MBUF, "1", salience=Salience.PRIMARY)
        found = scene.check_salience()
        assert found
        assert "declares 1 participant" in found[0].statement

    def test_an_interaction_focus_permits_exactly_its_participants(self):
        scene = Scene(id="s", focus="zero_copy")
        scene.cast(POINTER, "1", salience=Salience.PRIMARY)
        scene.cast(MEMORY_BUFFER, "1", salience=Salience.PRIMARY)
        scene.cast(NIC, "1")
        assert scene.check_salience() == []

    def test_an_interaction_focus_rejects_one_primary(self):
        scene = Scene(id="s", focus="zero_copy")
        scene.cast(POINTER, "1", salience=Salience.PRIMARY)
        scene.cast(MEMORY_BUFFER, "1")
        found = scene.check_salience()
        assert found
        assert "declares 2 participant" in found[0].statement

    def test_the_right_number_of_the_wrong_things_is_still_rejected(self):
        # Two primaries that are not the declared participants is a crowded frame
        # wearing an interaction's name.
        scene = Scene(id="s", focus="zero_copy")
        scene.cast(PACKET, "1", salience=Salience.PRIMARY)
        scene.cast(CPU, "1", salience=Salience.PRIMARY)
        found = scene.check_salience()
        assert found
        assert "no primary actor represents" in found[0].detail

    def test_with_no_focus_the_default_rule_still_holds(self):
        scene = Scene(id="s")
        scene.cast(PACKET, "1", salience=Salience.PRIMARY)
        assert scene.check_salience() == []
