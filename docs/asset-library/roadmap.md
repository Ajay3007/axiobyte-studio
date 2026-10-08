# The first assets

The order follows what the repository is already building toward, not a generic hardware list:

- **One pillar.** All three episodes belong to `p01-high-performance-data-plane`. Their casts —
  NIC, PCIe, DMA, descriptor rings, mbufs, mempools, CPU/worker cores, packets — are the assets
  that pay back first.
- **One kit already planned.** ROADMAP.md 1.11 names the first 3D kit as `nic_board`, `cpu_die`,
  `dimm`, `pcie_slot`. The NIC shipped; the other three are the next hero/standard assets.
- **One open port.** The NIC's `pcie_connector` port connected to nothing until the PCIe asset
  existed. Every NIC → host story (DMA, rings, polling) runs through it, so its neighbours come first.
- **One legacy stand-in.** The v1.1 `HostMemory.js` was on the NIC page (as released in
  `experiences-v1.1.0`) and was not a library asset. The first composition replaced it with real
  assets, and it has been retired.

## Order

| # | Asset | id → URL | Tier | Concept | Why here |
| --- | --- | --- | --- | --- | --- |
| 1 | **NIC** | `nic` → `/axiobyte/networking/nic/` | hero | `nic` ✓ | **The reference.** 1.0.0 shipped in `experiences-v1.1.0`; 1.1.0, which adds `pcie_connector`'s facing, ships in `experiences-v1.2.0`. |
| 2 | **PCIe** (x8 slot, lanes, link) | `pcie` → `/axiobyte/io/pcie/` | hero | `pcie` ✓ | **Released in `experiences-v1.2.0`.** The NIC's only unconnected host-side port; proves the port model end to end (`NIC.pcie_connector → PCIe.endpoint`). ROADMAP `pcie_slot`. Follow-up: the `pcie` concept is still written from the NIC's side (its title, PCIE-1 and `requires: [nic]`); a generic objective for lanes, the link and its two ends belongs in a knowledge-model pass. |
| 3 | **Host memory** (DIMMs, memory regions) | `host_memory` → `/axiobyte/memory/host-memory/` | hero | `host_memory` ✓ | **Released in `experiences-v1.2.0`.** Two generic DIMMs (physical) and a map of the address space with a descriptor region and packet buffers (logical); structural port `memory_interface`. Where every DMA lands in every episode. Built from this standard to **replace** the v1.1 `HostMemory.js`, which the first composition did; the stand-in is retired. ROADMAP `dimm`. |
| — | *First composition*: NIC + PCIe + CPU + host memory | `nic_host` → `/axiobyte/networking/nic-host/` | — | `dma` (interaction) | **Released in `experiences-v1.2.0`.** Its own page, and the NIC page's *In the host* view; the legacy `HostMemory.js` is retired. Re-expresses the v1.1 semantic correction with real assets, through ports. The CPU is in it because the ports route through it: PCIe reaches the root complex, and memory hangs off the memory controller. Contract and decisions: [`composition.md`](composition.md). |
| 4 | **CPU** (package, dies, cores as parts, caches) | `cpu` → `/axiobyte/computing/cpu/` | hero | `cpu` ✓ | **Released in `experiences-v1.2.0`.** A generic LGA package (lid, substrate, die, lands) with cores, cache, memory controller and PCIe/I/O as conceptual regions; structural ports `pcie_root_complex` and `memory_interface`. The other side of every polling and copy story (s01e01, s01e02). Cores are **parts** of the CPU first — a separate core asset only when a shot needs a core's internals. ROADMAP `cpu_die`. |
| 5 | **Packet** | `packet` → `/axiobyte/networking/packet/` | micro | `packet` ✓ | In every episode; the moving thing every composition needs. |
| 6 | **Descriptor ring** (descriptors as a part) | `descriptor_ring` → `/axiobyte/memory/descriptor-ring/` | standard | `descriptor_ring` ✓ | **Released in `experiences-v1.3.0`.** The structure that ties NIC to software (s01e03). One part, `descriptors` — a single descriptor is a slot of it, a separate descriptor asset only if it is shown alone; head and tail are anchors, not parts; no ports. It may reside in host memory and refer to its packet buffers (`resides_in`, `refers_to`); `nic_host` composes one, `rx_ring`, in host memory's descriptor region, referring to its packet-buffer region, with host memory's illustrative ring hidden there. |
| 7 | **mbuf** (packet metadata) | `mbuf` → `/axiobyte/memory/mbuf/` | micro | `mbuf` ✓ | **Prototype** — a Manim actor only (s01e02); no Three.js model and no page. The handle to a packet: metadata and `buf_addr`, the address of the packet buffer the bytes land in — not the buffer itself; the zero-copy story (s01e02) turns on it. |
| 8 | **Mempool** | `mempool` → `/axiobyte/memory/mempool/` | standard | `mempool` ✓ | **Prototype** — a Manim actor and a Three.js model, no page of its own. `nic_host` composes one, `pool`, in host memory's packet-buffer region, disclosed there as a prototype ([README §8](README.md#8-lifecycle)). Composes mbufs; completes the DPDK receive cast. |

After these, in the order future episodes call for them: **cache line**
(`/axiobyte/memory/cache-line/`, micro; the false-sharing concepts exist), **Ethernet switch**
(`/axiobyte/networking/ethernet-switch/`) and **SFP** (`/axiobyte/networking/sfp/`).

## Asset, part or composition — the rule applied

Each item classified with the [asset-or-part test](README.md#asset-or-part) (exists on its own ·
relates to more than its parent · content studies it alone). "Graduates" means it starts as a part
and becomes an asset when real content needs it studied alone; its URL is reserved by the
convention, not built.

| Item | Starts as | Why |
| --- | --- | --- |
| PCIe (slot, lanes) | **Asset** | A separate interconnect on the motherboard; joins any card (NIC, GPU, NVMe) to the CPU's root complex; its own lessons. The NIC's edge connector stays a NIC part. The root complex is inside the CPU package, so PCIe reaches it through a `root_complex` port rather than owning it. |
| Host memory | **Asset** | Physically separate DIMMs; every DMA and every ring or buffer lands in it; its own page. |
| DIMM | **Part** of host memory — graduates | Is a separate physical module, but no planned content studies one DIMM alone; `/axiobyte/memory/dimm/` if a hardware close-up needs it. |
| CPU | **Asset** | A separate package; connects to memory, PCIe and every software story. |
| CPU core | **Part** of the CPU — graduates | Never separate from its package; becomes an asset (`/axiobyte/computing/cpu-core/`) when a shot needs a core's internals (pipeline, private caches). A *worker core* is a software role of a core, not geometry. |
| Cache (L1/L2/L3) | **Part** of the CPU — graduates | Structure inside the package; becomes an asset (`/axiobyte/memory/cache/`) when sets and ways are studied alone. |
| Cache line | **Asset** (micro), when needed | Moves between cores and memory — the false-sharing story is exactly that movement. |
| Packet | **Asset** (micro) | Moves through every asset in the path; belongs to none of them. |
| Descriptor ring | **Asset** | A structure software allocates in host memory, one per queue; relates to the NIC's queue context and to buffers; its own page. Resides in a host-memory region (`residence`), not attached through a port; its descriptors refer to packet buffers (`references`). |
| Descriptor | **Part** of the ring — graduates | A fixed slot of the ring; never leaves it. Graduates only if its field layout is studied alone. |
| mbuf | **Asset** (micro) | Handed out by its pool, passed to the application and returned — it changes hands while its memory stays in the pool, so an asset (tie-breaker 1). Distinct from the packet buffer it refers to. |
| Packet buffer | **Part** of host memory (`packet-buffer-region`) — undecided | Where packet bytes land. No packet-buffer asset exists or is planned yet; whether buffers become one (and how they relate to mbufs and mempools) is open. |
| Mempool | **Asset** | A region software allocates; holds mbufs, which remain mbuf assets residing in it. |
| NUMA node | **Composition** | A CPU socket plus its local memory and the interconnect — a system of assets, not a thing of its own. Its page (`/axiobyte/memory/numa-node/`) is a composition page. |
| SFP module | **Asset** | Hot-pluggable on its own, into NICs and switches alike; its own identity and page. The SFP *cage* is a part of whichever card or switch hosts it. |
| Ethernet switch | **Asset** | A separate device with ports, many links and its own lessons. |

## Interactions and compositions get pages too — but they are not assets

These teach how assets *work together*. Each is a composition of the assets above, and may get an
experience page on the same URL convention once its assets exist:

| Page | URL | Composes | Concept |
| --- | --- | --- | --- |
| DMA | `/axiobyte/io/dma/` | NIC + PCIe + CPU + host memory + descriptor ring | `dma` (interaction) |
| RSS | `/axiobyte/io/rss/` | NIC + packets + descriptor rings + CPU cores | `rss` (interaction) |
| The DPDK receive path | `/axiobyte/dataplane/dpdk/` | NIC + PCIe + host memory + ring + mbuf + mempool + CPU | `dpdk_rx_pipeline` (composite) |

## Rules for the roadmap

- **Nothing here is built by this document.** No placeholder pages, no registry entries for
  unbuilt assets. An asset enters `assets/library.yaml` when work on it starts (`prototype`).
- **Its page is part of its acceptance.** An asset is not `production` until its page exists and
  passes [`qa-checklist.md`](qa-checklist.md).
- **The concept comes first.** NUMA node, Ethernet switch and SFP need atomic concepts (and
  visual grammar) before their assets, as host memory did (`host_memory`, added with its asset).
- **The order can change** when an episode needs something sooner; the reasons above say what
  would justify moving an item.
