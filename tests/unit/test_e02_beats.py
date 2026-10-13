"""s01e02's beat plan: the timing the staging will follow, on the episode's own voiceover.

Act one's traditional path is three actions — the NIC's DMA into the first buffer, then two CPU
copies — each on the sentence that says it. Sentences 14-46 carry the zero-copy story: the mbuf is
metadata, the bytes live in a buffer, the pool is mbuf + buffer elements, DMA writes a buffer,
only the handle travels, transmit reads the same buffer. One representative element carries it,
never named; no beat declares a runtime state.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pytest
import yaml

from axiobyte_studio.storyboard import Episode
from axiobyte_studio.timeline import CueTable

REPO = Path(__file__).resolve().parents[2]
EPISODE = REPO / "episodes" / "s01e02-zero-copy"
BEATS = EPISODE / "storyboard" / "beats.yaml"

#: The beats that existed before the expansion, exactly as they were.
ORIGINAL = {
    "traditional.networking": ("networking@4", "copy_based", "CB-1", ""),
    "traditional.copied": ("copied@4", "copy_based", "", "CB-M1"),
    "zerocopy.instead": ("Instead@10", "zero_copy", "ZC-1", ""),
    "zerocopy.reference": ("reference@10", "zero_copy", "ZC-2", "ZC-M2"),
    "zerocopy.mbuf": ("mBuff@13", "zero_copy", "", "ZC-M3"),
}
#: Runtime labels a beat must never declare. Narration may say "free" or "returned"; a beat
#: does not turn that into a state.
STATE_LABELS = re.compile(r"\b(FREE|IN USE|OWNED|RETURNED|ALLOCATED|CONSUMED|POSTED|READY)\b")
IDENTITY = re.compile(r"\b(element|mbuf|buffer|descriptor|slot)[-_#]?\d", re.I)


@pytest.fixture(scope="module")
def e02() -> tuple[Episode, CueTable]:
    episode = Episode.load(EPISODE)
    assert episode.beatmap is not None and episode.timeline is not None
    return episode, CueTable.resolve(episode.beatmap.cues, episode.timeline)


def _sentence(cue: str) -> int:
    return int(cue.split("@")[1])


def test_sentences_five_to_seven_are_three_separate_actions(e02):
    episode, cues = e02
    assert episode.beatmap is not None
    beats = {b.id: b for b in episode.beatmap.beats}
    receive, copy, again = (
        beats[i] for i in ("traditional.receive", "traditional.copy", "traditional.copy_again")
    )
    assert [_sentence(b.cue) for b in (receive, copy, again)] == [5, 6, 7]
    assert cues["traditional.receive"] < cues["traditional.copy"] < cues["traditional.copy_again"]
    # Sentence 5 is the NIC's DMA, not a copy; sentences 6 and 7 are the CPU copying.
    assert receive.concept == "dma" and receive.objective == "DMA-1"
    assert "never as a red copy" in receive.intent
    assert copy.concept == again.concept == "copy_based"
    assert "red copy" in copy.intent and "red copy" in again.intent


def test_sentences_fourteen_to_forty_six_are_covered(e02):
    episode, cues = e02
    assert episode.beatmap is not None and episode.timeline is not None
    times = sorted(cues[b.id] for b in episode.beatmap.beats)
    for i in range(14, 47):
        start = episode.timeline.sentence(i).start
        # Some beat has landed by the time the sentence ends, and none is far behind it.
        landed = [t for t in times if t <= episode.timeline.sentence(i).end]
        assert landed, f"sentence {i} begins before any beat"
        assert start - landed[-1] < 25.0, f"sentence {i} is {start - landed[-1]:.1f}s past a beat"
    covered = {_sentence(b.cue) for b in episode.beatmap.beats if b.id.startswith("zerocopy.")}
    assert {14, 21, 23, 24, 28, 30, 40, 45} <= covered


def test_beats_run_in_voiceover_order_and_never_reach_ahead(e02):
    episode, cues = e02
    assert episode.beatmap is not None
    beats = episode.beatmap.beats
    assert list(cues.out_of_order()) == []
    times = [cues[b.id] for b in beats]
    assert times == sorted(times)
    sentences = [_sentence(b.cue) for b in beats]
    assert sentences == sorted(sentences)
    # A beat that spans sentences says which, from its own sentence to before the next beat's.
    for beat, nxt in zip(beats, [*beats[1:], None], strict=True):
        span = re.match(r"\(sentences (\d+)-(\d+)\)", beat.intent)
        if span:
            first, last = int(span[1]), int(span[2])
            assert first == _sentence(beat.cue)
            assert nxt is None or last < _sentence(nxt.cue)


def test_no_element_mbuf_buffer_or_descriptor_identity(e02):
    episode, _ = e02
    assert episode.beatmap is not None
    for beat in episode.beatmap.beats:
        for text in (beat.id, beat.cue, beat.intent):
            assert not IDENTITY.search(text), (beat.id, text)
    representative = [b for b in episode.beatmap.beats if "representative" in b.intent]
    assert representative and all("illustrative" in b.intent for b in representative)


def test_dma_writes_a_buffer_and_the_pool_is_mbuf_plus_buffer(e02):
    episode, _ = e02
    assert episode.beatmap is not None
    beats = {b.id: b for b in episode.beatmap.beats}
    dma = beats["zerocopy.dma"]
    assert dma.concept == "dma" and _sentence(dma.cue) == 21
    assert "BUFFER half" in dma.intent and "never the pool, never the mbuf" in dma.intent
    for pool in (beats["zerocopy.pool"], beats["zerocopy.mempool"]):
        assert pool.concept == "mempool" and pool.objective == "POOL-1"
        assert "mbuf" in pool.intent and "buffer" in pool.intent
    # The bytes are the buffer's; the mbuf holds the address.
    assert "never the bytes" in beats["zerocopy.buf_addr"].intent
    assert "not the packet" in beats["zerocopy.metadata"].intent
    # Only the handle moves between stages; transmit reads the same buffer.
    for stage in ("parser", "classifier", "firewall", "routing"):
        assert "handle" in beats[f"zerocopy.{stage}"].intent
    assert "same buffer" in beats["zerocopy.transmit"].intent


def test_no_beat_declares_a_runtime_state():
    raw: dict[str, Any] = yaml.safe_load(BEATS.read_text(encoding="utf-8"))
    allowed = {"id", "cue", "concept", "objective", "refutes", "intent"}
    for act in raw["acts"]:
        for beat in act["beats"]:
            assert set(beat) <= allowed, beat["id"]
            for value in beat.values():
                assert not STATE_LABELS.search(str(value)), (beat["id"], value)


def test_the_original_beats_are_intact(e02):
    episode, _ = e02
    assert episode.beatmap is not None
    beats = {b.id: b for b in episode.beatmap.beats}
    for beat_id, (cue, concept, objective, refutes) in ORIGINAL.items():
        beat = beats[beat_id]
        assert (beat.cue, beat.concept, beat.objective, beat.refutes) == (
            cue,
            concept,
            objective,
            refutes,
        )
    # The two acts are the two the shots module stages: no act without a staging function.
    assert [a.id for a in episode.beatmap.acts] == ["traditional", "zerocopy"]
