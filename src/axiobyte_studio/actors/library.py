"""The actor library — the cast of Pillar 1, defined once and reused forever.

State machines appear only where legality is part of the lesson. ``PACKET`` and
``MBUF`` have them because "use after free" and "forwarding a dropped packet" are
false claims about DPDK that an episode must not make. ``NIC`` and ``CPU`` do not,
because a NIC has no lifecycle a viewer needs to learn.
"""

from __future__ import annotations

from axiobyte_studio.actors.base import ActorDefinition, StateMachine, Transition

# ---------------------------------------------------------------------------
# net
# ---------------------------------------------------------------------------

#: A packet's life, from the wire to the pool it came from.
#:
#:     on_wire --dma_write--> in_buffer --reference--> referenced --release--> freed
#:                                 |                        |
#:                                 +--------- drop ---------+--> dropped
#:
#: The illegal moves are the interesting ones: nothing follows `freed`, and a
#: `dropped` packet cannot be forwarded.
_PACKET_MACHINE = StateMachine(
    initial="on_wire",
    states=frozenset({"on_wire", "in_buffer", "referenced", "dropped", "freed"}),
    transitions=(
        Transition("dma_write", "on_wire", "in_buffer"),
        Transition("reference", "in_buffer", "referenced"),
        Transition("forward", "referenced", "referenced"),
        Transition("inspect", "referenced", "referenced"),
        Transition("copy", "in_buffer", "in_buffer"),
        Transition("copy", "referenced", "referenced"),
        Transition("transmit", "referenced", "referenced"),
        Transition("drop", "in_buffer", "dropped"),
        Transition("drop", "referenced", "dropped"),
        Transition("release", "referenced", "freed"),
    ),
)

PACKET = ActorDefinition(
    concept="packet",
    machine=_PACKET_MACHINE,
    anchors=("first_byte", "last_byte", "header"),
    default_props={"bytes": 1500, "proto": "tcp"},
)

# ---------------------------------------------------------------------------
# memory
# ---------------------------------------------------------------------------

_BUFFER_MACHINE = StateMachine(
    initial="free",
    states=frozenset({"free", "filled", "in_use"}),
    transitions=(
        Transition("allocate", "free", "in_use"),
        Transition("dma_write", "in_use", "filled"),
        Transition("dma_write", "free", "filled"),
        Transition("reference", "filled", "filled"),
        Transition("release", "filled", "free"),
        Transition("release", "in_use", "free"),
    ),
)

MEMORY_BUFFER = ActorDefinition(
    concept="memory_buffer",
    machine=_BUFFER_MACHINE,
    anchors=("start", "end", "address"),
    default_props={"address": "0x7f3a4c00", "bytes": 2048},
)

MEMPOOL = ActorDefinition(
    concept="mempool",
    anchors=("first_slot", "last_slot"),
    default_props={"slots": 16},
)

#: An mbuf is metadata plus, crucially, `buf_addr` — the address of the bytes.
#: Everything above buf_addr is bookkeeping; buf_addr is the pointer itself.
_MBUF_MACHINE = StateMachine(
    initial="pooled",
    states=frozenset({"pooled", "attached", "freed"}),
    transitions=(
        Transition("allocate", "pooled", "attached"),
        Transition("reference", "attached", "attached"),
        Transition("forward", "attached", "attached"),
        Transition("release", "attached", "freed"),
    ),
)

MBUF = ActorDefinition(
    concept="mbuf",
    machine=_MBUF_MACHINE,
    anchors=("buf_addr", "data_len", "refcount", "next"),
    default_props={"refcount": 0},
)

POINTER = ActorDefinition(
    concept="pointer",
    anchors=("tail", "head"),
    default_props={},
)

#: A cache line's life is the coherency protocol, which IS the lesson of false
#: sharing: two cores writing different variables on one line ping-pong it.
_LINE_MACHINE = StateMachine(
    initial="invalid",
    states=frozenset({"invalid", "shared", "modified"}),
    transitions=(
        Transition("inspect", "invalid", "shared"),
        Transition("inspect", "shared", "shared"),
        Transition("inspect", "modified", "shared"),
        Transition("copy", "shared", "modified"),
        Transition("copy", "modified", "modified"),
        Transition("evict", "shared", "invalid"),
        Transition("evict", "modified", "invalid"),
    ),
)

CACHE_LINE = ActorDefinition(
    concept="cache_line",
    machine=_LINE_MACHINE,
    anchors=("start", "end"),
    default_props={"bytes": 64},
)

# ---------------------------------------------------------------------------
# compute
# ---------------------------------------------------------------------------

_THREAD_MACHINE = StateMachine(
    initial="ready",
    states=frozenset({"ready", "running", "blocked"}),
    transitions=(
        Transition("schedule", "ready", "running"),
        Transition("inspect", "running", "running"),
        Transition("copy", "running", "running"),
        Transition("sleep", "running", "blocked"),
        Transition("wake", "blocked", "ready"),
        Transition("yield_", "running", "ready"),
    ),
)

THREAD = ActorDefinition(
    concept="thread",
    machine=_THREAD_MACHINE,
    anchors=("stack", "pc"),
    default_props={"label": "thread"},
)

WORKER_CORE = ActorDefinition(
    concept="worker_core",
    anchors=("l1", "pipeline"),
    default_props={"label": "core", "cores": 1},
)

# ---------------------------------------------------------------------------
# io — hardware has no lifecycle a viewer needs to learn, so no machine.
# ---------------------------------------------------------------------------

NIC_QUEUE = ActorDefinition(
    concept="nic_queue",
    anchors=("head", "tail"),
    default_props={"slots": 8},
)

NIC = ActorDefinition(
    concept="nic",
    anchors=("rx_queue", "tx_queue", "port", "dma_engine"),
    default_props={"rx_queues": 8, "label": "SmartNIC"},
)

CPU = ActorDefinition(
    concept="cpu",
    anchors=("core", "l1", "l2"),
    default_props={"cores": 4},
)

# The NIC's parts, as s01e03 walks them. Hardware again, so no machine.
PHY = ActorDefinition(
    concept="phy",
    anchors=("line_side", "mac_side"),
    default_props={"label": "PHY"},
)

MAGNETICS = ActorDefinition(
    concept="magnetics",
    anchors=("cable_side", "phy_side"),
    default_props={"label": "magnetics"},
)

PCIE = ActorDefinition(
    concept="pcie",
    anchors=("lanes", "root_complex"),
    default_props={"label": "PCIe", "lanes": 8},
)

# memory — software prepares it; the NIC only fills and marks it.
DESCRIPTOR_RING = ActorDefinition(
    concept="descriptor_ring",
    anchors=("head", "tail", "slot"),
    default_props={"slots": 8},
)

# NOTE: there is deliberately no DMA actor. DMA is an Interaction Concept
# (nic <-> memory_buffer), and an interaction has no actor of its own — it is
# staged through its participants. See concepts/library/interaction/dma.yaml.

#: Every definition, by concept, for contract tests and scaffolding.
LIBRARY: dict[str, ActorDefinition] = {
    definition.concept: definition
    for definition in (
        PACKET,
        MEMORY_BUFFER,
        MEMPOOL,
        MBUF,
        POINTER,
        CACHE_LINE,
        THREAD,
        WORKER_CORE,
        NIC,
        NIC_QUEUE,
        CPU,
        PHY,
        MAGNETICS,
        PCIE,
        DESCRIPTOR_RING,
    )
}
