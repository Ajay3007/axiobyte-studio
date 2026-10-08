# Semantic Relationship Checkpoint

An audit of the composition semantics as they stand after v1.2.0 — Residence, References, the
standalone Descriptor Ring and its integration into `nic_host` (all unreleased development work on top
of `experiences-v1.2.0`). It answers one question:

> Can AxioByte Studio model the next layer of NIC receive-path semantics without changing the
> fundamental relationship architecture?

**Short answer: yes, with two vocabulary decisions first.** The four relationships are distinct, each
is validated, none is drawn by default, and none carries runtime state. What is missing is not a
relationship but two definitions the concept library has left loose: what a *buffer* is (packet buffer,
`memory_buffer`, mbuf), and what a *NIC queue* is (the `nic_queue` concept describes a ring). Every
next concept — mbuf, mempool, packet buffer, queue association — sits on one of those two.

Evidence is cited by file. Nothing was changed to write this report.

## 1. Current Model

```text
CONCEPT (concepts/library)        meaning: objectives, misconceptions, anchors
   │ realised by one
ASSET (assets/library.yaml)       identity · version · parts · ports · resides_in · refers_to · renderers · page
   ├── PART        meaningful, inspectable piece of one asset          host_memory.descriptor-region
   │     └── ANCHOR  named point on a part, in a renderer's terms       descriptors.head, lands.pcie
   ├── DETAIL      geometry below meaning, never registered            DRAM packages, printed base
   └── PORT        structural attachment → part.anchor list             cpu.memory_interface → lands.memory

COMPOSITION (assets/compositions/<id>.yaml, schema version 1)
   instances     instance → asset             rx_ring: descriptor_ring
   placement     explicit transform, scale 1  where a renderer draws it — layout, not meaning
   connections   port ↔ port   (mate | route) STRUCTURE         nic.pcie_connector ↔ pcie.endpoint
   residence     child → instance.part        LOCATION          rx_ring → memory.descriptor-region
   references    part → instance.part         HOLDS AN ADDRESS  rx_ring.descriptors → memory.packet-buffer-region
   interactions  concept, from, to, via       BEHAVIOUR         dma: nic → memory.packet-buffer-region
```

Allowed pairings are declared on the asset (`connects_to` per port, `resides_in`, `refers_to`) and
checked against every composition by `tests/unit/test_compositions.py`; the runtime copy
(`renderers/three/src/compositions/nic_host/contract.json`) is the YAML plus the ports it uses, kept
identical by the same test.

## 2. Relationship Matrix

| Relationship | Meaning | Static/Runtime | Valid Targets | Must NOT Mean | Visualized? |
| --- | --- | --- | --- | --- | --- |
| **Connection** (`mate`, `route`) | two assets are structurally attached at named ports | static | `instance.port` ↔ `instance.port`, each port's `connects_to` answering the other (or generic) | data flow, location, an address, ownership | yes — a mate by placement (anchors meet), a route as a schematic ribbon |
| **Residence** | an asset instance lives in a part of another instance | static | child instance → `instance.part`, child's `resides_in` listing the parent's asset; one parent per child | ownership, allocation, addresses, capacity, parent transforms, visual nesting, attachment | no — placement is independent; one renderer side effect (§9) |
| **Reference** | a part holds values identifying what a part of another instance represents | static, aggregate | `instance.part` → `instance.part`, two different instances, source's `refers_to` listing the target's asset | ownership, lifetime, allocation, which slot names which buffer, an address value, DMA, queue association, a drawn link | no |
| **Interaction** | something happens between instances: a concept whose kind is `interaction` | runtime behaviour, declared statically (which interaction, between whom, through what) | `from`/`to`/`via` = instances or `instance.part`; concept must be `kind: interaction` | structure, a port, a part of any asset | yes — composition-owned drawing (`dmaFlow`) |

Rules each has that the others do not (all in `tests/unit/test_compositions.py`): a connection kind is
only `mate` or `route` and names ports; residence and reference name parts and reject ports with a
specific error ("a port, not a part"); a resident is never also connected to its parent; an
interaction concept must be an interaction (`pointer` written as one is rejected). Unknown sections and
unknown reference fields (`address`, `slot`, `capacity`, …) are errors, so none can drift in silently.

**Ambiguity found:** the word *reference* means two things in the repository. In compositions it is
this static relationship; in the Manim pipeline `REFERENCE` is an **action** — a runtime event
(`scene.apply(REFERENCE, "packet#1", by="mbuf#1")`, s01e02) whose invariant is "taking a reference
moves no bytes". They are consistent (the event creates the static fact) but share a name.

## 3. Residence Audit

**Current implementation.** `nic_host.yaml`: `residence: { rx_ring: memory.descriptor-region }`;
`descriptor_ring` declares `resides_in: [host_memory]`. Keyed by child, so one parent per instance by
construction. Validation (`residence_errors`): child and parent are instances, the parent part exists,
the child's asset allows the parent's asset, no self-residence, no `instance` or anchor-path forms, not
also a connection. Placement is separate: `rx_ring` sits at `[-10.5, 0, 10.2]` in front of the map, at
scale 1, not inside the 2 × 4.5 cm region.

**Strengths.**
- Location only. No field for ownership, allocation, address, capacity or transform exists — and the
  unknown-section rule means none can be added by accident.
- Semantic, not visual: the ring is drawn beside the region; the page explains the residence in text
  and in its label ("resides in host memory · descriptor region"); no connector is drawn.
- The parent is a *part*: the ring lives in the descriptor region, not in host memory in general.

**Ambiguities.**
- *Physical containment vs residence.* Physical containment inside one asset (DRAM chips on a DIMM) is
  Part/Detail, never residence; residence relates two separately existing instances. The docs say
  both, but in different places (README §2; composition.md, Residence) — not side by side.
- *Mobility.* README's tie-breaker classifies the mbuf as an asset because it "changes hands, though
  its memory never leaves the pool". Residence stays constant while ownership moves — correct, but it
  means "who has the mbuf now" can never be expressed by residence and must not be.

**Future risks.**
- *Mempool ⊃ mbuf.* Expressible as `mbuf_0: pool.<part>` — but the parent must be a part, so a future
  mempool asset must expose one (its element array). Not a schema change; an asset-design requirement.
- *Many residents.* A pool holds thousands of mbufs; residence is per instance. A composition would
  show a few representative instances, as the ring shows eight descriptors. No aggregate residence
  exists, and none is needed until a composition must say "all of a pool's mbufs".
- *Host memory ⊃ regions.* Regions are parts of `host_memory`; residence is for *assets* living in
  them. If a region ever became an asset, it would reside in host memory and the ring would reside in
  it — chains are allowed (no cycle check, because one-parent-per-child makes cycles a design error,
  not a likely accident; worth a test only when the first chain exists).

**Smallest required change:** none now.

## 4. Reference Audit

**Current implementation.** `references: [{ from: rx_ring.descriptors, to: memory.packet-buffer-region }]`;
`descriptor_ring` declares `refers_to: [host_memory]`. Static and aggregate: *the descriptors* refer
to *buffers in that region*. No slot index, no address, no binding. Validation (`reference_errors`):
a list of entries with exactly `from` and `to`; both `instance.part`; different instances; source's
`refers_to` allows the target's asset; duplicates rejected; any extra field (`address`, `slot`,
`capacity`, `ownership`, `queue`, `dma`, …) rejected. Not drawn: no arrow joins the ring to the buffers.

**descriptor → packet-buffer-region.** Correct for what the repository states: a descriptor "holds the
address of a packet buffer" (host-memory metadata, `descriptor_ring` concept RING-1, the ring's part
metadata). It does not imply ownership, lifetime, a binding or a transfer — the `dma` interaction to
the same region is a separate entry, and the composition tests prove the DMA path is identical with
and without the ring.

**Future descriptor → mbuf / buffer.** The model can express each, but the repository has not yet said
which is true:

| Candidate | What the repository says |
| --- | --- |
| descriptor → buffer | RING-1: "each slot points at a free buffer"; host-memory metadata: a descriptor holds "the address of a packet buffer". Supported. |
| descriptor → mbuf | Not stated anywhere. (In DPDK the descriptor holds the *data buffer's* DMA address; the driver keeps the mbuf pointer separately — not in the repository.) |
| mbuf → buffer | `mbuf` concept MBUF-1: "metadata plus buf_addr … buf_addr is the address of the bytes"; s01e02 shows `mbuf.buf_addr` equal to the buffer's address. Supported, and expressible as a reference from an mbuf part. |

Two limits of the current shape will matter then: a reference's **target must be a part** (an mbuf
referring to "that buffer instance" would need the buffer to expose a part, or the rule to allow a bare
instance), and **`refers_to` is per asset**, not per part (any part of the source may be the `from`).
Neither is a problem today.

**Naming ambiguity (unresolved by the repository).**
- `memory_buffer` — atomic concept: "a fixed region of memory at a fixed address" (BUF-1), states
  free/filled/in_use. The `dma` interaction is defined `between: [nic, memory_buffer]`.
- *packet buffer* — no concept. Exists as the host-memory part `packet-buffer-region`, in page text,
  and in narration ("fixed-size packet buffers").
- `mbuf` — atomic concept: metadata plus `buf_addr`; misconception ZC-M3 "the mbuf IS the packet".
  Docs now consistently say mbuf ≠ packet buffer (cleaned up in this cycle).
- `mempool` — atomic concept: "a set of identical buffers allocated once" (POOL-1) — buffers, not
  mbufs; README and roadmap say a mempool holds mbufs; s01e02 DMA-writes `into="mempool#1"`.

**The decision that must eventually be made:** is a packet buffer the `memory_buffer` concept (and is
it ever an asset, or always a part of host memory / of a mempool element), and does a mempool hold
buffers, mbufs, or mbufs-with-their-buffers? That decides what a descriptor's reference targets, what
an mbuf's reference targets, and where both reside.

## 5. Interaction Audit

**Current.** `interactions: [{ concept: dma, from: nic, to: memory.packet-buffer-region, via: [pcie, cpu.io, cpu.memory-controller] }]`.
Validated as an interaction concept between instances and their parts. Drawn by the composition as a
dashed path with pulses.

**Separation from the reference: correct.** They are different entries in different sections; the
reference states what descriptors hold, the interaction states that the NIC writes bytes. Removing the
ring from the contract leaves the DMA path point-for-point identical (`composition-nic-host.test.js`).

**Future descriptor events.** Descriptor fetch and write-back, buffer DMA and packet arrival are each
an interaction (or a runtime event in a film), and the shape supports them: a concept, endpoints, a
path. What is missing is **concepts**, not schema: `dma` is defined by DMA-1 as packet bytes
(`between: [nic, memory_buffer]`), so a descriptor fetch is either a widened `dma` or a new interaction
concept — undecided, and documented as undecided (composition.md, Interactions).

**Ambiguity.** The validator checks that an interaction's concept is an interaction and that its
endpoints exist; it does not check that the endpoints realise the concept's participants (`nic`,
`memory_buffer`). `to: memory.packet-buffer-region` is accepted because the part exists, not because
it is a `memory_buffer`. Harmless with one interaction; it becomes relevant once there are several.

## 6. Connection Audit

**Current.** Three connections, all structural: `nic.pcie_connector ↔ pcie.endpoint` (mate, gap 1.02,
opposed facings), `pcie.root_complex → cpu.pcie_root_complex` (route, 8 → 1 bundle),
`cpu.memory_interface → memory.memory_interface` (route, 1 → 2 bundle). Ports resolve to anchors on
physical parts (lands, DIMM edges, slot, card edge).

**Not misused.** None of descriptor → buffer, NIC → buffer DMA, ring → memory or queue association is
a connection: the descriptor ring has `ports: []`; the registry comments state "DMA, reads, writes and
allocation are interactions, not ports"; README §6 states residence is not a port; the connection
validator rejects a `residence` or `references` kind; a resident may not also be connected to its
parent.

**Ports and anchors: clean**, with one known vocabulary gap outside compositions: Manim actors keep
their own anchor names (`host_memory`: `descriptor_region`; `descriptor_ring`: `head, tail, slot`)
while registry parts use kebab-case ids and the ring's part is `descriptors`. Compositions are
Three.js-only today, so this does not bite yet.

## 7. Asset/Part Audit

| Concept | Current classification | Evidence | Relationships it would need | Part or asset now | Missing |
| --- | --- | --- | --- | --- | --- |
| **Descriptor Ring** | Asset (`production`, unreleased) | registry entry; `/memory/descriptor-ring/`; `rx_ring` in `nic_host` | residence (done), reference (done), queue association (deferred), descriptor-fetch interaction (deferred) | Asset — settled | released status; queue association |
| **Descriptor** | Part of the ring (`descriptors`, aggregate); `slot` anchor is a representative entry | registry comment; roadmap "Part — graduates"; README tie-breaker "slots never leave" | none of its own while it is a part; per-descriptor state is runtime | Part | nothing — graduates only if its field layout is studied alone |
| **NIC Queue** | Concept only (`nic_queue`); text in NIC controller metadata ("RX/TX queue contexts"); film text | `concepts/library/atomic/nic_queue.yaml`; `nic/metadata.js`; s01e03 storyboard | queue ↔ ring association; the queue's home (a NIC part?) | Neither yet — not a part, not an asset | a definition that separates the queue from the ring (§7 below) |
| **mbuf** | Concept + Manim actor; roadmap: future micro asset | `mbuf.yaml` (MBUF-1, ZC-M3); s01e02 cast; README tie-breaker | residence in a mempool part; reference `buf_addr` → buffer | Not yet | the buffer decision (§4) |
| **Packet Buffer** | Part of host memory (`packet-buffer-region`); no concept of that name | registry; host-memory metadata; roadmap row "Part — undecided" | target of descriptor and mbuf references; DMA target | Part | the buffer decision (§4) |
| **Mempool** | Concept + Manim actor; roadmap: future standard asset | `mempool.yaml` (POOL-1: identical *buffers*); README/roadmap: holds *mbufs* | residence in host memory; a part for its elements to reside in | Not yet | what its elements are (§4) |

**NIC Queue in detail.** The repository holds three statements that do not yet agree:

- `nic_queue` concept: "A NIC queue is a ring of descriptors the card fills and software drains"
  (NICQ-1), `requires: [nic]`, anchors `head, tail`.
- `descriptor_ring` concept: the ring in host memory, `requires: [nic_queue, memory_buffer]`, anchors
  `head, tail, slot`.
- NIC metadata: the controller "holds the … RX/TX queue contexts"; up to 128 RX / 128 TX per port.

So the queue is described both *as* a ring and as *context on the card* that a ring belongs to; both
concepts claim `head` and `tail`. The relationship cannot be chosen yet — *owns*, *references* (the
queue context holds the ring's base address) and *associated with* are each plausible and the
repository commits to none. That is the correct state: queue association is listed as deferred in
the registry, `composition.md` and both pages, and no contract encodes it. What is needed before
choosing a relationship is a concept decision: is `nic_queue` the NIC-side queue context (a NIC part,
which then *refers to* its ring, the same Reference already built) or the queue-as-ring pairing?

## 8. Static vs Runtime Boundary

| Concept | Classification | Where it lives today |
| --- | --- | --- |
| ring resides in memory | static composition semantics | `nic_host.yaml` `residence` |
| descriptor references buffer | static composition semantics | `nic_host.yaml` `references` |
| descriptor slot → buffer binding | runtime state | nowhere in contracts; illustrated only in the standalone Host Memory map (`POSTED` in `layout.js`) |
| head/tail values | runtime state | nowhere; head/tail are fixed illustrative anchors and printed marks |
| descriptor ownership (NIC vs software) | runtime state | nowhere; described in page text |
| buffer allocation | runtime event (Manim `ALLOCATE` action) | not in compositions |
| DMA | runtime event, declared as a static interaction | `interactions`; drawn by the composition |
| descriptor fetch | runtime event | deferred; no concept |
| descriptor writeback | runtime event | deferred; no concept |
| packet arrival | runtime event | films (s01e03), not compositions |
| queue association | static composition semantics (configuration-time), when modelled | deferred |

No runtime state is encoded in the static contract. The unknown-field rules on references and the
unknown-section rule on compositions make it hard to add by accident.

## 9. Renderer Boundary

**Correctly separated.**
- `references` is not read by the Three.js composition at all; nothing is drawn for it.
- `residence` is read once, for a rendering decision only: `composition.js` `hasResidentRing()` builds
  host memory with `illustrativeRing: false` when a `descriptor_ring` instance resides in that
  instance's `descriptor-region`. The option lives on the asset's factory, not in the schema; the
  standalone Host Memory page keeps its ring (tested).
- Placement of the ring is explicit in the contract, not derived from host-memory geometry.

**Renderer-owned knowledge worth knowing about (not semantic errors).**
- The suppression rule names `descriptor_ring` and `descriptor-region` in renderer code: one asset
  pairing, hard-coded. Correct for one case; a second resident kind would need its own line.
- The DMA path is assembled by hand in `composition.js`: it ignores `via`, hard-codes the target's
  `.buffer` anchor, and routes through `dimms[0]` — a claim about which module holds the buffer that
  the contract never makes. The contract's interaction is right; its realisation is specific.
- The standalone Host Memory map draws an illustrative slot → buffer binding (`POSTED`) and
  posted/free buffers — runtime-shaped illustration inside an asset page. Hidden in `nic_host`; it is
  the one place runtime state is *depicted*, and only as illustration.

No renderer invents a semantic relationship the contract lacks.

## 10. Receive-Path Readiness

Simulated composition: NIC → PCIe → CPU root complex → host memory, with the RX ring in the descriptor
region and buffer objects in the packet-buffer region.

| Step | Category | Why |
| --- | --- | --- |
| NIC → PCIe → CPU → host memory structure | **READY** | connections, released and tested |
| RX ring resides in the descriptor region | **READY** | residence, in `nic_host` |
| descriptors refer to buffers (region) | **READY** | reference, in `nic_host` |
| NIC DMA writes the packet into a buffer | **READY** | `dma` interaction, unchanged |
| buffer objects (mbuf / buffer) in the packet-buffer region | **NEEDS DESIGN** | residence can place them; what they are is the open buffer decision |
| descriptor → mbuf or → buffer object | **NEEDS DESIGN** | reference can express either; which is true is undecided |
| mempool containing its elements | **NEEDS DESIGN** | needs a mempool part to reside in, and the element decision |
| ring belongs to an RX queue | **NEEDS DESIGN** | `nic_queue` must first be defined apart from the ring |
| NIC fetches a descriptor / writes status back | **NEEDS DESIGN** | an interaction concept to choose (`dma` widened or a new one) |
| packet arrives on the wire | **DEFERRED** | runtime event; films handle it; no composition need yet |
| descriptor/ring state changes (head, tail, done) | **DEFERRED** | runtime state, deliberately outside contracts |
| CPU processes completion (polling) | **DEFERRED** | `polling` interaction concept exists; no composition need yet |

## 11. Findings

### No Change Required
- The four relationships are distinct in meaning, schema and validation; none is drawn by default
  except connections and the DMA interaction, which are meant to be.
- Residence carries location only; Reference carries "holds an address" only; neither admits
  addresses, slots, capacity, ownership or transforms.
- Connections are used only for physical/structural attachment; no semantic relationship hides in one.
- The static contract contains no runtime state.
- The renderer reads residence for one rendering decision and reads references not at all.

### Ambiguity To Resolve Later
1. **Buffer vocabulary** — packet buffer vs `memory_buffer` vs mbuf; what a mempool holds (§4).
2. **NIC queue vs descriptor ring** — `nic_queue` is defined as a ring; both concepts claim head/tail (§7).
3. **Descriptor fetch / write-back** — `dma` widened, or a new interaction concept (§5).
4. **"Reference"** names both the static composition relationship and a Manim runtime action (§2).
5. **Interaction participants** are not checked against the concept's `between` (§5).
6. **Reference and residence targets must be parts** — a bare-instance target (mbuf → its buffer
   instance) is not allowed yet (§4).
7. **Manim anchor vocabulary** differs from registry part ids (§6).

### Actual Architectural Problem
None found. The open items are undefined *concepts* and renderer-specific realisations, not flaws in
the relationship architecture.

## 12. Recommended Next Step

**Write a concept-level decision for the buffer family — `memory_buffer`, packet buffer, mbuf,
mempool — in the concept library and asset docs, before any of them becomes an asset.** It must state
what a packet buffer is (and whether it is `memory_buffer`), what a mempool's elements are, what a
descriptor's reference targets and what an mbuf's `buf_addr` reference targets. No schema, registry
or renderer change: the relationships to express each answer already exist.
