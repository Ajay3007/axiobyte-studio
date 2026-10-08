# Compositions — the contract for the first one

A **composition** is several library assets connected through their ports to show a system
(README.md §2, §6). This document fixes the decisions and the minimum contract compositions are
built against. The first, `nic_host`, is built to it: contract
[`assets/compositions/nic_host.yaml`](../../assets/compositions/nic_host.yaml), page
`/axiobyte/networking/nic-host/`.

> *Composition* here means a **system of assets**. ARCHITECTURE.md also has a "composition layer"
> (§1, row 14; `abs compose`): assembling rendered shot clips into a film. The two are unrelated;
> this document never means the second.

## The first composition

```text
                         CPU
              ┌──────────┴──────────┐
     pcie_root_complex        memory_interface
     (root complex part)      (memory controller part)
              │                     │
      PCIe.root_complex     HostMemory.memory_interface
              │
            PCIe
      PCIe.endpoint
              │
     NIC.pcie_connector
             NIC
```

The lesson it exists for is an interaction, drawn over that structure:

```text
NIC ──(PCIe link)──► CPU root complex ──► memory controller ──► host memory
                     └──────────────── DMA: no core copies the bytes ───────┘
```

It re-expresses the v1.1 correction — descriptor rings and packet buffers are host memory, not the
card — with real assets. It replaced the legacy `networking/HostMemory.js`, now retired, and the NIC
page's *In the host* view shows it through the same world as its own page. It must read as one
system (topology, structural links, then the interaction), not as four hero assets side by side;
its visual treatment is designed when it is built.

## Decisions

**1. No board asset.** The first composition uses exactly `nic`, `pcie`, `cpu` and `host_memory`.
The motherboard is context, not one of the things being taught; the PCIe asset already carries the
host-side slot and lanes the lesson needs; the CPU carries its own package and interfaces; host
memory carries the memory. A board asset would widen the scope before the composition model is
proven, and can come later if it becomes independently reusable and worth teaching. So: no board
in the registry, no board geometry, and no traces, DIMM slots, CPU socket, chipset, VRMs or other
slots drawn as if they were assets. The composition may add neutral grounding — a floor, a subtle
schematic surface — owned by the composition and never selectable as a part.

**2. Assets own ports; the composition owns placement.** A port is a semantic contract resolved to
anchor points in the asset's own frame (README.md §6). No asset knows where another is placed. The
composition adds each instance's transform, and resolves and validates the connections.

**3. Built on the current unreleased asset foundation.**

```text
experiences-v1.1.0 ── frozen baseline (unchanged)
        │
current unreleased Asset Library: nic · pcie · cpu · host_memory
        │
first composition, validated together with the four assets
        │
next experiences release
```

Releasing the four assets first would add an intermediate release boundary for no gain; the
composition is the first real test of their ports and should ship with them.

## Who owns what

| Layer | Owns |
| --- | --- |
| **Asset** | identity, geometry, parts, anchors, ports (and their facing, below), local interaction, local camera presets, part metadata, its renderer implementations |
| **Composition** | asset instances and their transforms, the connections between ports (including many-to-one resolution), where instances reside, what their parts refer to, grounding context, the system camera, system-level interaction, cross-asset interactions (DMA; descriptor → buffer relationships across assets) |
| **Episode** | story, beats, shots, narration, voiceover, timeline, sequencing |

A composition never edits an asset: it instantiates the asset's model, transforms it and draws
between its anchors. If a connection needs something an asset lacks, the asset gains it in its
own version — not the composition in a copy.

## The minimum contract

One declarative file per composition, in the registry's conventions (snake_case ids,
`part.anchor` references, centimetres, degrees):

```yaml
id: nic_host                       # proposed; the NIC's path to host memory
title: NIC to host memory
instances:                         # instance id → registry asset id
  nic: nic
  pcie: pcie
  cpu: cpu
  memory: host_memory
placement:                         # explicit, in the composition frame; scale is always 1
  pcie:   { position: [0, 0, 0],   rotation: [0, 0, 0] }
  nic:    { position: [..],        rotation: [..] }
  cpu:    { position: [..],        rotation: [..] }
  memory: { position: [..],        rotation: [..] }
connections:
  - { kind: mate,  a: nic.pcie_connector,  b: pcie.endpoint }
  - { kind: route, a: pcie.root_complex,   b: cpu.pcie_root_complex, label: PCIe x8 }
  - { kind: route, a: cpu.memory_interface, b: memory.memory_interface, label: memory channels }
interactions:                      # concepts from the concept library, never ports
  - { concept: dma, from: nic, to: memory.packet-buffer-region, via: [pcie, cpu.io, cpu.memory-controller] }
```

- **Instances** refer to registry assets. The composition builds each from its model entry (the
  registry's `implementations.three.entry`, e.g. `createCPU()`), never from the asset's page-level
  scene or world. The NIC is built by `createNIC()`; the host-memory panel and PCIe·DMA link its
  page scene used to draw are what this composition replaced.
- **Part ids are namespaced by instance** (`cpu.die`, `memory.dimm-0`), so two assets — or two
  instances of one — can never collide in the composition's registry.
- **Placement is explicit.** The author places every instance. There is no topology solver, graph
  layout, constraint system, collision solver or board-placement engine. Every asset shares one
  unit (cm), so scale stays 1 and mated parts meet at their real sizes.

### Connections

Two kinds, because two different things happen at a port:

| Kind | Meaning | Rule | First composition |
| --- | --- | --- | --- |
| **mate** | the parts touch: a card's edge in a slot | one anchor each side; after placement the anchors coincide (within a declared `gap`, if the assets' anchors sit a known distance apart) and the two ports face each other | `nic.pcie_connector` ↔ `pcie.endpoint` |
| **route** | a link across a board neither asset models | drawn by the composition as a labelled schematic link between anchors — never as copper, traces or slots | `pcie.root_complex` ↔ `cpu.pcie_root_complex`; `cpu.memory_interface` ↔ `memory.memory_interface` |

**Many-to-one.** A port's anchor list is its anchor set. Resolving a connection pairs the sets:

- equal counts → paired in declared order;
- one side has a single anchor → a **bundle**: every anchor on the other side meets it, drawn as
  one labelled link (fan-in or fan-out);
- anything else → a validation error.

So `pcie.root_complex` (eight `lane-N.host` anchors) meets `cpu.pcie_root_complex` (the one
`lands.pcie` field) as one x8 bundle, and `cpu.memory_interface` (`lands.memory`) meets
`memory.memory_interface` (`dimm-0.edge`, `dimm-1.edge`) as one bundle fanning out to both
modules. It is one semantic connection each time — the composition never wires CPU → DIMM 0 and
CPU → DIMM 1 as separate ports — and no asset is changed to collapse its anchors.

The NIC ↔ PCIe connection stays one-to-one and generic: `pcie.endpoint` takes any add-in card and
names no counterpart (the registry test accepts that); the composition chooses the NIC as the card.

**Facing.** Only a mate needs direction. A mated port gains an optional `facing` — a unit axis in
the asset's own frame (`+y`, `-z`, …) that points out of the interface — declared by the asset in
its registry port entry (`nic.pcie_connector` faces `+z`, out of the card edge; `pcie.endpoint`
faces `+y`, out of the slot). A mate is valid when the two
facings are opposed after placement. That is the whole orientation model: an anchor, its position,
its facing. Route connections need none.

### Interactions

DMA is an interaction concept (`concepts/library/interaction/dma.yaml`), not a port, an asset, a
connector or a tube. A composition declares it by concept, with its endpoints and the path it
passes; it may be drawn as a labelled relationship or animated, but it adds no structure.

The descriptor → buffer relationship is **not** an interaction: nothing happens in it. It is a
static reference — a descriptor holds a buffer's address — declared under References below. Inside
host memory it is still part of the asset (the pointers in its map). The NIC's DMA write into a
packet buffer is a separate thing: data movement, the `dma` interaction above. How the NIC's own
descriptor fetch and status write-back are expressed (`dma`, or a concept of their own) is
undecided.

### Residence

Where an asset instance **lives**: a descriptor ring in a host-memory region, later an mbuf in a
mempool. It is not a connection — nothing attaches, there is no facing or gap — so it has its own
optional section, never a connection kind:

```yaml
residence:                         # child instance → the instance.part it resides in
  rx_ring: memory.descriptor-region
```

| | Is | Declared by |
| --- | --- | --- |
| Part-of | intrinsic structure of one asset | the asset (`parts`) |
| Connection | structural attachment between ports | the composition (`connections`) |
| **Residence** | where an asset instance lives | the composition (`residence`), allowed by the child asset's `resides_in` |
| **Reference** | what a part holds the address of | the composition (`references`), allowed by the source asset's `refers_to` |
| Interaction | something happening between them | the composition (`interactions`), by concept |
| Placement | where a renderer draws it | the composition (`placement`) |

- The parent is a **part** of another instance (a region), never a port and never an anchor; an
  instance cannot reside in itself, and the two are not also joined by a connection.
- The child's asset must list the parent's asset in its registry `resides_in` (an allowed parent,
  not a requirement): an asset page has no residence, and a composition declares one only where
  it models the instance as living somewhere.
- Residence is **semantic only**. It places nothing — every instance keeps its explicit
  `placement`, and a renderer may draw the child inside its region or apart from it — and it says
  nothing of capacity, addresses, allocation, ownership, queue association, DMA or pointers.
- It is part of schema `version: 1`: optional, so compositions without it are unchanged, and a
  renderer that ignores it misses no structure. The runtime copy carries it as written.

`nic_host` declares the first residence: `rx_ring: memory.descriptor-region`, a `descriptor_ring`
instance (`resides_in: [host_memory]`). The ring is drawn at its own size in front of the memory map,
not nested in it, and host memory is built without its illustrative ring there, so one ring shows.
The second is `pool: memory.packet-buffer-region`, a `mempool` instance, handled the same way: drawn
beside the map, with host memory built without its illustrative buffers.
`tests/unit/test_compositions.py` holds the rules against test-only fixtures and every composition;
`tests/unit/test_descriptor_ring.py` against the real ring in `nic_host`.

### References

What a part **refers to**: a ring's descriptors each hold the address of a packet buffer. Another
optional section, never a connection, a residence or an interaction:

```yaml
references:                        # a part of one instance → what a part of another represents
  - from: rx_ring.descriptors
    to: memory.packet-buffer-region
```

Read it as: *the descriptors of `rx_ring` refer to buffers represented by
`memory.packet-buffer-region`.* It is **static and aggregate** — true of the configuration the
composition shows, and of all the descriptors together.

- `from` and `to` are each an `instance.part` (never a port or an anchor) of two different
  instances; the source asset's registry `refers_to` must list the target's asset (allowed
  targets: it creates no reference and requires none). An entry is `from` and `to`, nothing else.
- It is **not** ownership, allocation, lifetime, residence, attachment, DMA or data flow, queue
  association, an mbuf relationship or a drawn link. A ring resides in one region and refers to
  another; neither implies the other.
- **Deferred:** which descriptor names which buffer (runtime slot bindings), concrete addresses
  (virtual, physical, IOVA), head and tail, ordering, ownership, allocation and lifetime.
- It is part of schema `version: 1`, and the runtime copy carries it as written. A validation that
  a `dma` target lies within a reference's target is a later possibility, not a rule today.

`nic_host` declares the first reference: `rx_ring.descriptors → memory.packet-buffer-region`. It is
drawn as nothing — no arrow joins the ring to the buffers — and the `dma` interaction to the same
region is unchanged and separate.

## Where a composition lives

| What | Where | `nic_host` |
| --- | --- | --- |
| the contract | `assets/compositions/<id>.yaml`, next to the registry; `tests/unit/test_compositions.py` checks it against the registry and the concepts | `nic_host.yaml` |
| its Three.js implementation | `renderers/three/src/compositions/<id>/` — the only code allowed to import several asset domains; domains never import a composition or one another. It reads `contract.json`, the contract plus the registry ports it uses, kept identical by the same test (`python tests/unit/test_compositions.py` regenerates it) | `compositions/nic_host/` |
| its page | `experiences/<domain>/<slug>/`, the route named in the contract | `/axiobyte/networking/nic-host/` |

## Tests it must pass

- **Topology** — every instance names a registry asset; every connection names real ports of those
  instances; each pair names each other, or the counterpart port is deliberately generic; every
  anchor resolves; many-to-one resolution follows the rule above.
- **Geometry** — mated anchors coincide and face each other; no unintended overlaps between
  instances; transforms are deterministic.
- **Semantics** — DMA and every other interaction is declared as a concept, never as a port;
  composing does not mutate any asset's definition or registry entry.
- **Residence** — each names a real part of another instance whose asset the child's `resides_in`
  allows; never a port, never itself, never also a connection; unknown sections are errors.
- **References** — each joins real parts of two different instances, allowed by the source's
  `refers_to`; only `from` and `to`; never a port, a connection, a residence or an interaction.
- **Regression** — every asset's own page, tests and measurements are unchanged.
