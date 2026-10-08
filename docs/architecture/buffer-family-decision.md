# Buffer Family Decision

What the repository means by `memory_buffer`, packet buffer, `mbuf` and `mempool`, established from
its own concepts, visual language, actors, actions, episodes, pages and asset docs. A definition
task only: nothing here creates an asset, changes a contract or picks a side the repository has not
picked. It follows [`semantic-relationship-checkpoint.md`](semantic-relationship-checkpoint.md), which
found the relationship model sound and this vocabulary the next prerequisite.

## 1. Executive Summary

**Established by the repository.**

- **A buffer is `memory_buffer`, and "packet buffer" is its name in use.** The concept is general
  ("a fixed region of memory at a fixed address", BUF-1), but every place it is used holds packet
  bytes, and the Manim backend draws the `memory_buffer` actor with the title *packet buffer*. No
  `packet_buffer` concept exists; the two terms are one concept and one display name.
- **An mbuf is metadata that holds a buffer's address (`buf_addr`), never the bytes.** The concept,
  its misconception, its visual rule, its actor, the s01e02 narration and the asset docs all say so.
- **A descriptor refers to a buffer.** Every source that says what a descriptor points at says a
  buffer; none says an mbuf.

**Still ambiguous.**

- **What a mempool's elements are.** The knowledge model (concept, visual language, s01e02, Manim
  actions) says a mempool holds *buffers*; the asset docs, the NIC-domain dataplane widgets and parts
  of s01e03 say it holds *mbufs*; one s01e03 script sentence calls mbufs "buffers". How an mbuf and
  its buffer relate inside a pool is not established.
- **How a mempool relates to host memory's `packet-buffer-region`.** Both are described as the place
  pre-allocated packet buffers live; the repository never says whether they are the same thing.

**A terminology decision is possible now for buffer, mbuf and the descriptor's target, and not yet for
mempool.** Overall: **PARTIALLY DEFINED** (§10). No relationship change is needed (§11).

## 2. Evidence From Repository

### `memory_buffer`

- `src/axiobyte_studio/concepts/library/atomic/memory_buffer.yaml` — BUF-1: "A buffer is a fixed
  region of memory at a fixed address. Its address is its identity." States `free, filled, in_use`;
  anchors `start, end, address`; requires nothing.
- `src/axiobyte_studio/design/language.yaml` — `memory_buffer`: role `memory`, silhouette
  `framed_region` ("a purple frame HOLDING blue payload"), motion `none` ("memory does not travel.
  Ever."), never "travelling" or "containing anything but payload or emptiness".
- `src/axiobyte_studio/backends/manim/shapes.py` — `draw_memory_buffer`: "A buffer: a memory frame
  holding payload, or holding nothing yet", titled **"packet buffer"** on screen.
- `src/axiobyte_studio/actors/library.py` — `MEMORY_BUFFER`: buffer state machine (`allocate`,
  `dma_write`, `reference`, `release`), default `address="0x7f3a4c00"`, `bytes=2048`.
- Interactions defined on it: `dma` `between: [nic, memory_buffer]`; `zero_copy`
  `between: [pointer, memory_buffer]`. Required by `descriptor_ring`, `mbuf`, `mempool`.
- Episodes: s01e01 casts kernel and app buffers (packet bytes copied between them); s01e02 casts the
  zero-copy buffer at the same address as the mbuf's `buf_addr`.

### packet buffer / `packet_buffer`

- **No concept.** `packet_buffer` appears once, in `ARCHITECTURE.md` §1, as a shape name of the
  reference episodes being replaced.
- `assets/library.yaml` — `host_memory` part `packet-buffer-region`; limitation: packet buffers "are not
  mbufs (an mbuf holds a buffer's address), and whether they become an asset is undecided".
- `renderers/three/src/domains/memory/host-memory/metadata.js` — `packet-buffer-region`: "many
  fixed-size buffers, allocated in advance … often as a pool of identical buffers"; tile "PACKET
  BUFFERS · fixed size · filled by the NIC"; 12 drawn, 8 posted.
- s01e02 narration (`timeline/words.json`): "DPDK allocates a large collection of fixed-size packet
  buffers. This collection is called a mempool." · "every stage … works with the same packet buffer" ·
  "The packet buffer never moves." `picture.md` invariant: "The packet buffer never moves after DMA has
  written it."
- `docs/asset-library/roadmap.md` — row "Packet buffer · Part of host memory (`packet-buffer-region`) —
  undecided".

### `mbuf`

- `concepts/library/atomic/mbuf.yaml` — MBUF-1: "An mbuf is metadata plus buf_addr. Everything above
  buf_addr is bookkeeping; buf_addr is the address of the bytes." States `pooled, attached, freed`;
  anchors `buf_addr, data_len, refcount, next`; requires `memory_buffer, pointer`.
- `concepts/library/interaction/zero_copy.yaml` — misconception ZC-M3 "The mbuf IS the packet",
  refuted by "Zoom into the mbuf: metadata plus buf_addr. The bytes are elsewhere."
- `design/language.yaml` — `mbuf`: silhouette `metadata_card` ("fields, with buf_addr as the
  load-bearing one"), motion `pointer.snap` ("travels like what it is: a handle"), never "containing
  the payload bytes".
- `backends/manim/shapes.py` — `draw_mbuf`: "metadata, and — crucially — `buf_addr` … the pointer
  itself".
- `CONCEPT-ARCHITECTURE.md` §6.1 — "`mbuf.buf_addr → packet.first_byte` is a semantic link".
- s01e02: `cast(MBUF, buf_addr="0x7f3a4c00")` equal to the buffer's address;
  `apply(REFERENCE, "packet#1", by="mbuf#1")`; narration "a small metadata structure attached to the
  packet", "a handle that points to the original packet buffer", "Only the mBuff, the handle to that
  data, was passed".
- s01e03 script step eight: "hands your application the packets as ready-to-use buffers, called mbufs,
  pulled from a pre-allocated pool called a mempool" — **the one source that calls mbufs buffers**.
- `docs/asset-library/roadmap.md` — "mbuf (packet metadata) · the handle to a packet: metadata and
  `buf_addr` … not the buffer itself"; README tie-breaker: "An mbuf is handed out by its mempool,
  passed along and returned — it changes hands, though its memory never leaves the pool".

### `mempool`

- `concepts/library/atomic/mempool.yaml` — POOL-1: "A mempool is a set of identical **buffers**
  allocated once, up front, so no allocation happens on the fast path." Anchors
  `first_slot, last_slot`; requires `memory_buffer`.
- `design/language.yaml` — `mempool`: silhouette `slot_grid` ("many identical preallocated
  **buffers**"), motion `allocate.ripple`.
- `backends/manim/shapes.py` — `draw_mempool`: "A pool of preallocated **buffers**."
- `actions/library.py` — `ALLOCATE` subjects `mbuf, memory_buffer`, param `from_pool`; `RELEASE`
  "Returning a buffer to its pool. The same verb for an mbuf, a raw buffer and a packet". `mbuf` state
  `pooled`.
- s01e02: "fixed-size packet buffers. This collection is called a mempool" · "DMA … into a free
  buffer in the mempool" · "that buffer is returned to the mempool"; `apply(DMA_WRITE, …,
  into="mempool#1")`.
- s01e03: beat `rx_ring.mempool` intent "the buffers come from a pool allocated up front"; script TX
  step five "the driver returns that **buffer** to the mempool"; film subtitle "the **mbuf** goes back
  to the mempool"; widget text "MEMPOOL · pre-allocated **mbufs**".
- `renderers/three/src/domains/networking/dataplane.js` — `mempool`: "Pre-allocated **mbufs** in
  hugepage memory."
- `docs/asset-library/roadmap.md` — "Mempool · Composes **mbufs**"; "holds **mbufs**, which remain mbuf
  assets residing in it"; README tie-breaker, as above.

## 3. Current Semantic Definitions

| Term | Current Meaning | Evidence | Ambiguity |
| --- | --- | --- | --- |
| `memory_buffer` | a fixed region of memory at a fixed address that holds payload or nothing; its address is its identity; it never moves | BUF-1; visual language; Manim actor and drawer; `dma` and `zero_copy` participants | the concept is general, every use is packet bytes — not a contradiction, but nothing says so |
| packet buffer | the `memory_buffer` concept in its packet role — the name it is drawn and narrated by | Manim title "packet buffer"; s01e02 narration and `picture.md`; host-memory metadata and tile | no concept id; `packet-buffer-region` names a host-memory **region** of many buffers, not one buffer |
| `mbuf` | metadata about a packet, holding `buf_addr` — the address of the buffer with the bytes; a handle passed between stages; never contains the bytes | MBUF-1; ZC-M3; visual language; Manim; s01e02; roadmap; README | s01e03 script calls mbufs "ready-to-use buffers"; "attached to the packet" (s01e02) leaves how an mbuf sits next to its buffer undefined |
| `mempool` | a set of identical things allocated once, up front, so the fast path never allocates | POOL-1; visual language; s01e02; actions | **what the things are**: buffers (concept, visual language, s01e02, s01e03 beat and TX script, `RELEASE`) or mbufs (asset docs, `dataplane.js`, s01e03 widget and TX subtitle, `mbuf` state `pooled`) |

## 4. Buffer Family Model

What the evidence supports, as **meaning** — not a containment hierarchy to build:

```text
Host memory (asset)
   └── packet-buffer-region (part)        "many fixed-size buffers, allocated in advance"
         └── buffer, buffer, buffer …     memory_buffer — drawn as artwork, not parts or assets
               ▲                ▲
               │ refers to      │ refers to (buf_addr)
         descriptor          mbuf          ← metadata, not storage
```

Supported: buffers lie in host memory's packet-buffer region (host-memory metadata and map, s01e02,
s01e03 step five); descriptors and mbufs each hold a buffer's address.

**Missing:** where the mempool sits in this picture. Host-memory metadata says the buffers are
allocated "often as a pool of identical buffers", and s01e02 says the collection of packet buffers "is
called a mempool" — which reads as *the packet-buffer region holds a mempool's buffers*, but no source
states it, and none says whether a mempool and the region are the same thing, one inside the other, or
unrelated. Individual buffers are not parts of host memory today, and nothing defines them as such.

## 5. Mbuf Model

The repository draws a firm line between **metadata** and **storage**:

| | Is | Holds | Moves? |
| --- | --- | --- | --- |
| buffer (`memory_buffer`) | storage: a fixed region at a fixed address | the packet bytes, or nothing | never ("The packet buffer never moves") |
| mbuf | metadata: bookkeeping fields plus `buf_addr` | the buffer's address, length, refcount, next — never the bytes | passed between stages as a handle (ownership changes, location does not — `FORWARD`: "forwarding changes ownership, never location") |
| `buf_addr` | the reference: an address | the buffer's address | — |
| packet data | the bytes | — | written once by DMA, then still |

So: **mbuf → buffer is a reference** (`buf_addr`), and the mbuf is not the packet (ZC-M3). The repository
does not establish whether an mbuf is stored next to its buffer, inside the same pool element, or
separately: "attached to the packet" (s01e02) is the only hint. **Repository does not currently
establish this distinction.**

## 6. Mempool Model

- **What it is.** A set of identical items allocated once, up front, so the fast path never allocates
  (POOL-1). Plural at a glance (visual rule: never fewer than 4 slots). Items are handed out
  (`ALLOCATE … from_pool`) and returned (`RELEASE`).
- **What it contains.** Unresolved. Buffers per the knowledge model; mbufs per the asset docs, the
  NIC-domain widgets and parts of s01e03. Both views are internally consistent; the repository never
  reconciles them, and never describes a pool element as an mbuf together with its buffer.
- **What it does NOT mean.** Not ownership of what it has handed out (an mbuf "changes hands, though
  its memory never leaves the pool" — README); not a queue or a ring; not DMA (the NIC writes into a
  buffer that came from the pool; the pool itself does nothing at run time).
- **Unresolved.** (1) its elements; (2) its relation to host memory's `packet-buffer-region`; (3)
  whether the `mbuf` state `pooled` means "an mbuf in the pool" or "an mbuf whose buffer is in the
  pool".

## 7. Descriptor Reference

**A descriptor refers to a buffer.** The evidence is unanimous:

- `descriptor_ring` RING-1: "each slot points at a free buffer for the NIC to fill".
- `host-memory/metadata.js`: a descriptor holds "the address of a packet buffer".
- `descriptor-ring/metadata.js`: software writes "the address of an empty packet buffer" into it.
- s01e03 step seven: "here's a free buffer, put the next packet here"; film card "ONE DESCRIPTOR · a
  pointer to a free buffer"; TX ring "each points at a buffer holding the frame".

No source says a descriptor refers to an mbuf. Evaluated forms:

| Form | Verdict |
| --- | --- |
| Descriptor → buffer (`memory_buffer`) | **supported** — the descriptor holds the buffer's address |
| Descriptor → packet buffer | the same, by name |
| Descriptor → memory buffer | the same, by concept id |
| Descriptor → mbuf | **not supported** by any source |

The current contract — `rx_ring.descriptors → memory.packet-buffer-region` — is the same claim at the
granularity the composition has: buffers are not instances, so the reference targets the region that
holds them. It stays correct when buffers gain identity; only its target becomes finer.

## 8. Relationship Mapping

Using only Connection, Residence, Reference and Interaction:

```text
Descriptor ──Reference──► Buffer                     justified (§7)
mbuf ──Reference (buf_addr)──► Buffer                justified (§5)
NIC ──Interaction (dma)──► Buffer                    justified — `dma` between [nic, memory_buffer]
Buffer ──Residence──► Host memory · packet-buffer-region   justified as meaning; buffers are not instances yet
Descriptor ring ──Residence──► Host memory · descriptor-region   in place (nic_host)

Buffer ──Residence──► Mempool                        UNRESOLVED — elements undecided
mbuf ──Residence──► Mempool                          UNRESOLVED — elements undecided
Mempool ──Residence──► Host memory (which part?)     UNRESOLVED — relation to packet-buffer-region undecided
mbuf ↔ its Buffer (adjacent / same element)          UNRESOLVED — not established
```

Not static relationships at all: an mbuf's current owner (runtime ownership, `FORWARD`), a buffer's
`free/filled/in_use` state, the packet's `in_buffer` state, allocation and release (runtime events).
No new relationship type is suggested by any of this.

## 9. Future Asset / Part Candidates

| Concept | Current Status | Future Candidate | Why | Missing Decision |
| --- | --- | --- | --- | --- |
| `memory_buffer` | atomic concept + Manim actor; drawn in host memory's map as artwork | **unresolved — Part leaning** | it never moves and is structure of whatever holds it — README's tie-breaker ("contained things that are structure are parts") points to a part of its pool or region; content does study one alone (s01e02), which keeps an asset possible | what holds it: the mempool or the region |
| packet buffer | display name of `memory_buffer`; host-memory part `packet-buffer-region` (a region of many) | **Concept-only name** | the repository uses it as a name, not a separate thing | whether to record it formally as `memory_buffer`'s name |
| `mbuf` | atomic concept + Manim actor; roadmap: micro asset | **Asset (micro) — consistent with the roadmap** | it changes hands between stages, refers to its own buffer, and is studied alone (s01e02 zoom) | where it lives (pool element?) and how it sits next to its buffer |
| `mempool` | atomic concept + Manim actor; roadmap: standard asset | **Asset — consistent with the roadmap, contents unresolved** | allocated as a whole, its own lessons (POOL-1, s01e03 beat) | its elements; its relation to `packet-buffer-region` |

## 10. Terminology Decision

**PARTIALLY DEFINED.**

Defined by the evidence:
1. Buffer = `memory_buffer`; "packet buffer" is its name in packet contexts; there is no separate
   packet-buffer concept.
2. mbuf = metadata holding `buf_addr`, a reference to a buffer; never the bytes.
3. A descriptor refers to a buffer, not an mbuf.

Needs a later decision:
1. **What a mempool element is** — a buffer, an mbuf, or an mbuf with its buffer — and therefore what
   resides in a mempool.
2. **How a mempool relates to host memory's `packet-buffer-region`.**
3. **Where an mbuf sits relative to its buffer** (follows from 1).

## 11. Impact on Current Architecture

None. Every justified relationship above is one of the existing four, and every unresolved one is
unresolved for lack of a *definition*, not a relationship:

- **Connection** — not involved; no buffer-family concept attaches structurally.
- **Residence** — expresses buffers or mbufs in a pool, or a pool in host memory, once decided; the
  parent must be a part, so a future mempool asset must expose one for its elements.
- **Reference** — expresses descriptor → buffer and mbuf → buffer as they stand; a finer target than
  `packet-buffer-region` needs buffers to have identity (a part, or an instance).
- **Interaction** — `dma` already names `memory_buffer` as its participant.

The current `nic_host` reference stays correct as is. The text inconsistencies listed in §3 (s01e03
script "buffers, called mbufs"; mempool described with mbufs in the asset docs and NIC-domain widgets)
are wording to align once the mempool decision is made — not architecture.

**NIC queue.** The buffer-family decision does not depend on the unresolved NIC queue ↔ descriptor
ring relationship: a descriptor refers to a buffer whichever queue its ring serves, and nothing about
buffers, mbufs or mempools names a queue. Queue semantics remain independently deferred.

## 12. Next Step

**Decide what a mempool element is — a buffer, an mbuf, or an mbuf with its buffer — and record it in
the `mempool` concept.** That one decision settles what resides in a mempool, how an mbuf sits next to
its buffer, and which texts to align; the mempool's relation to `packet-buffer-region` follows from it.
