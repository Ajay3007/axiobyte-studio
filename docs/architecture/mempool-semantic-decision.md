# Mempool Semantic Decision

Settles the one buffer-family question left open by
[`buffer-family-decision.md`](buffer-family-decision.md): **what is a mempool element?** A definition
only — no concept, registry, contract, renderer, page or episode is changed here; aligning them is a
separate, later task.

Settled before this document and kept unchanged: a buffer is the `memory_buffer` concept ("packet
buffer" is its name in use); an mbuf is metadata holding `buf_addr`, never the bytes; a descriptor
refers to a buffer; NIC DMA writes into a buffer; the relationship model (Connection, Residence,
Reference, Interaction) is sufficient.

## 1. Decision

**MODEL C — a mempool element is an mbuf together with the buffer it describes.**

Two distinct things, allocated, handed out and returned as one unit: the **mbuf** (metadata, holding
`buf_addr`) and its **buffer** (storage, holding the packet bytes). The mbuf refers to the buffer; it
does not contain it.

Rationale: it is the only model every source in the repository is consistent with. The knowledge model
says the pool holds *buffers* and DMA writes into "a free buffer in the mempool"; the lifecycle model
allocates *both* an mbuf and a buffer `from_pool` and starts every mbuf `pooled`; the asset docs and
s01e03 say mbufs come from the mempool. Model A cannot explain where pooled mbufs come from; Model B
cannot explain how DMA writes into the pool. Model C is what both halves describe, each from its side.

## 2. Repository Evidence

### Repository Facts

| # | Fact | Source |
| --- | --- | --- |
| F1 | "A mempool is a set of identical **buffers** allocated once, up front, so no allocation happens on the fast path." `requires: [memory_buffer]` | `concepts/library/atomic/mempool.yaml` (POOL-1) |
| F2 | Mempool silhouette `slot_grid`: "many identical preallocated **buffers**"; motion `allocate.ripple` | `design/language.yaml` |
| F3 | `draw_mempool`: "A pool of preallocated **buffers**" | `backends/manim/shapes.py` |
| F4 | `ALLOCATE`: subjects **`mbuf`, `memory_buffer`**, param `from_pool`, cost source "mempool get, cached" | `actions/library.py` |
| F5 | `RELEASE`: subjects `mbuf, memory_buffer, packet`; "Returning a buffer to its pool. The same verb for an mbuf, a raw buffer and a packet, because it means the same thing to a viewer in all three." | `actions/library.py` |
| F6 | mbuf state machine starts **`pooled`**; `allocate: pooled → attached`; `release: attached → freed` | `actors/library.py` |
| F7 | buffer state machine: `allocate: free → in_use`; `dma_write → filled`; `release → free` | `actors/library.py` |
| F8 | MBUF-1: "metadata plus buf_addr … buf_addr is the address of the bytes"; `requires: [memory_buffer, pointer]`; anchors `buf_addr, data_len, refcount, next` | `concepts/library/atomic/mbuf.yaml` |
| F9 | mbuf visual: `metadata_card`, never "containing the payload bytes"; ZC-M3 "The mbuf IS the packet" is a misconception | `design/language.yaml`; `zero_copy.yaml` |
| F10 | "DPDK allocates a large collection of fixed-size packet buffers. This collection is called a mempool." · "DMA … straight from the wire directly into a free buffer in the mempool." · "that buffer is returned to the mempool" | s01e02 narration (`timeline/words.json`) |
| F11 | "Think of an mBuff as a small metadata structure **attached to the packet**." · "a handle that points to the original packet buffer" | s01e02 narration |
| F12 | `apply(DMA_WRITE, "packet#1", into="mempool#1")`; mbuf cast with `buf_addr` equal to the buffer's address; layout chain `nic → mempool → mbuf` | `episodes/s01e02-zero-copy/shots/episode.py` |
| F13 | "hands your application the packets as ready-to-use buffers, called mbufs, pulled from a pre-allocated pool called a mempool" · TX: "the driver returns that **buffer** to the mempool" | s01e03 `script.md` steps eight and five |
| F14 | beat `rx_ring.mempool`: "the buffers come from a pool allocated up front"; film subtitle "the **mbuf** goes back to the mempool"; widget "MEMPOOL · pre-allocated **mbufs**" | s01e03 `beats.yaml`, `three/storyboard.js`, `widgets/dataplane.js` |
| F15 | `mempool: 'DPDK mempool' … 'Pre-allocated mbufs in hugepage memory.'` | `renderers/three/src/domains/networking/dataplane.js` |
| F16 | Mempool "composes mbufs"; "holds mbufs, which remain mbuf assets residing in it"; "An mbuf is handed out by its mempool … its memory never leaves the pool" | `docs/asset-library/roadmap.md`; `README.md` tie-breaker |
| F17 | Packet buffers: "Software allocates the buffers up front — **often as a pool** of identical buffers — and posts their addresses into descriptors" | `host-memory/metadata.js` (`packet-buffer-region`) |
| F18 | A descriptor holds the address of a (packet) buffer — RING-1, host-memory and descriptor-ring metadata, s01e03 step seven | as cited in `buffer-family-decision.md` §7 |

### Contradictions

- **C1 — what the pool holds.** Buffers (F1, F2, F3, F10, F13 TX, F14 beat, F5) vs mbufs (F14 widget and
  subtitle, F15, F16, F13 RX). Each side names one half of the element; neither denies the other half.
- **C2 — "buffers, called mbufs" (F13).** Calls the mbuf a buffer, contradicting F8/F9. It is the
  narrated script of a released film; it reads correctly only as "buffers, each with its mbuf".
- **C3 — return to the pool.** F5 and the README return mbufs to the pool; the mbuf state machine ends
  in `freed` with no transition back to `pooled` (F6), while the buffer machine returns to `free` (F7).
  The actor model is incomplete here, not contrary in meaning.

### Inferences (reasonable, from the facts above)

- **I1.** A mempool supplies both an mbuf and a buffer (F4, F6, F10, F12, F13, F14). Since an mbuf is
  "attached to the packet" (F11) and refers to its buffer (F8), the two are supplied as a pair.
- **I2.** The pool's elements are pre-allocated and fixed (F1 "allocated once, up front"); what changes
  at run time is which of them are handed out (F4–F7). Membership is static; availability is runtime.
- **I3.** Where software uses a pool, its buffers are the packet buffers host memory's
  `packet-buffer-region` holds (F17 "often as a pool", F10 "collection of packet buffers … called a
  mempool").

### External Knowledge (not used as evidence)

- In DPDK a packet mempool's object is an `rte_mbuf` header followed by its data buffer, contiguous in
  one element, carved from hugepage memory. This agrees with Model C, but **the repository does not
  establish contiguity or layout**, and this decision does not rely on or require it. F15 mentions
  hugepages; nothing else does.

## 3. Model Comparison

| Question | Model A — buffers | Model B — mbufs | Model C — mbuf + buffer |
| --- | --- | --- | --- |
| 1 `memory_buffer` | consistent | buffers left outside the pool, unplaced | consistent — the buffer half |
| 2 `mbuf` | mbufs have no source, yet start `pooled` (F6) | consistent | consistent — the metadata half |
| 3 `buf_addr` | consistent | consistent | consistent — refers within the pair |
| 4 Descriptor → buffer | consistent | consistent | consistent |
| 5 Mempool concept (F1) | consistent | **contradicts** "a set of identical buffers" | consistent (buffers present), under-described (mbufs unnamed) |
| 6 Manim (F3, F4, F6) | conflicts with `ALLOCATE` of mbufs and `pooled` | conflicts with `draw_mempool` "buffers" | consistent with both |
| 7 s01e02 | consistent with narration; not with "mbufs pulled from" elsewhere | **contradicts** "DMA into a free buffer in the mempool" (F10, F12) | consistent |
| 8 s01e03 | consistent with beat and TX; not with RX script, subtitle, widget | consistent with RX, subtitle, widget; not with beat or TX | consistent with all; F13's wording is imprecise, not contrary |
| 9 Host memory (F17) | consistent | buffers would sit outside any pool | consistent |
| 10 Zero-copy | consistent | consistent | consistent — bytes stay in the buffer; the mbuf handle travels |
| 11 Asset/Part model | buffer a pool part; mbuf origin undefined | mbuf assets in a pool; buffer placement undefined | mbuf and buffer distinct, both from the pool (§10) |
| 12 Duplication | none | none | none — two things, not one thing twice |
| 13 New relationship | no | no | no |
| 14 Runtime state in contract | no | no | no — membership static, availability runtime |
| 15 Metadata vs storage | clear, but mbuf unplaced | DMA "into the pool" would land in metadata | clear — the pair names both, merges neither |

**Strongest for A:** the concept, visual language and s01e02 narration all say "buffers".
**Strongest against A:** the lifecycle model allocates mbufs from the pool and starts them `pooled`.
**Strongest for B:** the asset docs, NIC-domain widget and s01e03 say "mbufs". **Strongest against B:**
DMA writes into "a free buffer in the mempool" (F10) and `into="mempool#1"` (F12) — under B that is a
write into metadata, which ZC-M3 forbids. **Strongest for C:** it is the only model none of F1–F18
contradicts. **Strongest against C:** no single source states the pairing outright; it is assembled
from F4, F6, F10, F11 and F13.

## 4. Chosen Semantic Model

```text
Mempool                                   a set of elements, allocated once, up front
   ├── element ─┬── mbuf ──────┐          metadata: bookkeeping + buf_addr
   │            └── buffer ◄───┘ refers   storage: the packet bytes (memory_buffer)
   ├── element ─┬── mbuf ──────┐
   │            └── buffer ◄───┘
   └── …

Descriptor ──refers to──► buffer          NIC ──dma──► buffer
```

The element is a **pair**, not a nesting: the buffer is not inside the mbuf, and the mbuf holds no bytes.

## 5. Buffer / mbuf / Descriptor Semantics

| | Is | Holds | Refers to |
| --- | --- | --- | --- |
| **Buffer** (`memory_buffer`) | storage: a fixed region at a fixed address; never moves | the packet bytes, or nothing | — |
| **mbuf** | metadata about one packet; the handle passed between stages | bookkeeping (length, refcount, next) and `buf_addr` | **its buffer** (`buf_addr`) |
| **Descriptor** | metadata entry in a descriptor ring | a buffer's address and status | **a buffer** |

An mbuf and a descriptor both refer to the same buffer and to nothing else in this family. A
descriptor does not refer to an mbuf.

## 6. Mempool Semantics

- **What it is.** A set of identical elements allocated once, up front, so the fast path never
  allocates (POOL-1), drawn plural at a glance.
- **Its element.** An mbuf and the buffer it describes.
- **What it is not.** Not a queue or a ring; not an owner of what it has handed out (ownership moves
  with the handle — `FORWARD` "changes ownership, never location"); not DMA; not the packet; not the
  same thing as host memory's `packet-buffer-region` (§7).
- **Membership vs allocation.** The repository supports the distinction:
  - *static, conceptual membership* — an element belongs to its pool from creation for its whole life
    ("allocated once", "its memory never leaves the pool");
  - *runtime allocation state* — whether an element is in the pool or handed out (`ALLOCATE`,
    `RELEASE`, mbuf `pooled/attached`, buffer `free/in_use/filled`).

  "Mempool contains X" means the first. The second is runtime and stays out of any static contract.

## 7. Mempool vs Host Memory

**Related, not equivalent.**

- `packet-buffer-region` is a **part of host memory**: the range of the address space where packet
  buffers are allocated (F17).
- A **mempool** is a **software allocation** of elements — mbufs with their buffers — made in host
  memory; F17 says buffers are allocated "often as a pool", so a pool is one way (the DPDK way, in
  s01e02 and s01e03) the region's buffers come to exist, not the region itself.
- Their relation, when both are shown: the mempool's buffers lie in the packet-buffer region (I3) — a
  **residence**, already expressible. Where its mbufs lie is not stated by the repository.

The repository does not support making them the same object, and does not state every detail of how
they differ.

## 8. Relationship Impact

| Relationship | Impact |
| --- | --- |
| Connection | unchanged — nothing in the family attaches structurally |
| Residence | unchanged — expresses elements in a pool, and a pool in host memory, when those become instances; the parent must be a part |
| Reference | unchanged — expresses mbuf → buffer (`buf_addr`) and descriptor → buffer, address-free |
| Interaction | unchanged — `dma` already targets `memory_buffer` |

**No new relationship is introduced.** mbuf → buffer is a **Reference**, not a Residence: the buffer
is not inside the mbuf (F9), and the mbuf holds its address (F8).

## 9. Terminology Normalization

To standardize in a later task (supported by the evidence above):

- `memory_buffer` = the canonical buffer concept; **"packet buffer"** = its presentation name.
- **mempool element** = "an mbuf and its buffer". Wording to align:
  - POOL-1 ("a set of identical buffers") — name the mbufs too, and `requires: [memory_buffer, mbuf]`;
  - `design/language.yaml` mempool silhouette comment ("preallocated buffers");
  - `draw_mempool` docstring;
  - roadmap "Composes mbufs" / "holds mbufs, which remain mbuf assets residing in it" — name the
    buffers too;
  - `dataplane.js` and the s01e03 widget "pre-allocated mbufs" — name the buffers too.
- **Never "buffers, called mbufs"** (F13). The released s01e03 narration stays as recorded; new text
  must not repeat it.
- mbuf state machine: a release that returns the mbuf to its pool (C3) — a later actor-model fix,
  not part of this decision.

## 10. Future Asset / Part Implications

| Concept | For now | Candidate | Evidence still needed |
| --- | --- | --- | --- |
| `memory_buffer` | concept-only | **Part** — structure of a pool element (and, without a pool, of host memory's region); it never moves | which asset holds it as a part (mempool vs an element) |
| `mbuf` | concept-only | **Asset (micro)** — the handle that changes hands and is studied alone (s01e02) | whether it resides in a mempool part, and its anchors in the registry's terms |
| `mempool` | concept-only | **Asset (standard)** — allocated as a whole, with its own lessons | the part its elements' buffers (and mbufs) are placed in |

All three relationships they need — mbuf resides in a pool part, mbuf refers to its buffer, pool
resides in host memory — are expressible today. None is created by this decision.

## 11. Remaining Open Questions

1. **Asset/Part split of the element.** Is the buffer a part of the mempool (with the mbuf an asset
   residing in the pool and referring to it), or does a pool expose one part per element half?
2. **Where mbufs lie** relative to host memory's regions — not stated (the buffers' place is).

Contiguity and memory layout of the pair are not open questions for AxioByte: the repository does not
need them, and Model C does not depend on them.

## 12. Next Step

**Record Model C in the `mempool` concept** — restate POOL-1 so its elements are an mbuf and its
buffer, and add `mbuf` to its `requires` — as a concept-library change on its own, before any asset or
wording alignment.
