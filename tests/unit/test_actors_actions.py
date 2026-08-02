from __future__ import annotations

import pytest

from axiobyte_studio.actions import (
    ALLOCATE,
    COPY,
    DMA_WRITE,
    DROP,
    FORWARD,
    INSPECT,
    REFERENCE,
    RELEASE,
    TRANSMIT,
    Confidence,
    Cost,
    Invariant,
    Scene,
)
from axiobyte_studio.actions import LIBRARY as ACTIONS
from axiobyte_studio.actors import LIBRARY as ACTORS
from axiobyte_studio.actors import MBUF, NIC, PACKET, Salience
from axiobyte_studio.core import ConceptError, DesignError, RoleNotFoundError
from axiobyte_studio.design import visual_language
from axiobyte_studio.motion import motion, motion_language


class TestMotionLanguage:
    def test_every_signature_states_what_it_reads_as(self):
        # `reads_as` is an acceptance criterion, not a comment.
        for name in motion_language().names:
            assert motion(name).reads_as, f"{name} has no stated meaning"

    def test_copy_and_pointer_are_opposites(self):
        # Between them these two are the whole argument of the zero-copy episode.
        assert motion("copy.duplicate_translate").duration > motion("pointer.snap").duration
        assert "wasteful" in motion("copy.duplicate_translate").reads_as
        assert "weightless" in motion("pointer.snap").reads_as

    def test_inheritance_resolves(self):
        base, derived = motion("packet.travel"), motion("message.travel")
        assert derived.curve == base.curve
        assert derived.duration == base.duration
        assert derived.reads_as != base.reads_as  # meaning is restated, not inherited
        assert derived.inherits == "packet.travel"

    def test_nothing_borrows_a_motion_it_does_not_own(self):
        owners = motion_language().owners()
        for concept, signatures in owners.items():
            assert all(s.startswith(f"{concept}.") for s in signatures)

    def test_stretching_keeps_the_curve_and_meaning(self):
        base = motion("packet.travel")
        stretched = base.stretched(2.5)
        assert stretched.duration == 2.5
        assert (stretched.curve, stretched.reads_as) == (base.curve, base.reads_as)

    def test_stretching_to_zero_raises(self):
        with pytest.raises(DesignError) as exc:
            motion("packet.travel").stretched(0)
        assert "check the two cues" in str(exc.value)

    def test_unknown_signature_lists_what_exists(self):
        with pytest.raises(DesignError) as exc:
            motion("packet.teleport")
        assert "design/tokens/motion.yaml" in str(exc.value)


class TestActors:
    def test_every_actor_has_a_visual_identity(self):
        # An actor may not exist without a registry entry — that is what keeps the
        # visual language closed rather than aspirational.
        for concept in ACTORS:
            assert visual_language().concept(concept).role

    def test_unregistered_concept_cannot_be_cast(self):
        # The refusal comes from the visual language registry, which is where the
        # question "is this a thing the Studio knows how to draw" belongs.
        from axiobyte_studio.actors import ActorDefinition

        with pytest.raises(RoleNotFoundError) as exc:
            ActorDefinition(concept="quantum_widget").spawn("1")
        assert "language.yaml" in str(exc.value)

    def test_identity_is_stable_and_qualified(self):
        packet = PACKET.spawn("1")
        assert packet.id == "packet#1"
        assert packet.role == "packet"

    def test_anchors_are_named_not_geometric(self):
        assert MBUF.spawn("1").anchor("buf_addr") == "mbuf#1.buf_addr"

    def test_unknown_anchor_lists_what_exists(self):
        with pytest.raises(ConceptError) as exc:
            MBUF.spawn("1").anchor("wherever")
        assert "buf_addr" in str(exc.value)

    def test_state_machines_are_opt_in(self):
        # Hardware has no lifecycle a viewer needs to learn.
        assert PACKET.machine is not None
        assert NIC.machine is None
        assert NIC.spawn("1").state == ""

    def test_props_carry_the_facts_invariants_watch(self):
        assert PACKET.spawn("1", address="0xdead").props["address"] == "0xdead"


class TestStateMachine:
    def test_legal_path_advances(self):
        machine = PACKET.machine
        assert machine is not None
        state = machine.initial
        for action in ("dma_write", "reference", "forward", "transmit"):
            state = machine.next_state(state, action)
        assert state == "referenced"

    def test_use_after_free_is_rejected(self):
        machine = PACKET.machine
        assert machine is not None
        with pytest.raises(ConceptError) as exc:
            machine.next_state("freed", "inspect")
        assert "not legal from state 'freed'" in str(exc.value)
        assert "claim about how the system behaves" in str(exc.value)

    def test_error_says_where_the_action_would_be_legal(self):
        machine = PACKET.machine
        assert machine is not None
        with pytest.raises(ConceptError) as exc:
            machine.next_state("on_wire", "transmit")
        assert "'transmit' is legal from" in str(exc.value)
        assert "referenced" in str(exc.value)

    def test_freed_is_terminal(self):
        machine = PACKET.machine
        assert machine is not None
        assert machine.is_terminal("freed")
        assert not machine.is_terminal("in_buffer")


class TestActionContracts:
    def test_every_action_resolves_its_motion(self):
        for action in ACTIONS.values():
            assert action.signature.reads_as

    def test_every_action_can_depict_its_own_absence(self):
        # Systems teaching is full of "and this does NOT happen".
        for action in ACTIONS.values():
            assert action.negation, f"{action.name} cannot be shown not happening"

    def test_every_action_applies_to_registered_concepts(self):
        for action in ACTIONS.values():
            for concept in action.subjects:
                assert concept in ACTORS, f"{action.name} acts on unknown {concept}"

    def test_a_verb_is_reused_where_the_meaning_holds(self):
        # Reuse across concepts is evidence the vocabulary is at the right level.
        assert RELEASE.accepts("mbuf")
        assert RELEASE.accepts("packet")
        assert not RELEASE.accepts("nic")


class TestCost:
    def test_an_exact_cost_must_cite_a_source(self):
        with pytest.raises(ConceptError) as exc:
            Cost(cycles=42, confidence=Confidence.EXACT)
        assert "cite a source" in str(exc.value)

    def test_only_exact_costs_may_be_displayed(self):
        assert Cost(cycles=42, confidence=Confidence.EXACT, source="measured").displayable
        assert not Cost(cycles=42, confidence=Confidence.ORDER).displayable
        assert not COPY.cost.displayable

    def test_relative_claims_survive_hardware_generations(self):
        ratio = COPY.cost.relative_to(REFERENCE.cost)
        assert ratio is not None
        assert ratio > 1  # copying is more expensive than referencing

    def test_incomparable_costs_return_none(self):
        assert Cost().relative_to(Cost()) is None


def zero_copy_scene() -> Scene:
    """The Episode 02 shot: bytes written once, only the pointer travels."""
    scene = Scene(id="s01e02.shot_0120_pointer_not_copy")
    scene.cast(NIC, "1")
    scene.cast(PACKET, "1", salience=Salience.PRIMARY, address="0x7f3a4c00", bytes=1500)
    scene.cast(MBUF, "1")
    scene.require(
        Invariant(
            id="ZC-1",
            statement="packet bytes are written once and never moved again",
            actor="packet#1",
            unchanged=("address",),
            forbids=("copy",),
        )
    )
    return scene


class TestSceneTellsTheTruth:
    """The architecture's central claim, executable: a wrong visualization fails."""

    def test_the_zero_copy_staging_verifies(self):
        scene = zero_copy_scene()
        scene.apply(DMA_WRITE, "packet#1", at=68.4, into="mempool#1")
        scene.apply(REFERENCE, "packet#1", at=96.2, by="mbuf#1")
        for at, stage in ((104.0, "parser"), (118.0, "firewall"), (131.0, "router")):
            scene.apply(FORWARD, "packet#1", at=at, to=stage)
        scene.apply(TRANSMIT, "packet#1", at=184.0, via="nic#1")
        scene.verify()
        assert scene.actors["packet#1"].props["address"] == "0x7f3a4c00"

    def test_a_staging_that_moves_the_bytes_is_rejected(self):
        scene = zero_copy_scene()
        scene.apply(DMA_WRITE, "packet#1", at=68.4)
        scene.apply(REFERENCE, "packet#1", at=96.2)
        scene.apply(COPY, "packet#1", at=104.0, address="0x7f3a5400")
        with pytest.raises(ConceptError) as exc:
            scene.verify()
        message = str(exc.value)
        assert "address changed from" in message
        assert "'copy' was applied" in message
        assert "contradicts what the episode claims to teach" in message

    def test_violations_are_reported_together(self):
        scene = zero_copy_scene()
        scene.apply(DMA_WRITE, "packet#1", at=68.4)
        scene.apply(REFERENCE, "packet#1", at=96.2)
        scene.apply(COPY, "packet#1", at=104.0, address="0xbeef")
        assert len(scene.check()) == 2  # the moved address AND the forbidden action

    def test_violations_carry_a_timestamp(self):
        scene = zero_copy_scene()
        scene.apply(DMA_WRITE, "packet#1", at=68.4)
        scene.apply(REFERENCE, "packet#1", at=96.2)
        scene.apply(COPY, "packet#1", at=104.0, address="0xbeef")
        assert all(v.at == 104.0 for v in scene.check())

    def test_an_invariant_on_a_missing_actor_is_reported(self):
        scene = Scene(id="s")
        scene.cast(PACKET, "1", salience=Salience.PRIMARY)
        scene.require(Invariant(id="X", statement="…", actor="ghost#9", unchanged=("address",)))
        assert "not in this scene" in str(scene.check()[0])


class TestSceneMechanics:
    def test_illegal_transition_fails_at_apply_time(self):
        scene = zero_copy_scene()
        with pytest.raises(ConceptError) as exc:
            scene.apply(TRANSMIT, "packet#1", at=10.0)  # still on_wire
        assert "not legal from state 'on_wire'" in str(exc.value)

    def test_action_applied_to_the_wrong_concept_is_rejected(self):
        scene = zero_copy_scene()
        with pytest.raises(ConceptError) as exc:
            scene.apply(DMA_WRITE, "nic#1", at=10.0)
        assert "does not apply to a 'nic'" in str(exc.value)

    def test_acting_on_an_uncast_actor_lists_the_cast(self):
        scene = zero_copy_scene()
        with pytest.raises(ConceptError) as exc:
            scene.apply(DROP, "packet#7", at=10.0)
        assert "cast:" in str(exc.value)
        assert "packet#1" in str(exc.value)

    def test_duplicate_instance_ids_are_rejected(self):
        scene = zero_copy_scene()
        with pytest.raises(ConceptError) as exc:
            scene.cast(PACKET, "1")
        assert "already in this scene" in str(exc.value)

    def test_actors_without_a_machine_pass_through(self):
        scene = Scene(id="s")
        scene.cast(NIC, "1", salience=Salience.PRIMARY)
        scene.cast(MBUF, "1")
        scene.apply(ALLOCATE, "mbuf#1", at=1.0)
        assert scene.actors["nic#1"].state == ""

    def test_timeline_reads_as_a_trace(self):
        scene = zero_copy_scene()
        scene.apply(DMA_WRITE, "packet#1", at=68.4)
        trace = scene.timeline()
        assert "dma_write" in trace
        assert "on_wire -> in_buffer" in trace

    def test_an_empty_scene_says_so(self):
        assert "nothing happens" in Scene(id="s").timeline()


class TestSalience:
    def test_exactly_one_primary_is_required(self):
        assert zero_copy_scene().check_salience() == []

    def test_two_primaries_is_a_violation_when_no_interaction_is_in_focus(self):
        scene = Scene(id="s")
        scene.cast(PACKET, "1", salience=Salience.PRIMARY)
        scene.cast(MBUF, "1", salience=Salience.PRIMARY)
        violations = scene.check_salience()
        assert violations
        assert "2 actor(s) are primary" in violations[0].detail

    def test_no_primary_is_also_a_violation(self):
        scene = Scene(id="s")
        scene.cast(PACKET, "1")
        assert "0 actor(s) are primary" in scene.check_salience()[0].detail

    def test_verify_covers_salience_too(self):
        scene = Scene(id="s")
        scene.cast(PACKET, "1")
        with pytest.raises(ConceptError) as exc:
            scene.verify()
        assert "FOCUS" in str(exc.value)


class TestInspectDoesNotMove:
    def test_reading_a_packet_leaves_it_where_it_is(self):
        scene = zero_copy_scene()
        scene.apply(DMA_WRITE, "packet#1", at=68.4)
        scene.apply(REFERENCE, "packet#1", at=96.2)
        scene.apply(INSPECT, "packet#1", at=120.0, by="firewall")
        scene.verify()


class TestTimeScopedInvariants:
    """The counter-picture must be stageable.

    `contrast_then_invariance` — how zero-copy, polling and false sharing are all
    taught — spends its first act doing the thing the episode later forbids, on
    purpose, so that stopping reads as the point. An invariant with no time scope
    makes that unstageable, and the counter-picture is half the lesson.
    """

    def _scene(self, turn: float) -> Scene:
        scene = Scene(id="ep02")
        scene.cast(PACKET, "1", salience=Salience.PRIMARY, address="0x7f3a4c00")
        scene.require(
            Invariant(
                id="OP-1",
                statement="bytes never move after the turn",
                actor="packet#1",
                unchanged=("address",),
                forbids=("copy",),
                after=turn,
            )
        )
        scene.apply(DMA_WRITE, "packet#1", at=20.0)
        return scene

    def test_a_copy_before_the_turn_is_legal(self):
        scene = self._scene(turn=46.27)
        scene.apply(COPY, "packet#1", at=25.4, address="0xdead")
        scene.apply(REFERENCE, "packet#1", at=96.2)
        scene.verify()

    def test_a_copy_after_the_turn_is_still_rejected(self):
        scene = self._scene(turn=46.27)
        scene.apply(REFERENCE, "packet#1", at=96.2)
        scene.apply(COPY, "packet#1", at=104.0, address="0xdead")
        with pytest.raises(ConceptError) as exc:
            scene.verify()
        assert "after 46.27s" in str(exc.value)

    def test_the_address_is_compared_from_the_turn_not_the_start(self):
        # Act one legitimately relocates the payload; the invariant must measure
        # from where it stood when the prohibition began.
        scene = self._scene(turn=46.27)
        scene.apply(COPY, "packet#1", at=25.4, address="0xdead")
        scene.apply(REFERENCE, "packet#1", at=96.2)
        assert scene.check() == []

    def test_an_unscoped_invariant_still_covers_the_whole_scene(self):
        scene = self._scene(turn=0.0)
        scene.apply(COPY, "packet#1", at=25.4, address="0xdead")
        assert len(scene.check()) == 2

    def test_the_violation_reports_the_scope(self):
        scene = self._scene(turn=46.27)
        scene.apply(REFERENCE, "packet#1", at=96.2)
        scene.apply(FORWARD, "packet#1", at=104.0, address="0xbeef")
        detail = scene.check()[0].detail
        assert "in force from 46.27s" in detail

    def test_forbids_is_scoped_to_the_named_actor(self):
        # "The payload is never copied" is a claim about THAT payload. A different
        # packet being copied elsewhere in the frame is often the whole point of a
        # comparison shot — and before this test, it tripped the invariant.
        scene = Scene(id="compare")
        scene.cast(PACKET, "1", salience=Salience.PRIMARY, address="0xAAAA")
        scene.cast(PACKET, "trad", address="0xBBBB")
        scene.require(
            Invariant(
                id="I",
                statement="packet#1 is never copied",
                actor="packet#1",
                forbids=("copy",),
            )
        )
        scene.apply(DMA_WRITE, "packet#trad", at=1.0)
        scene.apply(COPY, "packet#trad", at=2.0, address="0xCCCC")
        assert scene.check() == []

    def test_an_unscoped_forbid_still_covers_every_actor(self):
        scene = Scene(id="all")
        scene.cast(PACKET, "1", salience=Salience.PRIMARY)
        scene.cast(PACKET, "other")
        scene.require(Invariant(id="I", statement="nothing is copied", forbids=("copy",)))
        scene.apply(DMA_WRITE, "packet#other", at=1.0)
        scene.apply(COPY, "packet#other", at=2.0)
        assert len(scene.check()) == 1
