"""The action library — the verb vocabulary, deliberately small and shared.

An action reused across domains is evidence the vocabulary sits at the right level.
``forward`` is the same verb for a DPDK stage and a Raft replica; ``release`` is the
same verb for an mbuf and a lock.

Costs carry provenance and a confidence band. Nothing that is not ``EXACT`` may be
shown on screen as an absolute number — a wrong figure in a systems video is
remembered and quoted back, which is a class of damage a wrong colour cannot do.
"""

from __future__ import annotations

from axiobyte_studio.actions.base import Action, Confidence, Cost, Invariant

# ---------------------------------------------------------------------------
# Data movement
# ---------------------------------------------------------------------------

DMA_WRITE = Action(
    name="dma_write",
    subjects=("packet",),
    motion="dma.smooth_beam",
    cost=Cost(confidence=Confidence.ORDER, source="DPDK RX path, order-of-magnitude"),
    negation="the CPU would have had to do this itself",
    params=("into",),
)

#: The sin, in one action. Red is reserved for it precisely so that its ABSENCE
#: reads as the argument in the zero-copy episode.
COPY = Action(
    name="copy",
    subjects=("packet",),
    motion="copy.duplicate_translate",
    cost=Cost(
        cycles=1.2,
        cache_lines=24.0,
        confidence=Confidence.ORDER,
        source="~1 cycle/byte for a warm memcpy; 1500B / 64B lines",
    ),
    negation="no copy — the bytes stay exactly where DMA put them",
    params=("into",),
)

FORWARD = Action(
    name="forward",
    subjects=("packet",),
    motion="pointer.snap",
    invariants=(
        Invariant(
            id="ZC-INV-1",
            statement="forwarding changes ownership, never location",
            unchanged=("address",),
        ),
    ),
    cost=Cost(cycles=8.0, confidence=Confidence.ILLUSTRATIVE),
    negation="the stage is skipped entirely",
    params=("to",),
)

TRANSMIT = Action(
    name="transmit",
    subjects=("packet",),
    motion="packet.travel",
    invariants=(
        Invariant(
            id="ZC-INV-3",
            statement="the bytes transmitted are the bytes DMA wrote",
            unchanged=("address",),
        ),
    ),
    negation="the packet never leaves — it dies one step short of the wire",
    params=("via",),
)

# ---------------------------------------------------------------------------
# Memory
# ---------------------------------------------------------------------------

ALLOCATE = Action(
    name="allocate",
    subjects=("mbuf", "memory_buffer"),
    motion="allocate.ripple",
    cost=Cost(cycles=30.0, confidence=Confidence.ORDER, source="mempool get, cached"),
    negation="the pool is exhausted — nothing is handed out",
    params=("from_pool",),
)

RELEASE = Action(
    name="release",
    subjects=("mbuf", "memory_buffer", "packet"),
    motion="release.collapse",
    negation="the buffer is leaked — it never returns to the pool",
)
"""Returning a buffer to its pool. The same verb for an mbuf, a raw buffer and a
packet, because it means the same thing to a viewer in all three."""

#: What zero-copy actually does instead of copying. The motion is the argument:
#: a pointer snaps, weightlessly, while nothing else on screen moves.
REFERENCE = Action(
    name="reference",
    subjects=("packet",),
    motion="pointer.snap",
    invariants=(
        Invariant(
            id="ZC-INV-2",
            statement="taking a reference moves no bytes",
            unchanged=("address", "bytes"),
        ),
    ),
    cost=Cost(cycles=1.0, confidence=Confidence.ILLUSTRATIVE),
    negation="the data would have to be copied instead",
    params=("by",),
)

# ---------------------------------------------------------------------------
# Processing and decision
# ---------------------------------------------------------------------------

INSPECT = Action(
    name="inspect",
    subjects=("packet",),
    # NOT packet.travel. An action whose invariant says the packet does not move
    # cannot move with a signature that reads as "carried, with momentum" — the
    # motion would contradict the lesson the action exists to teach.
    motion="inspect.scan_in_place",
    invariants=(
        Invariant(
            id="ZC-INV-4",
            statement="reading a packet does not move it",
            unchanged=("address",),
        ),
    ),
    negation="the stage waves it through without looking",
    params=("by",),
)

DROP = Action(
    name="drop",
    subjects=("packet",),
    motion="drop.fall",
    negation="the packet is accepted and continues",
    params=("reason",),
)

BATCH = Action(
    name="batch",
    subjects=("packet",),
    motion="batch.rigid_body",
    negation="each packet pays the full per-packet cost alone",
    params=("size",),
)

#: Every action, by name, for contract tests and scaffolding.
LIBRARY: dict[str, Action] = {
    action.name: action
    for action in (
        DMA_WRITE,
        COPY,
        FORWARD,
        TRANSMIT,
        ALLOCATE,
        RELEASE,
        REFERENCE,
        INSPECT,
        DROP,
        BATCH,
    )
}
